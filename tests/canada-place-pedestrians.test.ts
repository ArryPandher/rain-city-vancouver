import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { ORIGIN, KX, type CityData } from "../src/world/data";
import {
  createCanadaPedestrianCircuit,
  canadaPedestrianPoint,
  advanceCanadaPedestrian,
  CANADA_PEDESTRIAN_SLOTS,
  PEDESTRIAN_POOL_LIMIT,
} from "../src/game/canada-place-pedestrians";
import { Actors, type Pedestrian } from "../src/game/actors";
import type { World } from "../src/world/world";
function collision(loaded = true) {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const c = new CollisionWorld(data);
  if (loaded)
    c.setCanadaPlaceCapabilities(
      canadaPlaceCapabilities(true, true, true, true),
    );
  return c;
}
const ground = collision();
test("rounded fixed two-lane circuit has continuous supported radius0.4 on actual loaded map", (t) => {
  const c = createCanadaPedestrianCircuit(ground);
  assert.ok(c);
  assert.ok(c.length > 170 && c.length < 180);
  let samples = 0;
  for (let d = 0; d < c.length; d += 0.1) {
    const p = canadaPedestrianPoint(c, d);
    assert.equal(ground.blocked(p.x, p.z, 0.4, 7.88), false);
    assert.equal(ground.water(p.x, p.z, 7.88), false);
    assert.ok(Math.abs(ground.height(p.x, p.z, 7.88) - 7.88) < 0.001);
    samples++;
  }
  const a = canadaPedestrianPoint(c, c.length - 0.01),
    b = canadaPedestrianPoint(c, 0.01);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.021);
  const before = canadaPedestrianPoint(c, -0.001),
    after = canadaPedestrianPoint(c, 0.001);
  assert.ok(
    Math.cos(after.heading - before.heading) > 0.98,
    "wrap turns gradually instead of reversing",
  );
  assert.equal(
    createCanadaPedestrianCircuit(collision(false)),
    null,
    "unloaded original pier remains blocked",
  );
  t.diagnostic(
    `${samples} 0.1m samples; ${c.length.toFixed(3)}m rounded circuit`,
  );
});
test("panic obeys clearance, down stays put, and waiting produces zero animation speed", () => {
  const c = createCanadaPedestrianCircuit(ground)!;
  const state = { distance: 5, panic: 0, down: 0 },
    p = canadaPedestrianPoint(c, 5);
  const walk = advanceCanadaPedestrian(c, state, 0.05, ground, []);
  assert.ok(Math.abs(walk.distance - 5 - 0.06) < 1e-8);
  const run = advanceCanadaPedestrian(
    c,
    { ...state, panic: 8 },
    0.05,
    ground,
    [],
  );
  assert.ok(Math.abs(run.distance - 5 - 0.24) < 1e-8);
  for (const radius of [0.8, 2.8]) {
    const wait = advanceCanadaPedestrian(
      c,
      { ...state, panic: 8 },
      0.05,
      ground,
      [{ ...p, radius }],
    );
    assert.equal(wait.distance, 5);
    assert.equal(wait.speed, 0);
  }
  const down = advanceCanadaPedestrian(
    c,
    { ...state, down: 4 },
    0.05,
    ground,
    [],
  );
  assert.equal(down.distance, 5);
  assert.equal(down.speed, 0);
  const wrap = advanceCanadaPedestrian(
    c,
    { ...state, distance: c.length - 0.03 },
    0.05,
    ground,
    [],
  );
  assert.ok(Math.abs(wrap.distance - 0.03) < 1e-8);
});
function actors() {
  const a = new Actors({ collision: ground } as World);
  a.canadaCircuit = createCanadaPedestrianCircuit(ground);
  const speeds: number[] = [];
  for (let i = 0; i < 6; i++) {
    const distance = (i * a.canadaCircuit!.length) / 6,
      p = canadaPedestrianPoint(a.canadaCircuit!, distance),
      group = new T.Group();
    group.position.set(p.x, 7.88, p.z);
    a.peds.push({
      canadaDistance: distance,
      character: { group, update: (_t: number, s: number) => speeds.push(s) },
      road: { pts: [] },
      side: 1,
      segment: 0,
      t: 0,
      direction: 1,
      panic: 0,
      down: 0,
    } as unknown as Pedestrian);
  }
  return { a, speeds };
}
test("actual Actors keeps reserved identities/progress through fast travel, panic/down and idle animation", () => {
  const { a, speeds } = actors(),
    p = a.peds[0],
    at = p.character.group.position.clone();
  p.down = 4;
  p.panic = 8;
  const ids = [...a.peds],
    distances = a.peds.map((p) => p.canadaDistance);
  a.recycle(new T.Vector3(1500, 0, 1500), null, true);
  assert.deepEqual(a.peds, ids);
  assert.deepEqual(
    a.peds.map((p) => p.canadaDistance),
    distances,
  );
  assert.equal(p.down, 4);
  assert.equal(p.panic, 8);
  a.update(0.05, at.clone().add(new T.Vector3(0, 0, 10)), null);
  assert.equal(p.canadaDistance, 0);
  assert.ok(p.down < 4);
  p.down = 0;
  p.panic = 0;
  speeds.length = 0;
  a.update(0.05, at, null);
  assert.equal(p.canadaDistance, 0);
  assert.equal(speeds[0], 0);
  a.update(0.05, at.clone().add(new T.Vector3(0, 0, 10)), null);
  assert.ok(p.canadaDistance! > 0);
  assert.equal(a.peds.length, CANADA_PEDESTRIAN_SLOTS);
});
test("full existing NPC pool is never expanded by promenade population", () => {
  const { a } = actors();
  while (a.peds.length < 34)
    a.peds.push({ ...a.peds[0], canadaDistance: undefined });
  a.place = () => null;
  const ids = [...a.peds];
  a.populate(470, -590);
  assert.equal(a.peds.length, PEDESTRIAN_POOL_LIMIT);
  assert.deepEqual(a.peds, ids);
});

