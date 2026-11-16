import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  nearStreetTree,
  projectedCrownHeight,
  selectStreetTrees,
  individualStreetLeaves,
} from "../src/world/street-tree-lod";
import type { TreeInstance } from "../src/world/detailed-trees";
const tree = (height: number) =>
  ({ height, width: height * 0.7, x: 0, z: 0, y: 0 }) as TreeInstance;
const projection = 1 / Math.tan((31 * Math.PI) / 180);
test("large projected crowns do not promote full curved leaves beyond the close gate", () => {
  assert.equal(nearStreetTree(tree(10.7), 20, false, projection), false);
  assert.equal(nearStreetTree(tree(20), 20, false, projection), false);
  assert.equal(nearStreetTree(tree(100), 20, false, projection), false);
  assert.ok(projectedCrownHeight(tree(20), 20, projection) > 0.45);
  assert.ok(projectedCrownHeight(tree(10.7), 20, projection) < 0.45);
});
test("small distant crowns use the retained depth canopy while nearby or enlarged crowns keep individual leaves", () => {
  assert.equal(individualStreetLeaves(tree(8), 80, false, projection), false);
  assert.equal(individualStreetLeaves(tree(8), 29, false, projection), true);
  assert.equal(individualStreetLeaves(tree(24), 80, false, projection), true);
  const t = { ...tree(8), x: 65 };
  const wide = selectStreetTrees(
    [t],
    0,
    0,
    4,
    24,
    new Set(),
    undefined,
    projection,
  );
  const zoom = selectStreetTrees(
    [t],
    0,
    0,
    4,
    24,
    new Set(),
    undefined,
    new T.PerspectiveCamera(25).projectionMatrix.elements[5],
  );
  assert.equal(wide.length, 0);
  assert.equal(zoom.length, 1);
});
test("detail-to-depth-canopy transition has a stable overlap band", () => {
  const t = tree(8),
    distance = (t.height * 0.7 * projection) / (2 * 0.11);
  assert.equal(individualStreetLeaves(t, distance, false, projection), false);
  assert.equal(individualStreetLeaves(t, distance, true, projection), true);
  const at = { ...t, x: distance };
  assert.equal(
    selectStreetTrees(
      [at],
      0,
      0,
      4,
      24,
      new Set(),
      undefined,
      projection,
      new Set([at]),
    ).length,
    1,
  );
});
test("ordinary FOV enters full curvature below 4m and exits at 6m with stable hysteresis", () => {
  for (const height of [3, 10.7, 20, 100]) {
    assert.equal(nearStreetTree(tree(height), 3.99, false, projection), true);
    assert.equal(nearStreetTree(tree(height), 4, false, projection), false);
    assert.equal(nearStreetTree(tree(height), 5.99, true, projection), true);
    assert.equal(nearStreetTree(tree(height), 6, true, projection), false);
  }
  let previous = false;
  const sequence = [5, 3.9, 4.2, 5.9, 6.1, 5.5, 3.99].map((distance) => {
    previous = nearStreetTree(tree(10), distance, previous, projection);
    return previous;
  });
  assert.deepEqual(sequence, [false, true, true, true, false, false, true]);
});
test("wide and missing projections preserve close detail; extreme zoom remains bounded", () => {
  const wide = new T.PerspectiveCamera(90).projectionMatrix.elements[5];
  for (const scale of [wide, undefined, NaN, Infinity, 0, -1]) {
    assert.equal(nearStreetTree(tree(10), 3.99, false, scale), true);
    assert.equal(nearStreetTree(tree(10), 5, false, scale), false);
    assert.equal(nearStreetTree(tree(10), 5, true, scale), true);
    assert.equal(nearStreetTree(tree(10), 6, true, scale), false);
  }
  const tele = new T.PerspectiveCamera(1).projectionMatrix.elements[5];
  assert.equal(nearStreetTree(tree(10), 26.99, false, tele), true);
  assert.equal(nearStreetTree(tree(10), 27, false, tele), false);
  assert.equal(nearStreetTree(tree(10), 33.99, true, tele), true);
  assert.equal(nearStreetTree(tree(10), 34, true, tele), false);
});
test("narrow FOV promotes resolvable leaf geometry without changing tree count", () => {
  const t = { ...tree(10.7), x: 7 };
  const wide = selectStreetTrees(
    [t],
    0,
    0,
    4,
    24,
    new Set(),
    undefined,
    projection,
  );
  const tele = selectStreetTrees(
    [t],
    0,
    0,
    4,
    24,
    new Set(),
    undefined,
    new T.PerspectiveCamera(35).projectionMatrix.elements[5],
  );
  assert.equal(wide.length, 1);
  assert.equal(tele.length, 1);
  assert.equal(wide[0].near, false);
  assert.equal(tele[0].near, true);
});

test("zoomed full-leaf selection retains a magnified hysteresis band without changing medium eligibility", () => {
  const tele = new T.PerspectiveCamera(35).projectionMatrix.elements[5];
  assert.equal(nearStreetTree(tree(10), 7, false, tele), true);
  assert.equal(nearStreetTree(tree(10), 10, false, tele), false);
  assert.equal(nearStreetTree(tree(10), 10, true, tele), true);
  assert.equal(nearStreetTree(tree(10), 11.5, true, tele), false);
  const trees = [3, 5, 10, 20, 29].map((x) => ({ ...tree(10.7), x }));
  const selected = selectStreetTrees(
    trees,
    0,
    0,
    4,
    24,
    new Set(),
    undefined,
    projection,
  );
  assert.deepEqual(
    selected.map((p) => p.tree),
    trees,
  );
  assert.deepEqual(
    selected.map((p) => p.near),
    [true, false, false, false, false],
  );
  const retained = selectStreetTrees(
    trees,
    0,
    0,
    4,
    24,
    new Set([trees[1]]),
    undefined,
    projection,
    new Set(trees),
  );
  assert.deepEqual(
    retained.map((p) => p.tree),
    trees,
  );
  assert.deepEqual(
    retained.map((p) => p.near),
    [true, true, false, false, false],
  );
});
