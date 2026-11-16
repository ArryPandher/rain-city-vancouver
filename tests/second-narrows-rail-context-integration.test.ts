import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { World } from "../src/world/world";
import { CollisionWorld } from "../src/world/collision";
import { bounds, isStreet, type CityData } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import { railContextTop } from "../src/world/second-narrows-rail-context-data";

const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver-east.json", "utf8"),
);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const tags = JSON.parse(
  fs.readFileSync("public/data/vancouver-building-tags.json", "utf8"),
).buildings;
for (const b of data.buildings) {
  const levels = b.levels;
  Object.assign(b, tags[b.id], { levels: levels ?? tags[b.id]?.levels });
}
const baseline = new CollisionWorld(data),
  candidate = new CollisionWorld(data);
baseline.railContext = null;
const c = candidate.railContext!;
assert.ok(c);
const original = JSON.stringify(data),
  originalBounds = { ...bounds };
Object.assign(bounds, { maxX: 8200, minZ: -5600, maxZ: 2200 });
const mat = (name: string) => new T.MeshStandardMaterial({ name });
const materials = {
  texture: () => new T.Texture(),
  pbr: (name: string) => mat(name),
  grass: mat("grass"),
  concrete: mat("concrete"),
  stone: mat("stone"),
  asphalt: mat("asphalt"),
  yellow: mat("yellow"),
} as unknown as Materials;
function world(collision: CollisionWorld, roads = data.roads) {
  return Object.assign(Object.create(World.prototype), {
    data: { ...data, roads },
    collision,
    root: new T.Group(),
    chunks: [],
    materials,
    facadeMultiDraw: false,
    forestHabitat: { woodland: [] },
    stats: { roads: 0 },
    vehicleSurfaceSupport: false,
  }) as World;
}
function signature(meshes: T.Mesh[]) {
  return meshes
    .map((m) => {
      const h = createHash("sha256");
      for (const [name, a] of Object.entries(m.geometry.attributes)) {
        h.update(name);
        h.update(
          Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength),
        );
      }
      if (m.geometry.index)
        h.update(Buffer.from(m.geometry.index.array.buffer));
      return [(m.material as T.Material).name, h.digest("hex")].join(":");
    })
    .sort();
}

test("actual World ground replaces the exact bank mask once and preserves external terrain/water rays", () => {
  try {
    const old = world(baseline),
      next = world(candidate);
    old.terrain();
    next.terrain();
    old.root.updateMatrixWorld(true);
    next.root.updateMatrixWorld(true);
    const ray = (w: World, x: number, z: number) =>
      new T.Raycaster(
        new T.Vector3(x, 50, z),
        new T.Vector3(0, -1, 0),
        0,
        60,
      ).intersectObject(w.root, true);
    let interior = 0;
    for (const s of [21, 35, 80, 150, 212, 300, 400, 500, 620])
      for (const u of [-5, 5]) {
        const [x, , z] = c.point(s, u, 0),
          y = c.sampleSurface(x, z)!;
        const hits = ray(next, x, z);
        assert.ok(hits.length);
        assert.ok(
          Math.abs(hits[0].point.y - y) < 0.0001,
          `${s}/${u} ${hits[0].point.y} vs${y}`,
        );
        assert.equal(
          hits.filter((h) => Math.abs(h.point.y - y) < 0.0001).length,
          1,
          "no duplicate bank/floor surfaces",
        );
        assert.equal(
          hits.filter((h) => h.point.y < y - 0.01).length,
          0,
          "overlapped legacy ground was cut",
        );
        interior++;
      }
    assert.equal(interior, 18);
    for (const s of [30, 100, 212, 400, 620])
      for (const sign of [-1, 1]) {
        const [x, , z] = c.point(s, sign * (c.halfWidth(s, sign) + 1), 0);
        assert.deepEqual(
          ray(next, x, z).map((h) => Number(h.point.y.toFixed(8))),
          ray(old, x, z).map((h) => Number(h.point.y.toFixed(8))),
        );
        assert.equal(candidate.groundHeight(x, z), baseline.groundHeight(x, z));
      }
    for (const [x, z] of [
      [6932.7, -1216.8],
      [6936.85, -1368.675],
      [6940, -1500],
      [7040, -1690],
    ]) {
      assert.deepEqual(
        ray(next, x, z).map((h) => Number(h.point.y.toFixed(8))),
        ray(old, x, z).map((h) => Number(h.point.y.toFixed(8))),
      );
      assert.equal(candidate.water(x, z), baseline.water(x, z));
    }
    assert.equal(next.chunks.filter((m) => m.userData.railContext).length, 5);
    assert.equal(JSON.stringify(data), original);
  } finally {
    Object.assign(bounds, originalBounds);
  }
});