test("invalid/large/tiny timesteps stay bounded and lower-road vehicles do not stop deck walkers", () => {
  const c = createCanadaPedestrianCircuit(ground)!,
    state = { distance: 5, panic: 0, down: 0 },
    p = canadaPedestrianPoint(c, 5);
  for (const dt of [NaN, Infinity, -1, 0, 10]) {
    const next = advanceCanadaPedestrian(c, state, dt, ground, []);
    assert.equal(next.distance, 5);
    assert.equal(next.speed, 0);
  }
  const tiny = advanceCanadaPedestrian(c, state, Number.MIN_VALUE, ground, []);
  assert.ok(Number.isFinite(tiny.speed));
  const invalid = advanceCanadaPedestrian(
    c,
    { ...state, distance: NaN },
    0.05,
    ground,
    [],
  );
  assert.ok(Number.isFinite(invalid.distance));
  assert.equal(invalid.speed, 0);
  assert.ok(
    advanceCanadaPedestrian(c, state, 0.05, ground, [
      { ...p, radius: 2.8, y: 0 },
    ]).distance > 5,
  );
  assert.equal(
    advanceCanadaPedestrian(c, state, 0.05, ground, [
      { ...p, radius: 2.8, y: 7.88 },
    ]).distance,
    5,
  );
});

test("requested activity summary preserves stable IDs and exposes waiting and down states", () => {
  const { a } = actors(),
    ids = a.canadaPedestrianSummary().assigned.map((p) => p.id);
  a.peds[0].down = 3;
  a.peds[1].canadaSpeed = 0;
  const snapshot = a.canadaPedestrianSummary();
  assert.equal(snapshot.totalPool, 6);
  assert.equal(snapshot.assigned[0].state, "down");
  assert.equal(snapshot.assigned[1].state, "waiting");
  a.recycle(new T.Vector3(2000, 0, 2000), null, true);
  assert.deepEqual(
    a.canadaPedestrianSummary().assigned.map((p) => p.id),
    ids,
  );
});
