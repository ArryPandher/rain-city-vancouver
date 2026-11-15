import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  ROBSON_MOUND_FLIGHTS as flights,
  ROBSON_MOUND_RETAINING_EDGES as walls,
  createRobsonMoundCirculationGeometry,
  robsonMoundCirculationHeight as height,
  robsonMoundCirculationBlocked as blocked,
  clipRobsonMoundCirculation,
  ROBSON_MOUND_CIRCULATION_REGIONS as regions,
  robsonMoundCirculationTerrainHeight as soil,
  ROBSON_MOUND_SOIL_MAX as soilMax,
} from "../src/world/robson-mound-circulation";
import { ROBSON_MOUND_CIRCULATION_NODES as nodes } from "../src/world/robson-mound-circulation-data";
import { robsonMoundGeometry } from "../src/world/robson-mound";
const g = createRobsonMoundCirculationGeometry(),
  mesh = new T.Mesh(g, new T.MeshBasicMaterial());
mesh.updateMatrixWorld(true);
const down = (x: number, z: number, object: T.Object3D = mesh) =>
  new T.Raycaster(
    new T.Vector3(x, 20, z),
    new T.Vector3(0, -1, 0),
    0,
    30,
  ).intersectObject(object, true);
test("mapped stair/footway topology has shared landings, bounded rises and no lower-garden changes", () => {
  assert.equal(flights.filter((f) => f.steps).length, 6);
  assert.deepEqual(nodes[0].p, [-129.451401, 49.87]);
  assert.deepEqual(nodes[9].p, [-133.951401, 87.87]);
  for (const f of flights) {
    assert.equal(height(...f.aNode.p), f.aNode.y);
    assert.equal(height(...f.bNode.p), f.bNode.y);
    let previous = f.aNode.y;
    for (const i of f.intervals) {
      if (f.steps) {
        const rise = Math.abs(i.y0 - previous);
        assert.ok(rise <= 0.180001);
        if (rise > 0.0001) assert.ok(rise >= 0.16);
        previous = i.y1;
      }
      assert.ok(i.end > i.start);
    }
  }
  assert.equal(height(-145.66, 128.69), undefined);
  assert.equal(height(-55.78, 34.43), undefined);
  assert.equal(height(0, 0), undefined);
});
test("every actual tread and connecting footway agrees with collision across its width", () => {
  for (const f of flights)
    for (const i of f.intervals)
      for (const q of [0.2, 0.5, 0.8])
        for (const across of [-0.7, 0, 0.7]) {
          const p = f.point(i.start + (i.end - i.start) * q, across),
            hits = down(...p);
          assert.ok(hits.length);
          assert.ok(
            Math.abs(hits[0].point.y - height(...p)!) < 0.002,
            `${f.trace} ${p} ray${hits[0].point.y} sampler${height(...p)}`,
          );
        }
  for (const n of nodes)
    for (let i = 0; i < 8; i++) {
      const x = n.p[0] + 0.7 * Math.cos((i * Math.PI) / 4),
        z = n.p[1] + 0.7 * Math.sin((i * Math.PI) / 4);
      assert.ok(
        Math.abs(down(x, z)[0].point.y - height(x, z)!) < 0.002,
        "junction stays flat and closed",
      );
    }
});
test("integrated soil is cut away from treads, preserving outside heights and smooth normals", () => {
  const original = robsonMoundGeometry(),
    clipped = clipRobsonMoundCirculation(original),
    ground = new T.Mesh(clipped, new T.MeshBasicMaterial());
  ground.updateMatrixWorld(true);
  for (const f of flights)
    for (const i of f.intervals) {
      const p = f.point((i.start + i.end) / 2);
      assert.equal(down(...p, ground).length, 0, "no draped lawn over steps");
    }
  for (const p of [
    [-114, 79],
    [-125, 62],
  ] as [number, number][]) {
    if (height(...p) !== undefined) continue;
    const hits = down(...p, ground);
    assert.ok(hits.length);
    assert.ok(Math.abs(hits[0].point.y - (soil(...p) ?? 0)) < 0.05);
  }
  const normal = clipped.getAttribute("normal");
  for (let i = 0; i < normal.count; i++)
    assert.ok(
      Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) <
        0.001,
    );
});
test("retaining edges are finite barriers while narrow routes stay open on centreline", () => {
  const w = walls.find((w) => w.high - w.low > 0.35)!;
  assert.ok(w);
  const x = (w.a[0] + w.b[0]) / 2,
    z = (w.a[1] + w.b[1]) / 2;
  assert.equal(blocked(x, z, 0.36, w.low), true);
  assert.equal(blocked(x, z, 0.1, w.high + 0.5, true), false);
  assert.equal(blocked(x, z, 0.1, w.high - 0.1, true), true);
  for (const f of flights)
    for (const i of f.intervals) {
      const p = f.point((i.start + i.end) / 2);
      assert.equal(
        blocked(...p, 0.36, height(...p)!),
        false,
        "walking route cannot be blocked by its own retained edges",
      );
    }
});
test("closed metric geometry stays finite and small", () => {
  const p = g.getAttribute("position"),
    n = g.getAttribute("normal"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < p.count; i++)
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
  assert.ok(g.index!.count / 3 < 15000);
  console.log({
    triangles: g.index!.count / 3,
    retainingSegments: walls.length,
  });
});

