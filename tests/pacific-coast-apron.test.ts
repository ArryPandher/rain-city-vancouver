import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  type CityData,
  pointInPoly,
  roadWidth,
} from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";
import { Batcher } from "../src/world/geometry";
import {
  PACIFIC_COAST_RING as ring,
  PACIFIC_COAST_CENTRE as centre,
  PACIFIC_COAST_ENTRANCE_THRESHOLDS as thresholds,
  pacificCoastBays,
} from "../src/world/pacific-coast-site";
import { PACIFIC_APRON } from "../src/world/pacific-coast-apron-site";
import { buildPacificCoastApron } from "../src/world/pacific-coast-apron";
import { createHowePedestrianCircuits } from "../src/game/howe-pedestrians";

const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
);
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const b of data.buildings) b.pts = convert(b.pts);
for (const a of data.areas) {
  a.pts = convert(a.pts);
  a.holes = a.holes?.map(convert);
}
data.ocean = data.ocean.map(convert);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const collision = new CollisionWorld(data),
  site = collision.pacificApron!;
const datum = collision.baselineGroundHeight(...centre);
const root = new T.Group(),
  batch = new Batcher(root);
batch.offsetY = datum;
const materials = {
  base: new T.MeshStandardMaterial(),
  trim: new T.MeshStandardMaterial(),
  frame: new T.MeshStandardMaterial(),
};
const counts = buildPacificCoastApron(batch, site, materials),
  meshes = batch.finish();
root.updateMatrixWorld(true);
const c = facadeFrame(ring[0], ring[1]),
  h = facadeFrame(ring[1], ring[2]);
const near = (a: number, b: number, e = 0.0001) =>
  assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const floorHit = (x: number, z: number) =>
  new T.Raycaster(new T.Vector3(x, 12, z), new T.Vector3(0, -1, 0), 0, 6)
    .intersectObject(root, true)
    .find((hit) => (hit.object as T.Mesh).material === materials.base)!;

test("apron is source-bounded outside the unchanged footprint and stops before both entrance thresholds", () => {
  assert.ok(site);
  for (const tri of site.triangles) {
    const x = tri.reduce((n, p) => n + p[0], 0) / 3,
      z = tri.reduce((n, p) => n + p[2], 0) / 3;
    assert.equal(
      pointInPoly(x, z, ring.flat()),
      false,
      "do not occupy or open the closed building",
    );
    assert.ok(
      site.height(x, z)! >= collision.baselineGroundHeight(x, z) - 0.0001,
    );
  }
  for (const [index, threshold] of Object.entries(thresholds)) {
    const p = h.p(pacificCoastBays(1)[Number(index)].centre, 0, -0.3);
    assert.equal(site.height(p[0], p[2]), undefined);
    near(collision.height(p[0], p[2]), collision.groundHeight(p[0], p[2]));
    assert.ok(datum + threshold - collision.height(p[0], p[2]) < 0.055);
  }
  near(collision.groundHeight(...centre), datum);
  for (const p of [
    [430, -397],
    [410, -370],
    [455, -440],
    [440, -420],
  ])
    assert.equal(site.height(p[0], p[1]), undefined);
});

test("rendered apron triangles exactly match walking/vehicle support without changing construction grade", () => {
  for (const f of [c, h])
    for (const u of f === c ? [1, 4, 8, 12, 15] : [0.5, 2, 4, 6, 8.4]) {
      for (const depth of [0.45, 0.85]) {
        const p = f.p(u, 0, -depth),
          support = site.height(p[0], p[2])!;
        assert.ok(Number.isFinite(support));
        near(floorHit(p[0], p[2]).point.y, support);
        near(collision.walkingHeight(p[0], p[2]), support);
        near(collision.height(p[0], p[2]), support);
        near(
          collision.groundHeight(p[0], p[2]),
          collision.baselineGroundHeight(p[0], p[2]),
        );
      }
    }
  for (const tri of site.triangles)
    for (const p of tri)
      assert.ok(
        site.height(Math.fround(p[0]), Math.fround(p[2])) !== undefined,
        "float boundary remains supported",
      );
});

