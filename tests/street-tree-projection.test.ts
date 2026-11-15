import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  nearStreetTree,
  projectedCrownHeight,
  selectStreetTrees,
} from "../src/world/street-tree-lod";
import type { TreeInstance } from "../src/world/detailed-trees";
const tree = (height: number) =>
  ({ height, width: height * 0.7, x: 0, z: 0, y: 0 }) as TreeInstance;
const projection = 1 / Math.tan((31 * Math.PI) / 180);
test("same distance preserves large-screen crown detail and uses source cards for smaller crown", () => {
  assert.equal(nearStreetTree(tree(10.7), 20, false, projection), false);
  assert.equal(nearStreetTree(tree(20), 20, false, projection), true);
  assert.ok(projectedCrownHeight(tree(10.7), 20, projection) < 0.45);
});
test("close leaf detail is retained and size/distance hysteresis suppresses walking toggles", () => {
  assert.equal(nearStreetTree(tree(3), 9.9, false, projection), true);
  assert.equal(nearStreetTree(tree(3), 11, true, projection), true);
  assert.equal(nearStreetTree(tree(3), 12.1, true, projection), false);
  const d = (10 * 0.7 * projection) / (2 * 0.41);
  assert.equal(nearStreetTree(tree(10), d, false, projection), false);
  assert.equal(nearStreetTree(tree(10), d, true, projection), true);
  assert.equal(nearStreetTree(tree(100), 35, true, projection), false);
});
test("narrow FOV promotes resolvable leaf geometry without changing tree count", () => {
  const t = { ...tree(10.7), x: 20 };
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
