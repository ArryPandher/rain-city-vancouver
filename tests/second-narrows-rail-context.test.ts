import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import pc from "polygon-clipping";
import { createSecondNarrowsRailContext } from "../src/world/second-narrows-rail-context";
import {
  SECOND_NARROWS_CONTEXT as D,
  railContextTop,
  railContextPoint,
} from "../src/world/second-narrows-rail-context-data";
import { SECOND_NARROWS_RAIL as bridge } from "../src/world/second-narrows-rail-bridge";
import type { CityData } from "../src/world/data";
const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver-east.json", "utf8"),
);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const before = JSON.stringify(data),
  c = createSecondNarrowsRailContext(data)!;
assert.ok(c);
const mesh = new T.Mesh(c.parts.ground, new T.MeshBasicMaterial());
mesh.updateMatrixWorld();
const down = (x: number, z: number) =>
  new T.Raycaster(
    new T.Vector3(x, 40, z),
    new T.Vector3(0, -1, 0),
    0,
    45,
  ).intersectObject(mesh, false);

test("exact north rail tie, restrained adapted grade and stock-yard endpoint retain immutable source", () => {
  assert.ok(
    Math.hypot(
      ...railContextPoint(0).map((v, i) => v - bridge.railPoints.at(-1)![i]),
    ) < 1e-6,
  );
  assert.equal(railContextTop(0), 9.6);
  assert.ok(Math.abs(railContextTop(650) - 0.7) < 1e-12);
  let last = 9.6;
  for (let s = 0; s <= 650; s += 0.25) {
    const top = railContextTop(s);
    assert.ok(top <= last + 1e-12);
    assert.ok((last - top) / 0.25 <= 0.01484);
    last = top;
  }
  assert.equal(JSON.stringify(data), before);
  assert.equal(
    createSecondNarrowsRailContext({ ...data, buildings: [] }),
    null,
  );
  assert.equal(createSecondNarrowsRailContext({ ...data, roads: [] }), null);
  assert.equal(c.stats.batches, 5);
  assert.ok(c.stats.triangles < 45000);
});

test("every bank triangle faces up and exact rendered barycentric samples match shared support", () => {
  let count = 0;
  for (const {
    points: [a, b, d],
  } of c.triangles) {
    const cross = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...d).sub(new T.Vector3(...a)));
    assert.ok(cross.y > 0);
    const x = (a[0] + b[0] + d[0]) / 3,
      z = (a[2] + b[2] + d[2]) / 3,
      y = (a[1] + b[1] + d[1]) / 3;
    assert.ok(
      Math.abs(c.sampleSurface(x, z)! - y) < 0.00001,
      `${count}: ${x},${z}: surface ${c.sampleSurface(x, z)} expected ${y}`,
    );
    if (count++ % 29 === 0) {
      const hits = down(x, z);
      assert.ok(hits.length);
      assert.ok(Math.abs(hits[0].point.y - y) < 0.00001);
    }
  }
  assert.ok(count > 4000);
  // Flat shoulder underneath ballast and exposed outside edges all use one
  // profile. Float32 boundary positions are used for actual mesh contacts.
  for (const s of c.stations.filter((s) => s >= D.bankStart)) {
    for (const sign of [-1, 1]) {
      const p = c.point(s, sign * c.halfWidth(s, sign), 0).map(Math.fround);
      assert.ok(Math.abs(c.sampleSurface(p[0], p[2]) ?? 0) < 0.002);
    }
  }
  assert.equal(c.sampleSurface(0, 0), undefined);
  assert.equal(c.sampleSurface(NaN, 0), undefined);
});

