import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Terrain } from "../src/world/terrain";
import { terrainMeshes } from "../src/world/terrain-mesh";
import {
  pointInPoly,
  segmentPoint,
  KX,
  ORIGIN,
  type CityData,
  type Building,
} from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
import { buildSeawall } from "../src/world/seawall";
import {
  prospectLighthouse,
  PROSPECT_LIGHT_ID,
  prospectLightFrame,
} from "../src/world/prospect-lighthouse";
import { Batcher, subdividePath } from "../src/world/geometry";
import type { Materials } from "../src/world/materials";
function materials() {
  return {
    texture: () => new T.Texture(),
    pbr: () => new T.MeshStandardMaterial(),
    concrete: new T.MeshStandardMaterial(),
    asphalt: new T.MeshStandardMaterial(),
    beacons: [],
  } as unknown as Materials;
}
function data() {
  const d = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540,
    cv = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  d.buildings.forEach((b) => (b.pts = cv(b.pts)));
  d.areas.forEach((a) => {
    a.pts = cv(a.pts);
    a.holes = a.holes?.map(cv);
  });
  d.ocean = d.ocean.map(cv);
  d.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  d.seawall = JSON.parse(
    fs.readFileSync("public/data/stanley-seawall.json", "utf8"),
  );
  const bytes = fs.readFileSync("public/data/stanley-height.u16");
  d.terrain = new Terrain(
    JSON.parse(fs.readFileSync("public/data/stanley-terrain.json", "utf8")),
    new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  );
  return d;
}
test("shoreline clipping preserves land area, slope and upward faces without filling mapped water", () => {
  const t = new Terrain(
    {
      version: 1,
      sourceYear: 2002,
      minX: 0,
      minZ: 0,
      step: 4,
      columns: 3,
      rows: 3,
      scale: 1,
      binary: "",
      lakes: [],
    },
    new Uint16Array([10, 18, 26, 14, 22, 30, 18, 26, 34]),
  );
  const water = [3, -10, 20, -10, 20, 20, 3, 20],
    meshes = terrainMeshes(t, [], new T.MeshStandardMaterial(), [water]);
  let area = 0,
    count = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      idx = mesh.geometry.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, idx.getX(i)),
        b = new T.Vector3().fromBufferAttribute(p, idx.getX(i + 1)),
        c = new T.Vector3().fromBufferAttribute(p, idx.getX(i + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(n.y > 0);
      area += n.y / 2;
      count++;
      for (const v of [a, b, c]) {
        assert.ok(v.x <= 3.00001);
        assert.ok(Math.abs(v.y + 0.012 - t.height(v.x, v.z)) < 1e-5);
      }
    }
  }
  assert.ok(count > 2);
  assert.ok(Math.abs(area - 24) < 1e-5);
});
test("mapped seawall adds finite masonry, keeps named route centres clear, and blocks its low edge", () => {
  const d = data(),
    c = new CollisionWorld(d),
    root = new T.Group(),
    m = materials();
  const samples = d.roads
    .filter((r) => /^Stanley Park Seawall/.test(r.name ?? ""))
    .flatMap((r) =>
      subdividePath(r.pts, 1).reduce<[number, number][]>((a, x, i, points) => {
        if (i % 2 === 0) a.push([x, points[i + 1]]);
        return a;
      }, []),
    )
    .filter(
      ([x, z]) =>
        !c.blocked(x, z, 0.36, c.groundHeight(x, z)) &&
        !c.water(x, z, c.groundHeight(x, z)),
    );
  const meshes = buildSeawall(root, d, m, c);
  assert.ok(
    meshes.length > 15 && meshes.length < 150,
    `spatial chunks: ${meshes.length}`,
  );
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
  }
  const blocked = samples.filter(([x, z]) =>
    c.blocked(x, z, 0.36, c.groundHeight(x, z)),
  );
  assert.deepEqual(
    blocked,
    [],
    "stone and rails must not close the mapped walking/cycling centreline",
  );
  assert.equal(c.blocked(-1548.3, -3431.6, 0.3, 2), true);
  assert.equal(
    c.blocked(-1548.3, -3431.6, 0.3, 5),
    false,
    "jumping above a low cap is allowed",
  );
});
test("Prospect lighthouse follows its footprint and has the mapped red beacon focal elevation", () => {
  const d = data(),
    b = d.buildings.find((b) => b.id === PROSPECT_LIGHT_ID)!,
    c = new CollisionWorld(d),
    root = new T.Group(),
    batch = new Batcher(root),
    m = materials();
  assert.ok(b);
  batch.offsetY = c.groundHeight(-1554.7, -3427.5);
  assert.equal(prospectLighthouse(b, batch, m), true);
  assert.equal(prospectLighthouse({ ...b, id: "other" }, batch, m), false);
  const meshes = batch.finish();
  assert.ok(
    meshes.some((mesh) =>
      (mesh.material as T.Material).name.includes("red band"),
    ),
  );
  root.updateMatrixWorld(true);
  const frame = prospectLightFrame(b),
    rayStart = new T.Vector3(0.3, 1.4, 5).applyMatrix4(frame),
    direction = new T.Vector3(0, 0, -1).transformDirection(frame);
  rayStart.y += batch.offsetY;
  const hit = new T.Raycaster(rayStart, direction).intersectObjects(meshes)[0];
  assert.ok(hit, "front door must be visible from the approach");
  const local = hit.point
    .clone()
    .sub(new T.Vector3(0, batch.offsetY, 0))
    .applyMatrix4(frame.clone().invert());
  const facadeZ = new T.Vector3(b.pts[0], 0, b.pts[1]).applyMatrix4(
    frame.clone().invert(),
  ).z;
  assert.ok(
    local.z > facadeZ + 0.05,
    "door must project beyond the mapped wall, not be buried inside it",
  );
  const wallStart = new T.Vector3(0.85, 0.9, 5).applyMatrix4(frame);
  wallStart.y += batch.offsetY;
  const wallHit = new T.Raycaster(wallStart, direction).intersectObjects(
    meshes,
  )[0];
  assert.ok(wallHit, "near exterior wall must face outwards");
  const wallLocal = wallHit.point.clone().applyMatrix4(frame.clone().invert());
  assert.ok(
    Math.abs(wallLocal.z - facadeZ) < 0.01,
    "visible wall must be the near façade, not the inside of the far wall",
  );
  assert.equal(m.beacons.length, 1);
  assert.ok(Math.abs(m.beacons[0].light.position.y - 11.5) < 0.001);
  assert.equal(m.beacons[0].period, 2);
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      assert.ok([x, y, z].every(Number.isFinite));
      assert.ok(y < 14.2);
      if (y > batch.offsetY + 2.4 || pointInPoly(x, z, b.pts)) continue;
      let distance = Infinity;
      for (let j = 0; j < b.pts.length; j += 2) {
        const k = (j + 2) % b.pts.length;
        distance = Math.min(
          distance,
          segmentPoint(x, z, b.pts[j], b.pts[j + 1], b.pts[k], b.pts[k + 1]).d,
        );
      }
      assert.ok(distance < 0.32, "ground decorations must not occupy the path");
    }
  }
});
