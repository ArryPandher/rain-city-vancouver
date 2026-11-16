import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createCruiseForwardAssembly,
  CRUISE_FORWARD,
} from "../src/world/canada-cruise-forward";
import { buildLandmarks } from "../src/world/landmarks";
import type { Materials } from "../src/world/materials";
import type { CollisionWorld } from "../src/world/collision";
const assembly = createCruiseForwardAssembly();
const white = new T.Mesh(
    assembly.white,
    new T.MeshBasicMaterial({ name: "white" }),
  ),
  glass = new T.Mesh(
    assembly.glass,
    new T.MeshBasicMaterial({ name: "glass" }),
  );
const group = new T.Group().add(white, glass);
group.updateMatrixWorld(true);
const key = (p: T.BufferAttribute | T.InterleavedBufferAttribute, i: number) =>
  [p.getX(i), p.getY(i), p.getZ(i)].join(",");
test("all retained rounded deck vertices behind the seam are unchanged; source-backed addition stays bounded", () => {
  const old = new Set<string>();
  for (const k of [2, 3, 4]) {
    const y = 17.1 + k * 3.05,
      w = 30 - k * 0.7,
      l = 199 - k * 13,
      z = -5 - k * 3;
    for (const g of [
      new RoundedBoxGeometry(w, 2.8, l, 3, 0.8).translate(0, y, z),
      new RoundedBoxGeometry(w + 0.6, 0.28, l + 0.6, 3, 0.5).translate(
        0,
        y + 1.4,
        z,
      ),
    ]) {
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) if (p.getZ(i) < 50) old.add(key(p, i));
      g.dispose();
    }
  }
  const retained = new Set<string>(),
    p = assembly.white.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
    if (p.getZ(i) < 50) {
      assert.ok(old.has(key(p, i)), key(p, i));
      retained.add(key(p, i));
    }
  }
  assert.deepEqual(retained, old);
  assert.ok(assembly.stats.addedTriangles <= 3000);
  assert.ok(assembly.stats.addedTriangles > 2400);
  const b = new T.Box3().setFromObject(group);
  assert.ok(b.min.x >= -17 && b.max.x <= 17);
  assert.ok(b.min.z >= -98 && b.max.z <= 76);
  assert.ok(b.min.y >= 21.68999 && b.max.y <= 30.84001);
});
test("every recessed pane is first-hit glass from outside, with an outward-sloping bridge and vertical upper rows", () => {
  const p = assembly.glass.getAttribute("position"),
    n = assembly.glass.getAttribute("normal");
  let checked = 0,
    sloped = 0;
  for (let i = 0; i < p.count; i += 3) {
    const c = new T.Vector3();
    for (let j = 0; j < 3; j++)
      c.add(new T.Vector3().fromBufferAttribute(p, i + j));
    c.multiplyScalar(1 / 3);
    const normal = new T.Vector3().fromBufferAttribute(n, i);
    const hits = new T.Raycaster(
      c.clone().addScaledVector(normal, 0.7),
      normal.clone().negate(),
      0,
      1,
    ).intersectObject(group, true);
    assert.ok(
      hits.length && hits[0].object === glass,
      `pane${i / 3} unobscured`,
    );
    assert.ok(Math.abs(hits[0].distance - 0.7) < 1e-4);
    if (Math.abs(normal.x) < 1e-4 && normal.z > 0.9) {
      const level = CRUISE_FORWARD.levels.find(
        (l) => c.y >= l.sill && c.y <= l.head,
      )!;
      assert.ok(level);
      const planeDistance =
        normal.y * (c.y - level.sill) + normal.z * (c.z - level.front);
      assert.ok(
        Math.abs(planeDistance + 0.1) < 1e-4,
        "100mm actual glazing recess",
      );
    }
    if (Math.abs(normal.x) < 1e-4 && c.z > 75 && c.y < 24.22) {
      assert.ok(normal.z > 0.98 && normal.y < -0.12);
      sloped++;
    }
    checked++;
  }
  assert.equal(checked, 210);
  assert.ok(sloped >= 42);
});
test("visible terrace surfaces and mating bulkhead are closed without duplicate horizontal floor planes", () => {
  const p = assembly.white.getAttribute("position"),
    n = assembly.white.getAttribute("normal");
  let roof = 0;
  for (let i = 0; i < p.count; i += 3) {
    const c = new T.Vector3();
    for (let j = 0; j < 3; j++)
      c.add(new T.Vector3().fromBufferAttribute(p, i + j));
    c.multiplyScalar(1 / 3);
    if (c.z <= 50.001 || n.getY(i) < 0.999) continue;
    const hits = new T.Raycaster(
      c.clone().add(new T.Vector3(0, 0.1, 0)),
      new T.Vector3(0, -1, 0),
      0,
      0.2,
    ).intersectObject(group, true);
    assert.ok(hits.length > 0, "supported terrace");
    const same = hits.filter((h) => Math.abs(h.point.y - c.y) < 1e-4);
    assert.equal(same.length, 1, "one visible floor owner");
    roof++;
  }
  assert.ok(roof > 10);
  const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const shell = new T.Mesh(assembly.white, mat);
  shell.updateMatrixWorld(true);
  let joins = 0;
  for (const x of [-13.7, -7, 0, 7, 13.7])
    for (let y = 21.85; y < 30.8; y += 0.075) {
      const hit = new T.Raycaster(
        new T.Vector3(x, y, 50.5),
        new T.Vector3(0, 0, -1),
        0,
        0.51,
      ).intersectObject(shell)[0];
      assert.ok(
        hit && Math.abs(hit.point.z - 50) < 1e-4,
        `sealed back${x},${y}`,
      );
      joins++;
    }
  assert.ok(joins > 500);
});
test("actual ship dispatch removes the old forward blanks and side strips while retaining hull and lower decks", () => {
  const parent = new T.Group(),
    add = parent.add,
    stop = new Error("stop after ship");
  parent.add = function (...o) {
    if (this.children.length) throw stop;
    return add.apply(this, o);
  };
  const m = {
    white: new T.MeshStandardMaterial({ name: "white" }),
    chrome: new T.MeshStandardMaterial(),
    dark: new T.MeshStandardMaterial(),
  } as Materials;
  assert.throws(
    () =>
      buildLandmarks(parent, m, {
        groundHeight: () => 7.88,
      } as unknown as CollisionWorld),
    (e) => e === stop,
  );
  const ship = parent.children[0].children[0];
  const local = new T.Group();
  for (const child of [...ship.children]) local.add(child);
  local.updateMatrixWorld(true);
  const hits = new T.Raycaster(
    new T.Vector3(0.4, 23.17, 80),
    new T.Vector3(0, 0, -1),
    0,
    10,
  ).intersectObject(local, true);
  assert.ok(hits.length > 0);
  assert.notEqual((hits[0].object as T.Mesh).material, m.white);
  assert.ok(hits[0].point.z > 75 && hits[0].point.z < 75.7);
  for (const k of [0, 1]) {
    const y = 17.1 + k * 3.05,
      z = -5 - k * 3 + (199 - k * 13) / 2;
    const hit = new T.Raycaster(
      new T.Vector3(0, y, z + 1),
      new T.Vector3(0, 0, -1),
      0,
      2,
    ).intersectObject(local, true)[0];
    assert.ok(
      hit && Math.abs(hit.point.z - z) < 1e-4,
      "lower original forward deck",
    );
  }
  const hull = local.children[0] as T.Mesh;
  for (const x of [-12, 0, 12])
    for (const z of [52, 60, 72]) {
      const support = new T.Raycaster(
        new T.Vector3(x, 21.9, z),
        new T.Vector3(0, -1, 0),
        0,
        0.3,
      ).intersectObject(local, true)[0];
      assert.ok(
        support &&
          Math.abs(support.point.y - CRUISE_FORWARD.levels[0].bottom) < 1e-5,
        "new bridge floor contacts retained lower deck",
      );
    }
  assert.equal(hull.geometry.getAttribute("position").count, 324);
  assert.equal(hull.geometry.index!.count / 3, 480);
});
