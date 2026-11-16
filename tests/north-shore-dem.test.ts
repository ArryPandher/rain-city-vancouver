import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { geo } from "../src/world/data";
import {
  NORTH_SHORE_DEM as d,
  NORTH_SHORE_DEM_BOUNDS as bounds,
  NORTH_SHORE_DEM_PROFILE as profile,
  createNorthShoreDemGeometry,
  createNorthShoreDemGroup,
  sampleNorthShoreElevation,
} from "../src/world/north-shore-dem";
const chunks = createNorthShoreDemGeometry();
const dx = (bounds.maxX - bounds.minX) / (d.width - 1),
  dz = (bounds.maxZ - bounds.minZ) / (d.height - 1);

test("bounded quarter-metre DEM retains source provenance, projection, relief and measured interior heights", () => {
  assert.equal(d.sources.length, 12);
  assert.ok(
    d.sources.every(
      (s) =>
        /^[a-f0-9]{64}$/.test(s.sha256) &&
        s.url.startsWith(
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11/",
        ),
    ),
  );
  assert.equal(d.elevations.length, d.width * d.height);
  assert.ok(d.elevations.every(Number.isInteger));
  assert.equal(Math.max(...d.elevations) * d.metresPerUnit, 1755.75);
  assert.equal(Math.min(...d.elevations) * d.metresPerUnit, -5);
  assert.deepEqual(geo(d.bounds.north, d.bounds.west), [
    bounds.minX,
    bounds.minZ,
  ]);
  assert.equal(sampleNorthShoreElevation(bounds.minX - 1, bounds.minZ), null);
  for (const control of d.controls) {
    const p = geo(control.lat, control.lon),
      sample = sampleNorthShoreElevation(...p)!;
    // 80m runtime resampling smooths small local features versus source ~50m pixels.
    assert.ok(
      Math.abs(sample - control.elevation) < 35,
      `${control.name}: ${sample} vs ${control.elevation}`,
    );
  }
  for (const c of chunks) {
    const p = c.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + c.origin[0],
        z = p.getZ(i) + c.origin[1];
      if (
        x > bounds.minX + 641 &&
        x < bounds.maxX - 641 &&
        z > bounds.minZ + 641 &&
        z < bounds.maxZ - 1201
      )
        assert.ok(
          Math.abs(p.getY(i) - sampleNorthShoreElevation(x, z)!) < 0.003,
          "no interior exaggeration",
        );
    }
  }
});

test("every real triangle faces upward; chunk edges share heights/normals and boundary meets zero ground", () => {
  const vertices = new Map<string, { y: number; normal: number[] }>();
  let shared = 0,
    triangles = 0;
  for (const c of chunks) {
    const p = c.geometry.attributes.position,
      n = c.geometry.attributes.normal,
      index = c.geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, index.getX(i));
      const b = new T.Vector3().fromBufferAttribute(p, index.getX(i + 1));
      const z = new T.Vector3().fromBufferAttribute(p, index.getX(i + 2));
      assert.ok(
        b.sub(a).cross(z.sub(a)).y > 0,
        "front face visible from above",
      );
      triangles++;
    }
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + c.origin[0],
        z = p.getZ(i) + c.origin[1];
      const col = Math.round((x - bounds.minX) / dx),
        row = Math.round((z - bounds.minZ) / dz),
        key = `${col},${row}`;
      const normal = [n.getX(i), n.getY(i), n.getZ(i)],
        old = vertices.get(key);
      if (old) {
        assert.equal(old.y, p.getY(i));
        assert.deepEqual(old.normal, normal);
        shared++;
      } else vertices.set(key, { y: p.getY(i), normal });
      if (col === 0 || row === 0 || col === d.width - 1 || row === d.height - 1)
        assert.ok(Math.abs(p.getY(i)) < 1e-7);
    }
  }
  assert.equal(vertices.size, d.width * d.height);
  assert.ok(shared > 1000);
  assert.equal(triangles, 202496);
  assert.equal(chunks.length, 28);
  assert.equal(profile.chunkCells, 64);
  const group = createNorthShoreDemGroup();
  group.updateMatrixWorld(true);
  for (const control of d.controls) {
    const [x, z] = geo(control.lat, control.lon);
    const hits = new T.Raycaster(
      new T.Vector3(x, 3000, z),
      new T.Vector3(0, -1, 0),
      0,
      4000,
    ).intersectObject(group, true);
    assert.ok(hits.length > 0);
    assert.ok(hits[0].face!.normal.y > 0);
    assert.ok(Math.abs(hits[0].point.y - control.elevation) < 40);
  }
});

test("candidate stays clear of all loaded source road/building footprints and has bounded GPU memory", () => {
  const files = [
    "public/data/vancouver-roads.json",
    "public/data/vancouver-east.json",
  ];
  let nearest = Infinity;
  for (const file of files) {
    const source = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const obj of [
      ...(source.roads ?? []),
      ...(source.buildings ?? []),
      ...(source.areas ?? []),
    ]) {
      for (let i = 1; i < obj.pts.length; i += 2)
        nearest = Math.min(nearest, obj.pts[i] - bounds.maxZ);
    }
  }
  assert.ok(nearest > 590, `south gap ${nearest}`);
  const downtown = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const north = geo(downtown.meta.bbox[2], 0)[1];
  assert.ok(north > bounds.maxZ);
  let bytes = 0;
  for (const c of chunks) {
    for (const a of Object.values(c.geometry.attributes))
      bytes += a.array.byteLength;
    bytes += c.geometry.index!.array.byteLength;
  }
  assert.ok(bytes < 5900000, `GPU geometry bytes ${bytes}`);
  const group = createNorthShoreDemGroup();
  for (const mesh of group.children as T.Mesh[]) {
    assert.equal(mesh.userData.visualTerrainOnly, true);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.frustumCulled, true);
    assert.equal((mesh.material as T.MeshStandardMaterial).side, T.FrontSide);
    assert.equal((mesh.material as T.MeshStandardMaterial).fog, true);
  }
});
