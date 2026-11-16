import test from "node:test";
import assert from "node:assert/strict";
import clipping from "polygon-clipping";
import type { Point } from "../src/world/data";
import { robsonGridCandidates } from "../src/world/robson-grid-candidates";

const fixtures: Point[][][] = [
  // Long diagonal street ribbon: most cells in its AABB are empty.
  [
    [
      [-12, -11.929],
      [12, 12.071],
      [12.25, 11.821],
      [-11.75, -12.179],
    ],
  ],
  // Concave apron with a tree hole.
  [
    [
      [0, 0],
      [12, 0],
      [12, 2],
      [3, 2],
      [3, 12],
      [0, 12],
    ],
    [
      [0.8, 4],
      [0.8, 5.6],
      [2.4, 5.6],
      [2.4, 4],
    ],
  ],
  // Entire cells inside both the exterior and hole have no crossing edges.
  [
    [
      [-4, -4],
      [4, -4],
      [4, 4],
      [-4, 4],
    ],
    [
      [-2.4, -2.4],
      [-2.4, 2.4],
      [2.4, 2.4],
      [2.4, -2.4],
    ],
  ],
  // Very thin sliver crossing a grid corner; must not disappear.
  [
    [
      [-3.2, -0.000001],
      [3.2, 0.000001],
      [3.2, 0.000002],
      [-3.2, 0],
    ],
  ],
  // Closed rings, negatives, exactly grid-aligned edges and repeated endpoints.
  [
    [
      [-1.6, -1.6],
      [0, -1.6],
      [0, 0],
      [-1.6, 0],
      [-1.6, -1.6],
    ],
  ],
];

test("candidate rejection preserves original triangle boolean output and order exactly", () => {
  let calls = 0,
    avoided = 0;
  for (const polygon of fixtures)
    for (const step of [0.8, 0.3]) {
      const candidate = robsonGridCandidates(polygon, step);
      const points = polygon.flat();
      const xs = points.map((p) => p[0]),
        zs = points.map((p) => p[1]);
      const original: unknown[] = [],
        filtered: unknown[] = [];
      for (
        let ix = Math.floor(Math.min(...xs) / step);
        ix <= Math.floor(Math.max(...xs) / step);
        ix++
      ) {
        for (
          let iz = Math.floor(Math.min(...zs) / step);
          iz <= Math.floor(Math.max(...zs) / step);
          iz++
        ) {
          const x = ix * step,
            z = iz * step;
          const grids: Point[][] = [
            [
              [x, z],
              [x + step, z],
              [x + step, z + step],
            ],
            [
              [x, z],
              [x + step, z + step],
              [x, z + step],
            ],
          ];
          for (const grid of grids) {
            const cut = clipping.intersection([polygon], [[grid]]);
            calls++;
            original.push(...cut);
            if (candidate(ix, iz)) filtered.push(...cut);
            else {
              avoided++;
              assert.deepEqual(
                cut,
                [],
                `false negative at ${ix},${iz}, step${step}`,
              );
            }
          }
        }
      }
      assert.deepEqual(filtered, original);
    }
  assert.ok(
    avoided > calls / 2,
    "thin street masks should skip a substantial empty grid region",
  );
});

test("all touched cells survive, including hole edges and submicrometre corner contacts", () => {
  const aligned = robsonGridCandidates(
    [
      [
        [0, 0],
        [1.6, 0],
        [1.6, 1.6],
        [0, 1.6],
      ],
    ],
    0.8,
  );
  for (const p of [
    [-1, -1],
    [0, -1],
    [2, 0],
    [2, 2],
    [0, 0],
  ])
    assert.equal(aligned(...(p as [number, number])), true);
  assert.equal(aligned(3, 3), false);
  const hole = robsonGridCandidates(fixtures[2], 0.8);
  assert.equal(hole(0, 0), false, "a wholly empty hole cell is rejected");
  assert.equal(hole(2, 2), true, "hole boundary cells retain exact clipping");
  const empty = robsonGridCandidates([], 0.8);
  assert.equal(empty(0, 0), false);
});
