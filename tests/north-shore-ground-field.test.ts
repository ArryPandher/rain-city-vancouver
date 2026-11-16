import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { geo } from "../src/world/data";
import urban from "../src/world/north-shore-urban-source.json";
import dem from "../src/world/north-shore-dem-data.json";
import { createNorthShoreDemGeometry } from "../src/world/north-shore-dem";
import {
  NORTH_SHORE_GROUND as d,
  NORTH_SHORE_GROUND_BOUNDS as bounds,
  createNorthShoreGroundGeometry,
  sampleNorthShoreGroundSource,
  sampleNorthShoreGroundSurface,
} from "../src/world/north-shore-ground-field";
const chunks = createNorthShoreGroundGeometry();

test("lower field retains verified source projection, every original overlap sample and all 44 footprints", () => {
  assert.equal(d.sources.length, 2);
  for (const source of d.sources)
    assert.deepEqual(
      source,
      dem.sources.find((s) => s.x === source.x && s.y === source.y),
    );
  assert.deepEqual(d.projection, dem.projection);
  assert.equal(d.elevations.length, (d.width + 2) * (d.height + 2));
  let overlap = 0;
  for (let row = d.cells.minRow - 1; row < dem.height; row++)
    for (let col = d.cells.minCol - 1; col <= d.cells.maxCol + 1; col++) {
      assert.equal(
        d.elevations[
          (row - d.cells.minRow + 1) * (d.width + 2) + col - d.cells.minCol + 1
        ],
        dem.elevations[row * dem.width + col],
      );
      overlap++;
    }
  assert.equal(overlap, 1440);
  for (const b of urban.buildings)
    for (let i = 0; i < b.pts.length; i += 2)
      assert.notEqual(
        sampleNorthShoreGroundSource(b.pts[i], b.pts[i + 1]),
        null,
      );
  // Retained terrain is not replaced by an invented zero-level perimeter.
  assert.ok(sampleNorthShoreGroundSource(...geo(49.325, -123.08))! > 50);
  for (const p of [
    [bounds.minX - 0.01, bounds.minZ],
    [bounds.maxX + 0.01, bounds.minZ],
    [bounds.minX, bounds.minZ - 0.01],
    [bounds.minX, bounds.maxZ + 0.01],
    [NaN, 0],
    [0, Infinity],
  ])
    assert.equal(sampleNorthShoreGroundSurface(p[0], p[1]), null);
});

test("each emitted triangle has exact shared support interpolation and upward winding; real ray checks agree", () => {
  let triangles = 0;
  const group = new T.Group();
  for (const c of chunks) {
    const mesh = new T.Mesh(c.geometry, new T.MeshBasicMaterial());
    mesh.position.set(c.origin[0], 0, c.origin[1]);
    group.add(mesh);
    const p = c.geometry.getAttribute("position"),
      ix = c.geometry.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const vs = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(p, ix.getX(i + j)),
      );
      assert.ok(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y > 0);
      const point = vs[0]
        .multiplyScalar(0.2)
        .addScaledVector(vs[1], 0.3)
        .addScaledVector(vs[2], 0.5);
      assert.ok(
        Math.abs(
          sampleNorthShoreGroundSurface(
            point.x + c.origin[0],
            point.z + c.origin[1],
          )! - point.y,
        ) < 1e-8,
      );
      triangles++;
    }
  }
  assert.equal(triangles, 11316);
  assert.equal(chunks.length, 9);
  group.updateMatrixWorld(true);
  for (let i = 0; i < 100; i++) {
    const x =
      bounds.minX +
      (bounds.maxX - bounds.minX) * ((i * 0.61803398875 + 0.01) % 1);
    const z =
      bounds.minZ +
      (bounds.maxZ - bounds.minZ) * ((i * 0.41421356237 + 0.07) % 1);
    const hit = new T.Raycaster(
      new T.Vector3(x, 2000, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(group)[0];
    assert.ok(hit);
    assert.ok(
      Math.abs(hit.point.y - sampleNorthShoreGroundSurface(x, z)!) < 1e-8,
    );
  }
});

test("all chunk seams are identical; north seam matches original DEM heights, normals and color", () => {
  const original = createNorthShoreDemGeometry();
  const seam = new Map<number, number[]>();
  const [gx, gz] = geo(dem.bounds.north, dem.bounds.west);
  const [ex, ez] = geo(dem.bounds.south, dem.bounds.east);
  const dx = (ex - gx) / (dem.width - 1),
    dz = (ez - gz) / (dem.height - 1);
  for (const c of original) {
    const p = c.geometry.getAttribute("position"),
      n = c.geometry.getAttribute("normal"),
      color = c.geometry.getAttribute("color");
    for (let i = 0; i < p.count; i++) {
      const row = Math.round((p.getZ(i) + c.origin[1] - gz) / dz),
        col = Math.round((p.getX(i) + c.origin[0] - gx) / dx);
      if (row === d.cells.minRow)
        seam.set(col, [
          p.getY(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
          color.getX(i),
          color.getY(i),
          color.getZ(i),
        ]);
    }
  }
  const shared = new Map<string, number[]>();
  let duplicates = 0,
    northern = 0;
  for (const c of chunks) {
    const p = c.geometry.getAttribute("position"),
      n = c.geometry.getAttribute("normal"),
      color = c.geometry.getAttribute("color");
    for (let i = 0; i < p.count; i++) {
      const row = Math.round((p.getZ(i) + c.origin[1] - gz) / dz),
        col = Math.round((p.getX(i) + c.origin[0] - gx) / dx);
      const value = [
        p.getY(i),
        n.getX(i),
        n.getY(i),
        n.getZ(i),
        color.getX(i),
        color.getY(i),
        color.getZ(i),
      ];
      const key = `${col},${row}`;
      if (shared.has(key)) {
        assert.deepEqual(value, shared.get(key));
        duplicates++;
      } else shared.set(key, value);
      if (row === d.cells.minRow) {
        assert.deepEqual(value, seam.get(col));
        northern++;
      }
    }
  }
  assert.ok(duplicates > 200);
  assert.ok(northern >= 70);
  assert.equal(shared.size, 5810);
  for (const c of original) c.geometry.dispose();
});

test("unattached source study cannot silently promote or change live terrain/building support", () => {
  for (const file of [
    "src/world/world.ts",
    "src/world/collision.ts",
    "src/world/north-shore-urban-horizon.ts",
  ])
    assert.ok(
      !fs
        .readFileSync(file, "utf8")
        .includes('from "./north-shore-ground-field"'),
    );
  // Sampler distinction is observable on nonplanar source cells, not a bilinear alias.
  let difference = 0;
  for (let i = 1; i < 30; i++) {
    const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / 31;
    const z = bounds.minZ + ((bounds.maxZ - bounds.minZ) * i) / 33;
    difference = Math.max(
      difference,
      Math.abs(
        sampleNorthShoreGroundSource(x, z)! -
          sampleNorthShoreGroundSurface(x, z)!,
      ),
    );
  }
  assert.ok(difference > 0.1);
});
