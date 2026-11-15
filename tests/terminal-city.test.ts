import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import {
  buildTerminalCity,
  type TerminalCityMaterials,
} from "../src/world/terminal-city";
import {
  TERMINAL_CITY_RING as ring,
  TERMINAL_CITY_TOWER_UV,
  TERMINAL_CITY_UPPER_UV,
  terminalCityPoint,
  TERMINAL_CITY_HEIGHT,
  terminalCityLevel,
} from "../src/world/terminal-city-site";
const mats = Object.fromEntries(
  ["glass", "spandrel", "metal", "stone", "dark", "roof"].map((name) => [
    name,
    new T.MeshStandardMaterial({ name }),
  ]),
) as unknown as TerminalCityMaterials;
const root = new T.Group(),
  batch = new Batcher(root);
batch.offsetY = 7.73;
buildTerminalCity(batch, { id: "w143683933", pts: ring.flat() }, mats);
const meshes = batch.finish();
root.updateMatrixWorld(true);
function ray(u: number, v: number, y: number, du: number, dv: number, dy = 0) {
  const a = terminalCityPoint(u, v),
    b = terminalCityPoint(u + du, v + dv);
  return new T.Raycaster(
    new T.Vector3(a[0], y, a[1]),
    new T.Vector3(b[0] - a[0], dy, b[1] - a[1]).normalize(),
    0,
    Math.hypot(du, dv, dy),
  ).intersectObject(root, true);
}
test("exact identity gate, original ground datum and bounded six-material batches", () => {
  const other = new Batcher(new T.Group());
  assert.equal(
    buildTerminalCity(other, { id: "w143683980", pts: ring.flat() }, mats),
    false,
  );
  assert.equal(other.groups.size, 0);
  assert.equal(batch.offsetY, 7.73);
  assert.equal(terminalCityLevel(4), 21.94);
  assert.equal(terminalCityLevel(30), 94.94);
  assert.equal(meshes.length, 6);
  const bounds = new T.Box3().setFromObject(root);
  assert.ok(Math.abs(bounds.min.y) < 1e-5);
  assert.ok(Math.abs(bounds.max.y - TERMINAL_CITY_HEIGHT) < 1e-5);
});
test("municipal tower stays at Hastings end with real asymmetric roof setbacks", () => {
  assert.ok(Math.max(...TERMINAL_CITY_TOWER_UV.map((p) => p[0])) < 38);
  assert.ok(Math.max(...TERMINAL_CITY_UPPER_UV.map((p) => p[1])) < 23);
  assert.ok(
    ray(50, 12, 110, 0, 0, -120)[0].point.y < 23,
    "Cordova club must not inherit generic tall tower",
  );
  assert.ok(ray(12, 12, 110, 0, 0, -120)[0].point.y > 90);
  assert.ok(
    ray(12, 24, 110, 0, 0, -120)[0].point.y < 78,
    "rear shoulder is a lower roof",
  );
});
test("closed mapped base and deep limestone windows have unobstructed glass before backing", () => {
  for (const [u, v, du, dv] of [
    [10, -2, 0, 5],
    [58, 12, -5, 0],
    [28, 30, 0, -5],
    [-2, 12, 5, 0],
  ])
    assert.ok(ray(u, v, 0.2, du, dv).length, "mapped solid ground boundary");
  const hits = ray(8.8, -2, 2.5, 0, 5);
  assert.ok(hits.length);
  const glass = hits.find((h) => (h.object as T.Mesh).material === mats.glass),
    dark = hits.find((h) => (h.object as T.Mesh).material === mats.dark);
  assert.ok(glass && dark);
  assert.ok(dark.distance - glass.distance > 0.03);
  assert.ok(
    ray(8, -2, 5.4, 0, 5).some(
      (h) => (h.object as T.Mesh).material === mats.stone,
    ),
  );
});
test("finite geometry, outward winding and metre-scaled mineral caps", () => {
  let triangles = 0,
    metricCap = false;
  for (const obj of meshes) {
    const g = obj.geometry,
      p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      uv = g.getAttribute("uv"),
      ix = g.index!;
    triangles += ix.count / 3;
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
          uv.getX(i),
          uv.getY(i),
        ].every(Number.isFinite),
      );
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 0.001,
      );
    }
    for (let i = 0; i < ix.count; i += 3) {
      const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)],
        a = new T.Vector3().fromBufferAttribute(p, ids[0]),
        b = new T.Vector3().fromBufferAttribute(p, ids[1]),
        c = new T.Vector3().fromBufferAttribute(p, ids[2]);
      const cr = b.sub(a).cross(c.sub(a));
      assert.ok(cr.length() > 1e-8);
      assert.ok(cr.dot(new T.Vector3().fromBufferAttribute(n, ids[0])) > 0);
      if (Math.abs(n.getY(ids[0])) > 0.99 && obj.material === mats.roof) {
        const worldSpan = new T.Vector2(
            p.getX(ids[0]) - p.getX(ids[1]),
            p.getZ(ids[0]) - p.getZ(ids[1]),
          ).length(),
          uvSpan = new T.Vector2(
            uv.getX(ids[0]) - uv.getX(ids[1]),
            uv.getY(ids[0]) - uv.getY(ids[1]),
          ).length();
        assert.ok(Math.abs(worldSpan - uvSpan) < 0.002);
        metricCap = true;
      }
    }
  }
  assert.ok(metricCap);
  assert.ok(triangles < 30000);
  console.log({ triangles, batches: meshes.length });
});

