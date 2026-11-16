import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import {
  IRONWORKERS_REPAIR_SHED as d,
  createRepairShedGeometry,
  createRepairShedAssembly,
  preflightRepairShed,
  repairShedWorld,
  repairShedRoofHeight,
} from "../src/world/ironworkers-repair-shed";
import { createIronworkersYardAssembly } from "../src/world/ironworkers-yard";
import { Batcher } from "../src/world/geometry";
import { pointInPoly, segmentPoint, type Building } from "../src/world/data";
const bytes = fs.readFileSync(d.source),
  source = JSON.parse(bytes.toString()),
  bs: Building[] = source.buildings,
  b = bs.find((b) => b.id === d.id)!,
  g = createRepairShedGeometry();
const triangles = Object.values(g).reduce(
  (n, g) => n + (g.index?.count ?? g.attributes.position.count) / 3,
  0,
);
test("exact stepped original source gates one shed and coexists with neighbouring workshop", () => {
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    d.sha256,
  );
  assert.ok(preflightRepairShed(bs));
  const before = JSON.stringify(source),
    dispatch = createRepairShedAssembly(bs),
    neighbour = createIronworkersYardAssembly(bs),
    batch = new Batcher(new T.Group(), 270);
  batch.offsetY = 2.3;
  let shed = 0,
    workshop = 0;
  for (const b of bs) {
    if (dispatch(b, batch)) shed++;
    if (neighbour(b, batch)) workshop++;
  }
  assert.equal(shed, 1);
  assert.equal(workshop, 1);
  const groups = batch.groups.size;
  dispatch(b, batch);
  assert.equal(batch.groups.size, groups);
  assert.equal(batch.offsetY, 2.3);
  assert.equal(JSON.stringify(source), before);
  assert.equal(batch.finish().length, 9);
  for (const variant of ["absent", "duplicate", "edited", "height", "kind"]) {
    const copy = structuredClone([b]);
    if (variant === "absent") copy.pop();
    if (variant === "duplicate") copy.push(copy[0]);
    if (variant === "edited") copy[0].pts[4] += 0.1;
    if (variant === "height") copy[0].height = 20;
    if (variant === "kind") copy[0].kind = "warehouse";
    assert.equal(preflightRepairShed(copy), false);
    const empty = new Batcher(new T.Group());
    assert.equal(createRepairShedAssembly(copy)(b, empty), false);
    assert.equal(empty.groups.size, 0);
  }
});
test("segmented roof lights, paired halls, lean-to and walls close the complete original ring", () => {
  const edges = new Map<string, number>();
  let volume = 0;
  for (const geo of [g.shell, g.roof, g.lights]) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const ps = Array.from({ length: 3 }, (_, j) =>
        new T.Vector3().fromBufferAttribute(p, i + j),
      );
      volume += ps[0].dot(ps[1].clone().cross(ps[2])) / 6;
      for (let j = 0; j < 3; j++) {
        const k = [ps[j], ps[(j + 1) % 3]]
          .map((p) => p.toArray().join(","))
          .sort()
          .join("|");
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
  }
  const bad = [...edges].filter(([, n]) => n !== 2);
  assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 8)));
  assert.ok(volume > 10000);
  assert.ok(triangles < 1600, `cost ${triangles}`);
  const meshes = [g.shell, g.roof, g.lights].map((g) => {
    const m = new T.Mesh(g, new T.MeshBasicMaterial());
    m.updateMatrixWorld(true);
    return m;
  });
  // Every original exterior face must be visible to a front-sided outside ray,
  // including the short re-entrant eastern step.
  for (let i = 0; i < d.pts.length; i += 2) {
    const j = (i + 2) % d.pts.length;
    const dx = d.pts[j] - d.pts[i],
      dz = d.pts[j + 1] - d.pts[i + 1];
    const n = new T.Vector3(-dz, 0, dx).normalize();
    const middle = new T.Vector3(
      (d.pts[i] + d.pts[j]) / 2,
      3,
      (d.pts[i + 1] + d.pts[j + 1]) / 2,
    );
    const hit = new T.Raycaster(
      middle.clone().addScaledVector(n, 0.25),
      n.clone().negate(),
      0,
      0.5,
    ).intersectObjects(meshes)[0];
    assert.ok(hit, `outward source face ${i / 2}`);
    assert.ok(hit.face!.normal.dot(n) > 0.999);
  }
  let samples = 0;
  for (let u = 0.5; u < 35; u += 1)
    for (let v = 0; v < 61; v += 1.5) {
      const [x, , z] = repairShedWorld(u, v);
      if (!pointInPoly(x, z, d.pts)) continue;
      const hit = new T.Raycaster(
        new T.Vector3(x, 20, z),
        new T.Vector3(0, -1, 0),
      ).intersectObjects(meshes)[0];
      assert.ok(hit, `${u},${v}`);
      assert.ok(Math.abs(hit.point.y - repairShedRoofHeight(u)) < 0.001);
      samples++;
    }
  assert.ok(samples > 1100);
  assert.equal(g.lights.attributes.position.count > 0, true);
  const [x, , z] = repairShedWorld(10, 20);
  assert.ok(
    new T.Raycaster(
      new T.Vector3(x, -1, z),
      new T.Vector3(0, 1, 0),
    ).intersectObjects(meshes).length,
  );
});
test("all surfaces retain yard contact and the source footprint including eastern step", () => {
  let maxOutside = 0;
  for (const geo of Object.values(g)) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        y = p.getY(i);
      assert.ok(y >= -1e-5 && y < 9.7);
      if (!pointInPoly(x, z, d.pts)) {
        let distance = Infinity;
        for (let j = 0; j < d.pts.length; j += 2) {
          const k = (j + 2) % d.pts.length;
          distance = Math.min(
            distance,
            segmentPoint(x, z, d.pts[j], d.pts[j + 1], d.pts[k], d.pts[k + 1])
              .d,
          );
        }
        maxOutside = Math.max(maxOutside, distance);
      }
    }
  }
  assert.ok(maxOutside < 0.1, `only shallow end panels: ${maxOutside}`);
  const sourceBefore = JSON.stringify({
    ocean: source.ocean,
    areas: source.areas,
  });
  createRepairShedAssembly(bs)(b, new Batcher(new T.Group()));
  assert.equal(
    JSON.stringify({ ocean: source.ocean, areas: source.areas }),
    sourceBefore,
  );
});
