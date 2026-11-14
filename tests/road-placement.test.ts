import test from "node:test";
import assert from "node:assert/strict";
import {
  nearbyRoadSpans,
  sampleRoadSpan,
  pointOnRoad,
  advanceRoadCursor,
} from "../src/game/road-placement";
import { seeded, type Road } from "../src/world/data";

test("long roads with distant endpoints still provide local population positions", () => {
  const road: Road = { kind: "primary", pts: [-2000, 0, 2000, 0] };
  const spans = nearbyRoadSpans([road], 0, 0, 120);
  assert.equal(spans.length, 1);
  const random = seeded(318);
  for (let i = 0; i < 100; i++) {
    const p = sampleRoadSpan(spans, random)!;
    const point = pointOnRoad(p.road, p.segment, p.t, 0);
    assert.ok(Math.hypot(point.x, point.z) <= 120.001);
  }
});

test("sampling uses the nearby segment rather than the first segment of a way", () => {
  const road: Road = { kind: "footway", pts: [1000, 1000, 0, 1000, 0, -1000] };
  const spans = nearbyRoadSpans([road], 0, 0, 80);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].segment, 2);
  const sample = sampleRoadSpan(spans, seeded(20))!;
  const point = pointOnRoad(sample.road, sample.segment, sample.t, 0);
  assert.ok(Math.hypot(point.x, point.z) < 80);
});

test("unusable and remote road geometry cannot create a spawn", () => {
  const spans = nearbyRoadSpans(
    [
      { kind: "residential", pts: [3, 2, 3, 2] },
      { kind: "residential", pts: [1000, 1000, 2000, 1000] },
    ],
    0,
    0,
    50,
  );
  assert.deepEqual(spans, []);
  assert.equal(sampleRoadSpan(spans, seeded(4)), null);
});

test("walking carries remaining distance around polyline corners and turns at the end", () => {
  const road: Road = { kind: "footway", pts: [0, 0, 10, 0, 10, 10] };
  const around = advanceRoadCursor(
    road,
    { segment: 0, t: 0.9, direction: 1 },
    3,
  );
  assert.equal(around.segment, 2);
  assert.ok(Math.abs(around.t - 0.2) < 1e-9);
  const back = advanceRoadCursor(road, { segment: 2, t: 0.9, direction: 1 }, 3);
  assert.equal(back.direction, -1);
  assert.ok(Math.abs(back.t - 0.8) < 1e-9);
});

test("sidewalk and lane offsets meet continuously at a corner", () => {
  const road: Road = { kind: "residential", pts: [0, 0, 20, 0, 20, 20] };
  for (const offset of [-6, 3, 6]) {
    const end = pointOnRoad(road, 0, 1, offset);
    const start = pointOnRoad(road, 2, 0, offset);
    assert.ok(Math.hypot(end.x - start.x, end.z - start.z) < 1e-9);
    const next = pointOnRoad(road, 2, 0.0001, offset);
    assert.ok(Math.hypot(next.x - end.x, next.z - end.z) < 0.01);
  }
});