import {
  buildTerminalCityClub,
  TERMINAL_CITY_CLUB_RING,
  TERMINAL_CITY_CLUB_PARTS,
} from "../src/world/terminal-city-club";
test("adjoining club keeps all six historical roof heights, source bounds and closed ground", () => {
  const root = new T.Group(),
    batch = new Batcher(root);
  batch.offsetY = 7.73;
  assert.equal(
    buildTerminalCityClub(batch, { id: "w360437747", pts: [] }, mats),
    false,
  );
  assert.equal(batch.groups.size, 0);
  assert.equal(
    buildTerminalCityClub(
      batch,
      { id: "w143683969", pts: TERMINAL_CITY_CLUB_RING.flat() },
      mats,
    ),
    true,
  );
  assert.equal(batch.offsetY, 7.73);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  assert.equal(meshes.length, 6);
  let triangles = 0;
  for (const mesh of meshes) {
    triangles += mesh.geometry.index!.count / 3;
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++)
      assert.ok(
        [
          p.getX(i),
          p.getY(i),
          p.getZ(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
        ].every(Number.isFinite),
      );
  }
  // Independent points selected inside each registered roof patch, not facade
  // vertices or centroids shared with an adjoining higher roof.
  for (const [x, z, h] of [
    [373, -434, 15.52],
    [393, -414, 21.95],
    [403, -418, 11.53],
    [378, -439, 5.5],
    [390, -399, 21.94],
    [384, -421, 20.3],
  ]) {
    const hit = new T.Raycaster(
      new T.Vector3(x, 40, z),
      new T.Vector3(0, -1, 0),
      0,
      50,
    ).intersectObject(root, true)[0];
    assert.ok(hit);
    assert.ok(
      Math.abs(hit.point.y - h) < 0.001,
      `${x},${z}: ${hit.point.y} expected ${h}`,
    );
  }
  const roofHits = new T.Raycaster(
    new T.Vector3(393, 40, -414),
    new T.Vector3(0, -1, 0),
    0,
    30,
  ).intersectObject(root, true);
  assert.equal(
    (roofHits[0].object as T.Mesh).material,
    mats.glass,
    "registered pool roof has no opaque mineral cap in front",
  );
  const roofBack = roofHits.find(
    (h) => (h.object as T.Mesh).material === mats.dark,
  );
  assert.ok(roofBack);
  assert.ok(roofBack.distance - roofHits[0].distance > 0.04);
  assert.deepEqual(
    [...new Set(TERMINAL_CITY_CLUB_PARTS.map((p) => p.height))].sort(
      (a, b) => a - b,
    ),
    [5.5, 11.53, 15.52, 20.3, 21.94, 21.95],
  );
  for (let i = 0; i < TERMINAL_CITY_CLUB_RING.length; i++) {
    const a = TERMINAL_CITY_CLUB_RING[i],
      b = TERMINAL_CITY_CLUB_RING[(i + 1) % TERMINAL_CITY_CLUB_RING.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      mid = new T.Vector3((a[0] + b[0]) / 2, 0.2, (a[1] + b[1]) / 2),
      out = new T.Vector3(dz / len, 0, -dx / len);
    const hits = new T.Raycaster(
      mid.clone().addScaledVector(out, 1),
      out.negate(),
      0,
      2,
    ).intersectObject(root, true);
    assert.ok(
      hits.length,
      "original mapped collision perimeter must be visible",
    );
  }
  const a = TERMINAL_CITY_CLUB_RING[0],
    b = TERMINAL_CITY_CLUB_RING[1],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    out = new T.Vector3(dz / len, 0, -dx / len);
  const eye = new T.Vector3(
    a[0] + (dx / len) * 1.6,
    2.5,
    a[1] + (dz / len) * 1.6,
  ).addScaledVector(out, 1);
  const hits = new T.Raycaster(eye, out.negate(), 0, 3).intersectObject(
    root,
    true,
  );
  const glass = hits.find((h) => (h.object as T.Mesh).material === mats.glass),
    back = hits.find((h) => (h.object as T.Mesh).material === mats.dark);
  assert.ok(glass && back);
  assert.ok(
    back.distance - glass.distance > 0.04,
    "club glass remains ahead of closed backing",
  );
  assert.ok(triangles < 10000);
  console.log({ clubTriangles: triangles, clubBatches: meshes.length });
});