test("Howe entry is open and the ramp joins the actual sidewalk continuously", () => {
  for (const d of [0.45, 0.525, 0.6]) {
    const before = h.p(PACIFIC_APRON.howeLength - 0.002, 0, -d),
      after = h.p(PACIFIC_APRON.howeLength + 0.002, 0, -d);
    near(
      collision.walkingHeight(before[0], before[2]),
      collision.walkingHeight(after[0], after[2]),
      0.002,
    );
  }
  let previous: [number, number, number] | undefined;
  for (let u = 9.5; u >= 0; u -= 0.1) {
    const p = h.p(u, 0, -0.525),
      y = collision.walkingHeight(p[0], p[2]);
    assert.equal(
      collision.blocked(p[0], p[2], 0.4, y),
      false,
      `blocked entry/ramp at ${u}`,
    );
    if (previous) {
      assert.ok(
        Math.abs(y - previous[1]) < 0.012,
        "no step or abrupt support jump",
      );
      const moved = collision.move(
        previous[0],
        previous[2],
        p[0] - previous[0],
        p[2] - previous[2],
        0.4,
        previous[1],
      );
      assert.equal(moved.hit, false);
    }
    previous = [p[0], y, p[2]];
  }
});

test("rail prevents walking through raised edges while the outer public route remains clear", () => {
  const front = c.p(8, 0, -1.5),
    y = collision.groundHeight(front[0], front[2]);
  assert.equal(collision.blocked(front[0], front[2], 0.4, y), true);
  const outside = c.p(8, 0, -2.1),
    inside = c.p(8, 0, -0.75);
  assert.equal(
    collision.move(
      outside[0],
      outside[2],
      inside[0] - outside[0],
      inside[2] - outside[2],
      0.4,
      y,
    ).hit,
    true,
  );
  for (let u = 0; u <= 11; u += 0.5) {
    const p = h.p(u, 0, -1.6),
      y = collision.walkingHeight(p[0], p[2]);
    assert.equal(
      collision.blocked(p[0], p[2], 0.4, y),
      false,
      `outer Howe route ${u}`,
    );
    const road = collision.nearestRoad(p[0], p[2], 30)!;
    assert.ok(
      road.d - roadWidth(road.road) / 2 > 0.45,
      "public through-route remains outside carriageway",
    );
  }
  for (const circuit of createHowePedestrianCircuits(collision) ?? [])
    for (const p of circuit.points)
      assert.equal(
        site.height(p.x, p.z),
        undefined,
        "established ambient circuits stay unchanged",
      );
});

test("retaining front reaches below actual grade and the rail posts sit on support", () => {
  const from = c.p(8, site.top - 0.25, -2),
    to = c.p(8, site.top - 0.25, -1.2);
  const direction = new T.Vector3(...to).sub(new T.Vector3(...from));
  const hit = new T.Raycaster(
    new T.Vector3(...from),
    direction.clone().normalize(),
    0,
    direction.length(),
  ).intersectObject(root, true)[0];
  assert.equal((hit.object as T.Mesh).material, materials.base);
  assert.ok(
    hit.face!.normal.dot(new T.Vector3(c.outward[0], 0, c.outward[1])) > 0.99,
  );
  for (const edge of site.edges) {
    assert.ok(edge.bottomA < collision.groundHeight(edge.a[0], edge.a[2]));
    assert.ok(edge.bottomB < collision.groundHeight(edge.b[0], edge.b[2]));
  }
  for (const rail of site.rails)
    for (const p of [rail.a, rail.b])
      near(p[1] - PACIFIC_APRON.railHeight, site.height(p[0], p[2])!);
});

test("apron keeps three existing material groups and a bounded geometry budget", () => {
  let triangles = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    triangles += mesh.geometry.index!.count / 3;
    for (let i = 0; i < p.count; i++) {
      assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
      near(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)), 1, 0.0001);
    }
  }
  assert.equal(meshes.length, 3);
  assert.ok(triangles < 3000);
  assert.ok(counts.posts >= 14 && counts.posts <= 20);
  console.info(
    JSON.stringify({ triangles, materials: meshes.length, ...counts }),
  );
});
