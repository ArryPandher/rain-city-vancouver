import assert from "node:assert/strict";
import test from "node:test";
import clipping, { type Polygon } from "polygon-clipping";
import {
  podiumPlanters,
  type PlanterRegion,
} from "../src/world/podium-planters";
import { flatPolygon, walls } from "../src/world/geometry";
const box = (x: number, z: number, w: number, d: number) => [
  x,
  z,
  x + w,
  z,
  x + w,
  z + d,
  x,
  z + d,
];
const poly = (p: number[]): Polygon => [
  Array.from({ length: p.length / 2 }, (_, i) => [p[i * 2], p[i * 2 + 1]]),
];
const asPoly = (r: PlanterRegion): Polygon => [
  poly(r.outer)[0],
  ...r.holes.map((h) => poly(h)[0]),
];
const signedArea = (p: number[]) =>
  p.reduce(
    (s, v, i) =>
      i % 2
        ? s
        : s + v * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1],
    0,
  ) / 2;
function verify(podium: number[], tower: number[], candidate: number[]) {
  const result = podiumPlanters(podium, tower, candidate);
  for (const planter of result) {
    assert.deepEqual(
      clipping.difference(asPoly(planter.curb), poly(podium)),
      [],
    );
    assert.deepEqual(
      clipping.intersection(asPoly(planter.curb), poly(tower)),
      [],
    );
    for (const r of [planter.curb, ...planter.rim, ...planter.planting]) {
      assert.ok(r.outer.every(Number.isFinite));
      assert.ok(signedArea(r.outer) > 0);
      for (const h of r.holes) assert.ok(signedArea(h) < 0);
      for (const g of [flatPolygon(r.outer, r.holes), walls(r.outer, 0.42)]) {
        assert.ok(
          Array.from(g.getAttribute("position").array).every(Number.isFinite),
        );
        g.dispose();
      }
    }
    for (const r of planter.planting)
      assert.deepEqual(
        clipping.difference(asPoly(r), asPoly(planter.curb)),
        [],
      );
  }
  return result;
}
test("rotated podium keeps every planter polygon supported and clear of the actual tower", () => {
  const rotate = (p: number[]) =>
    p.map((v, i) =>
      i % 2 ? p[i - 1] * 0.6 + v * 0.8 : v * 0.8 - p[i + 1] * 0.6,
    );
  assert.ok(
    verify(
      rotate(box(-20, -20, 40, 40)),
      rotate(box(-10, -10, 20, 20)),
      box(-30, -30, 60, 60),
    ).length,
  );
});
test("concave footprint clipping excludes the missing corner and tower", () => {
  assert.ok(
    verify(
      [0, 0, 40, 0, 40, 12, 12, 12, 12, 40, 0, 40],
      box(2, 2, 6, 6),
      box(-4, -4, 50, 50),
    ).length,
  );
});
test("narrow exposed ledges and tiny intersections are omitted", () => {
  assert.deepEqual(
    verify(box(0, 0, 40, 40), box(0.8, 0.8, 38.4, 38.4), box(-1, -1, 42, 42)),
    [],
  );
  assert.deepEqual(
    verify(box(0, 0, 40, 40), box(10, 10, 20, 20), box(1, 1, 1, 1)),
    [],
  );
});
test("reversed and closed input rings preserve valid normalized output", () => {
  const reverse = (p: number[]) => poly(p)[0].reverse().flat();
  const roof = box(0, 0, 40, 40);
  roof.push(0, 0);
  assert.ok(
    verify(reverse(roof), reverse(box(10, 10, 20, 20)), box(-1, -1, 42, 42))
      .length,
  );
});
test("malformed coordinates fail closed", () => {
  assert.deepEqual(
    podiumPlanters([NaN, 0, 1, 0, 1, 1], box(0, 0, 1, 1), box(0, 0, 2, 2)),
    [],
  );
});
