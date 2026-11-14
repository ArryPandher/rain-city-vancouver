import test from "node:test";
import assert from "node:assert/strict";
import {
  partitionTriangle,
  polygonArea,
  ringTriangles,
} from "../src/world/triangle-partition";
import type { Point } from "../src/world/data";
test("triangle partition conserves area around cutouts, shared edges and either winding", () => {
  for (const angle of [0, 0.731, Math.PI / 2])
    for (const reverse of [false, true]) {
      const point = (x: number, z: number): Point => [
        150 + x * Math.cos(angle) - z * Math.sin(angle),
        -772 + x * Math.sin(angle) + z * Math.cos(angle),
      ];
      const polygon = (p: number[]) => {
        const ring: Point[] = Array.from({ length: p.length / 2 }, (_, i) =>
          point(p[2 * i], p[2 * i + 1]),
        );
        return (reverse ? ring.reverse() : ring).flat();
      };
      const boundary = ringTriangles(polygon([0, 0, 10, 0, 10, 10, 0, 10]));
      const cutouts = ringTriangles(polygon([3, 0, 7, 0, 7, 10, 3, 10]));
      const source = ringTriangles(polygon([0, 0, 10, 0, 10, 10, 0, 10]));
      const pieces = source.flatMap((t) =>
        partitionTriangle(t, boundary, cutouts),
      );
      assert.ok(
        Math.abs(pieces.reduce((n, p) => n + polygonArea(p), 0) - 60) < 1e-7,
      );
      assert.ok(pieces.every((p) => p.flat().every(Number.isFinite)));
    }
});