test("bank preserves water, all building pads and service underpass while roads share the constrained grade", () => {
  for (const o of data.ocean) {
    const ring = Array.from(
      { length: o.length / 2 },
      (_, i) => [o[2 * i], o[2 * i + 1]] as [number, number],
    );
    assert.deepEqual(pc.intersection([ring], c.masks), []);
  }
  const box = c.parts.ground.boundingBox!;
  for (const b of data.buildings) {
    const ring = Array.from(
      { length: b.pts.length / 2 },
      (_, i) => [b.pts[2 * i], b.pts[2 * i + 1]] as [number, number],
    );
    if (
      ring.every((p) => p[0] < box.min.x) ||
      ring.every((p) => p[0] > box.max.x) ||
      ring.every((p) => p[1] < box.min.z) ||
      ring.every((p) => p[1] > box.max.z)
    )
      continue;
    for (const triangle of c.nearbyGround([
      Math.min(...ring.map((p) => p[0])),
      Math.min(...ring.map((p) => p[1])),
      Math.max(...ring.map((p) => p[0])),
      Math.max(...ring.map((p) => p[1])),
    ])) {
      if (Math.max(...triangle.points.map((p) => p[1])) < 1e-5) continue;
      assert.deepEqual(
        pc.intersection(
          [ring],
          [triangle.points.map((p) => [p[0], p[2]] as [number, number])],
        ),
        [],
        b.id,
      );
    }
  }
  for (const id of ["w24007615", "w1265138308", "w1265138309"]) {
    const r = data.roads.find((r) => r.id === id)!;
    for (let i = 2; i < r.pts.length; i += 2) {
      const ax = r.pts[i - 2],
        az = r.pts[i - 1],
        dx = r.pts[i] - ax,
        dz = r.pts[i + 1] - az,
        length = Math.hypot(dx, dz);
      for (let s = 0; s <= length; s += 0.5)
        for (const u of [-4.7, -2.2, 0, 2.2, 4.7]) {
          const x = ax + (dx * s) / length + (dz / length) * u,
            z = az + (dz * s) / length - (dx / length) * u;
          const centre =
            c.sampleSurface(ax + (dx * s) / length, az + (dz * s) / length) ??
            0;
          assert.ok(
            Math.abs((c.sampleSurface(x, z) ?? 0) - centre) < 0.025,
            `${id} crossfall at ${x},${z}`,
          );
        }
    }
  }
  // Sign matters: service road is south of the current bridge end, not north.
  const under = railContextPoint(-7.4);
  assert.equal(c.sampleSurface(...under), undefined);
  const first = c.point(10, 0, 0);
  assert.ok(
    Math.abs(c.sampleSurface(first[0], first[2])! - 4.45) < 0.02,
    "visible front earth rises continuously below the retained rail girders",
  );
});

test("northbound downhill members retain upright cross sections and ballast remains below sleepers and rails", () => {
  const meshes = Object.fromEntries(
    Object.entries(c.parts).map(([role, g]) => {
      const mesh = new T.Mesh(g, new T.MeshBasicMaterial());
      mesh.updateMatrixWorld();
      return [role, mesh];
    }),
  );
  const top = (role: string, s: number, u = 0) => {
    const p = c.point(s, u, 0);
    return new T.Raycaster(
      new T.Vector3(p[0], 30, p[2]),
      new T.Vector3(0, -1, 0),
      0,
      40,
    ).intersectObject(meshes[role], false)[0]?.point.y;
  };
  for (const s of [20.4, 50, 100, 211.6, 399.6, 600.4, 649.2]) {
    assert.ok(
      Math.abs(top("ballast", s)! - (railContextTop(s) - 0.3)) < 0.002,
      `ballast${s}`,
    );
    for (const u of [-0.7175, 0.7175])
      assert.ok(
        Math.abs(top("steel", s, u)! - railContextTop(s)) < 0.003,
        `rail${s}/${u}`,
      );
    const tie = top("timber", s);
    if (tie !== undefined)
      assert.ok(Math.abs(tie - (railContextTop(s) - 0.18)) < 0.003);
  }
});

test("bank front is a continuous visible earth slope with a finite concrete bearing", () => {
  for (const t of c.triangles) {
    const [a, b, d] = t.points,
      n = new T.Vector3(...b)
        .sub(new T.Vector3(...a))
        .cross(new T.Vector3(...d).sub(new T.Vector3(...a)));
    assert.ok(
      (Math.atan2(Math.hypot(n.x, n.z), n.y) * 180) / Math.PI < 43,
      "no thin artificial soil cliff",
    );
  }
  const concrete = c.parts.concrete.getAttribute("position");
  const cap = c.point(D.bankStart, 0, 0);
  for (let i = 0; i < concrete.count; i++) {
    assert.ok(
      Math.hypot(concrete.getX(i) - cap[0], concrete.getZ(i) - cap[2]) < 3.5,
      "only the finite bearing cap is concrete, no full-width retaining wall",
    );
    assert.ok(concrete.getY(i) > 7.8);
  }
  // This is the failing native viewing side: all broad front hits must now be
  // real upward-facing earth triangles, with continuous ground contact below.
  let checked = 0;
  for (let u = -12; u <= 12; u += 0.5) {
    const a = c.point(-2, u, 0),
      b = c.point(30, u, 0);
    const ray = new T.Raycaster(
      new T.Vector3(a[0], 2, a[2]),
      new T.Vector3(b[0] - a[0], 0, b[2] - a[2]).normalize(),
      0,
      40,
    );
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit, `earth visible from front ${u}`);
    assert.ok(hit.face!.normal.y > 0.72);
    assert.ok(
      Math.abs(c.sampleSurface(hit.point.x, hit.point.z)! - hit.point.y) < 1e-5,
    );
    checked++;
  }
  assert.equal(checked, 49);
  let previous = 0;
  for (let s = 0; s <= 20; s += 0.1) {
    const p = c.point(s, 0, 0),
      y = c.sampleSurface(p[0], p[2]) ?? 0;
    assert.ok(
      y >= previous - 0.005 && y - previous < 0.072,
      `continuous toe ${s}`,
    );
    previous = y;
  }
});