import clipping from "polygon-clipping";
import { ROBSON_MOUND_OUTLINE as outline } from "../src/world/robson-mound-site";
test("junction ownership has no overlapping top areas and agrees with exact polygon coverage", () => {
  for (let i = 0; i < regions.length; i++)
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i].bounds,
        b = regions[j].bounds;
      if (a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2])
        continue;
      const overlap = clipping.intersection(
        regions[i].polygons,
        regions[j].polygons,
      );
      let area = 0;
      for (const p of overlap)
        for (const r of p)
          for (let k = 0; k < r.length - 1; k++)
            area += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1];
      assert.ok(
        Math.abs(area / 2) < 1e-8,
        "top surfaces are partitioned, never stacked",
      );
    }
  for (const n of nodes)
    for (let dx = -1.307; dx < 1.4; dx += 0.197)
      for (let dz = -1.313; dz < 1.4; dz += 0.193) {
        const x = n.p[0] + dx,
          z = n.p[1] + dz,
          h = height(x, z),
          hits = down(x, z).filter((h) => h.face!.normal.y > 0.5);
        if (h === undefined) {
          assert.equal(hits.length, 0);
          continue;
        }
        assert.ok(hits.length);
        assert.ok(Math.abs(hits[0].point.y - h) < 0.002);
        assert.equal(
          hits.filter((q) => Math.abs(q.point.y - h) < 0.001).length,
          1,
          "no doubled coplanar top with different UVs",
        );
      }
});
test("soil shoulders keep mapped boundary and nonstep paths retain reasonable grades", () => {
  let maximum = 0;
  for (let x = -143; x < -110; x += 0.25)
    for (let z = 54; z < 102; z += 0.25) {
      const h = soil(x, z);
      if (h === undefined) continue;
      assert.ok(h >= 0 && h <= soilMax);
      maximum = Math.max(maximum, h);
    }
  assert.ok(maximum > 4.2, "broad lawn still rises above the highest path");
  // Former forced summit must merge into a broad shoulder, not a compact cone.
  const formerSummit = soil(-126.5, 77.5)!;
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    assert.ok(Math.abs(soil(-126.5 + dx, 77.5 + dz)! - formerSummit) < 0.5);
  for (let i = 0; i < outline.length; i += 2) {
    const j = (i + 2) % outline.length;
    for (const t of [0.1, 0.5, 0.9]) {
      const x = outline[i] * (1 - t) + outline[j] * t,
        z = outline[i + 1] * (1 - t) + outline[j + 1] * t;
      assert.ok(
        Math.abs(soil(x, z) ?? 0) < 1e-5,
        "mapped perimeter still meets existing grade",
      );
    }
  }
  for (const f of flights)
    for (const i of f.intervals) {
      if (!f.steps)
        assert.ok(Math.abs(i.y1 - i.y0) / (i.end - i.start) < 0.121);
      else
        assert.ok(i.end - i.start > 0.28, "no ladder-like compressed treads");
    }
  assert.ok(
    Math.max(...walls.map((w) => w.high - w.low)) < 0.7,
    "soil shoulders replace metre-high trenches",
  );
});

test("clip callback resamples new boundary vertices with the explicit surface offset", () => {
  const clipped = clipRobsonMoundCirculation(
    robsonMoundGeometry(),
    (x, z) => 0.01 * x + 0.02 * z,
    0.075,
  );
  const p = clipped.getAttribute("position");
  assert.ok(p.count > 0);
  for (let i = 0; i < p.count; i++)
    assert.ok(
      Math.abs(p.getY(i) - (0.01 * p.getX(i) + 0.02 * p.getZ(i) + 0.075)) <
        1e-5,
    );
  clipped.dispose();
});

test("overlapping soil shoulders stay continuous outside the owned path polygons", () => {
  let count = 0;
  for (let x = -143; x < -110; x += 0.19)
    for (let z = 54; z < 102; z += 0.19) {
      if (height(x, z) !== undefined) continue;
      const a = soil(x, z),
        b = soil(x + 0.0001, z),
        c = soil(x, z + 0.0001);
      if (a === undefined || b === undefined || c === undefined) continue;
      assert.ok(
        Math.max(Math.abs(a - b), Math.abs(a - c)) < 0.005,
        `soil discontinuity at ${x},${z}`,
      );
      count++;
    }
  assert.ok(count > 10000);
});
