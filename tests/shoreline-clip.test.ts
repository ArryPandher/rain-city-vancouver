import test from "node:test";
import assert from "node:assert/strict";
import clipping, { type Polygon } from "polygon-clipping";
import { ShorelineClip } from "../src/world/shoreline-clip";
import { polygonArea } from "../src/world/triangle-partition";
import { type Point } from "../src/world/data";
test("spatial shoreline subtraction matches polygon booleans for concave and overlapping water, touching edges, reversed rings and narrow land", () => {
  const water = [
    [-8, -8, 8, -8, 8, 1, 1, 1, 1, 8, -8, 8],
    [3, -2, 12, -2, 12, 12, 3, 12],
    [-7, 10, -2, 10, -2, 12, -7, 12],
    [0, 0, 0, 0.03, 15, 0.03, 15, 0],
  ];
  for (const reverse of [false, true]) {
    const rings = water.map((p) => {
      const q = Array.from(
        { length: p.length / 2 },
        (_, i) => [p[2 * i], p[2 * i + 1]] as Point,
      );
      return reverse ? q.reverse() : q;
    });
    const shore = new ShorelineClip(
      rings.map((p) => p.flat()),
      { minX: -20, minZ: -20, maxX: 20, maxZ: 20 },
    );
    for (let x = -10; x < 15; x += 1.17)
      for (let z = -10; z < 15; z += 1.43) {
        const p: Point[] = [
          [x, z],
          [x + 2.4, z],
          [x, z + 2.1],
        ];
        const expected = clipping
          .difference([p] as Polygon, ...rings.map((r) => [r] as Polygon))
          .reduce(
            (sum, poly) =>
              sum +
              polygonArea(poly[0] as Point[]) -
              poly.slice(1).reduce((n, h) => n + polygonArea(h as Point[]), 0),
            0,
          );
        const actual = shore
          .triangle(p)
          .reduce((sum, t) => sum + polygonArea(t), 0);
        assert.ok(
          Math.abs(expected - actual) < 1e-7,
          `${x},${z}: ${actual} vs ${expected}`,
        );
      }
  }
});
