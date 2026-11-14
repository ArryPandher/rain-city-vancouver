import test from "node:test";
import assert from "node:assert/strict";
import { carState, drive, angleDelta } from "../src/game/physics.ts";
import { pointInPoly, segmentPoint, geo, ungeo } from "../src/world/data.ts";
import {
  CollisionWorld,
  BRIDGES,
  bridgeY,
  bridgePoint,
  bridgeSample,
} from "../src/world/collision.ts";
import type { CityData } from "../src/world/data.ts";
const input = { throttle: 1, steering: 0, brake: false, boost: false };
const sim = (dt: number, seconds: number, bike = false) => {
  const s = carState(0, 0);
  for (let i = 0; i < Math.round(seconds / dt); i++) drive(s, input, dt, bike);
  return s;
};
test("full-throttle car reaches road speed and stays within its limit", () => {
  const s = sim(1 / 60, 12);
  assert.ok(s.speed > 30 && s.speed <= 46);
  assert.ok(s.z > 200);
  assert.equal(s.x, 0);
});
test("handling is stable across normal frame rates", () => {
  const a = sim(1 / 30, 8),
    b = sim(1 / 120, 8);
  assert.ok(Math.abs(a.z - b.z) < 2);
  assert.ok(Math.abs(a.speed - b.speed) < 0.2);
});
test("brake stops a moving vehicle and reverse is bounded", () => {
  const s = sim(1 / 60, 6);
  for (let i = 0; i < 180; i++)
    drive(s, { ...input, throttle: 0, brake: true }, 1 / 60);
  assert.ok(Math.abs(s.speed) < 0.1);
  for (let i = 0; i < 900; i++) drive(s, { ...input, throttle: -1 }, 1 / 60);
  assert.ok(s.speed < 0 && s.speed >= -10);
});
test("steering changes the path without generating speed", () => {
  const s = carState(0, 0);
  for (let i = 0; i < 300; i++) drive(s, { ...input, steering: 1 }, 1 / 60);
  assert.ok(s.x > 1);
  assert.ok(s.heading > 0.1);
  assert.ok(Number.isFinite(s.z));
  assert.ok(s.speed < 46);
});
test("bicycle stays at bicycle speeds", () => {
  const s = sim(1 / 60, 40, true);
  assert.ok(s.speed > 10 && s.speed <= 13.8);
});
test("geographic coordinates round trip to metre accuracy", () => {
  const p = geo(49.2886, -123.1116),
    back = ungeo(...p);
  assert.ok(Math.abs(back[0] - 49.2886) < 1e-8);
  assert.ok(Math.abs(back[1] + 123.1116) < 1e-8);
});
test("polygon and nearest segment calculations respect world boundaries", () => {
  assert.equal(pointInPoly(5, 5, [0, 0, 10, 0, 10, 10, 0, 10]), true);
  assert.equal(pointInPoly(15, 5, [0, 0, 10, 0, 10, 10, 0, 10]), false);
  assert.deepEqual(segmentPoint(5, 3, 0, 0, 10, 0), {
    x: 5,
    z: 0,
    t: 0.5,
    d: 3,
  });
});
const empty: CityData = {
  meta: { bbox: [], latC: 0, pxPerMeter: 2, w: 1, h: 1, fetched: "" },
  buildings: [{ id: "box", pts: [0, 0, 10, 0, 10, 10, 0, 10] }],
  roads: [],
  areas: [],
  trees: [],
  ocean: [],
  pois: [],
};
test("continuous collision cannot tunnel through a building at high speed", () => {
  const c = new CollisionWorld(empty),
    r = c.move(-5, 5, 25, 0, 1);
  assert.equal(r.hit, true);
  assert.ok(r.x < 0);
  assert.equal(c.blocked(5, 5), true);
  assert.equal(c.blocked(-3, 5), false);
});
test("bridge deck collision height matches both approaches and centre", () => {
  const c = new CollisionWorld(empty);
  for (const b of BRIDGES) {
    assert.equal(bridgeY(b, 0), 0);
    assert.ok(bridgeY(b, 1) < 0.001);
    assert.ok(Math.abs(bridgeY(b, 0.5) - b.height) < 0.001);
    assert.ok(c.height(...bridgePoint(b, 0.5)) > 0);
    assert.equal(c.water(...bridgePoint(b, 0.5)), false);
  }
});
test("camera yaw takes the shortest path across angle wrap", () => {
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9);
});

test("curved bridge ramps follow mapped points without an elevation jump", () => {
  const c = new CollisionWorld(empty),
    b = BRIDGES.find((b) => b.id === "cambie")!;
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000,
      p = bridgePoint(b, t),
      s = bridgeSample(b, ...p);
    assert.ok(Math.abs(s.t - t) < 0.0001);
    const h = c.height(...p);
    assert.ok(Math.abs(h - previous) < 0.15);
    previous = h;
    assert.equal(c.water(...p), false);
  }
});