test("actual World elevated road triangles and their finite deck contact remain exact", () => {
  const ids = ["w23795563", "w1275279652", "w35260598", "w62125826"];
  const roads = data.roads.filter((r) => ids.includes(r.id!));
  assert.equal(roads.length, 4);
  const old = world(baseline, roads),
    next = world(candidate, roads);
  old.roads();
  next.roads();
  assert.deepEqual(signature(next.chunks), signature(old.chunks));
  for (const r of roads)
    for (let i = 2; i < r.pts.length; i += 2) {
      const ax = r.pts[i - 2],
        az = r.pts[i - 1],
        dx = r.pts[i] - ax,
        dz = r.pts[i + 1] - az,
        len = Math.hypot(dx, dz);
      for (let s = 0; s < len; s += 3) {
        const x = ax + (dx * s) / len,
          z = az + (dz * s) / len;
        for (const y of [
          baseline.height(x, z) - 0.25,
          baseline.height(x, z),
          baseline.height(x, z) + 10,
        ])
          assert.equal(
            candidate.height(x, z, y),
            baseline.height(x, z, y),
            `${r.id}@${x},${z}/${y}`,
          );
      }
    }
  const under = [6945.04, -1731.31] as const;
  assert.equal(candidate.groundHeight(...under), 0);
  assert.equal(
    candidate.walkingHeight(...under, 0),
    baseline.walkingHeight(...under, 0),
  );
  assert.equal(
    candidate.blocked(...under, 0.36, 0),
    baseline.blocked(...under, 0.36, 0),
  );
  assert.equal(
    candidate.cameraBlocked(...under, 0.2, 1.7),
    baseline.cameraBlocked(...under, 0.2, 1.7),
  );
});

test("bank retaining face blocks low body/camera while actual ballast/sleeper surfaces support a gradual ordinary approach", () => {
  const [x, , z] = c.point(20.5, 0, 0);
  assert.equal(candidate.blocked(x, z, 0.36, 0), true);
  assert.equal(candidate.cameraBlocked(x, z, 0.2, 1.7), true);
  assert.equal(c.blocked(x, z, 0.2, 20, true), false);
  // Approach inward from the unchanged yard in small ordinary walking steps.
  let y = 0;
  for (let s = 650; s >= 30; s -= 0.08) {
    const [px, , pz] = c.point(s, 2.7, 0);
    const next = candidate.walkingHeight(px, pz, y);
    assert.ok(next - y < 0.04, "no abrupt ground promotion");
    assert.ok(Math.abs(next - (railContextTop(s) - 0.7)) < 0.004);
    assert.equal(candidate.blocked(px, pz, 0.36, y), false);
    y = next;
  }
  // A walker already on the shoulder may step onto the real ballast/sleeper
  // top; support comes from actual geometry, not an invisible rail-plane slab.
  const p = c.point(100, 0, 0),
    floor = railContextTop(100) - 0.7;
  const actual = new T.Group();
  for (const g of Object.values(c.parts))
    actual.add(new T.Mesh(g, new T.MeshBasicMaterial()));
  actual.updateMatrixWorld(true);
  const hits = new T.Raycaster(
    new T.Vector3(p[0], 20, p[2]),
    new T.Vector3(0, -1, 0),
  ).intersectObject(actual, true);
  const contact = c.support(p[0], p[2], floor);
  assert.ok(contact !== undefined && contact > floor + 0.35);
  assert.ok(hits.some((h) => Math.abs(h.point.y - contact) < 0.0001));
  // No upward teleport to the20m continuation from the service-ground level.
  const open = c.point(10, 0, 0);
  assert.equal(c.support(open[0], open[2], 0), undefined);
});

test("three actual World service ribbons match rendered ground, walking contact and source junction grade", () => {
  const ids = ["w24007615", "w1265138308", "w1265138309"];
  const roads = data.roads.filter((r) => ids.includes(r.id!));
  assert.equal(roads.length, 3);
  const w = world(candidate, roads);
  w.roads();
  w.root.updateMatrixWorld(true);
  const ray = (x: number, z: number) =>
    new T.Raycaster(
      new T.Vector3(x, 30, z),
      new T.Vector3(0, -1, 0),
      0,
      40,
    ).intersectObject(w.root, true);
  let sampled = 0;
  for (const r of roads)
    for (let i = 2; i < r.pts.length; i += 2) {
      const ax = r.pts[i - 2],
        az = r.pts[i - 1],
        dx = r.pts[i] - ax,
        dz = r.pts[i + 1] - az,
        l = Math.hypot(dx, dz);
      for (let s = 0.5; s < l - 0.5; s += 2)
        for (const u of [-1.5, 0, 1.5]) {
          const x = ax + (dx * s) / l + (dz / l) * u,
            z = az + (dz * s) / l - (dx / l) * u,
            ground = c.sampleSurface(x, z);
          if (ground === undefined) continue;
          const hits = ray(x, z);
          assert.ok(hits.length, `${r.id} road ray ${x},${z}`);
          const offset = isStreet(r) ? 0.092 : r.walkway ? 0.15 : 0.07;
          const asphalt = hits.find(
            (h) => Math.abs(h.point.y - ground - offset) < 0.001,
          );
          assert.ok(
            asphalt,
            `${r.id} visible road ${x},${z}, ground ${ground}, hits ${hits.map((h) => h.point.y)}`,
          );
          assert.ok(
            Math.abs(candidate.walkingHeight(x, z, ground) - asphalt.point.y) <
              0.001,
            `${r.id} walking contact`,
          );
          sampled++;
        }
    }
  assert.ok(sampled > 250);
  assert.equal(JSON.stringify(data), original);
});
