import test from "node:test";
import assert from "node:assert/strict";
import {
  lawnWear,
  lawnWearTexture,
  LAWN_MASK,
  type LawnEdge,
} from "../src/world/harbour-lawn-material";
const path: LawnEdge = { a: [-100, -800], b: [-60, -800], halfWidth: 1.4 };
test("wear follows actual path width and fades within a narrow maintained margin", () => {
  const edge = lawnWear(-80, -798.6, [path], []);
  const shoulder = lawnWear(-80, -798.3, [path], []);
  const open = lawnWear(-80, -797.8, [path], []);
  assert.ok(edge > 0.99 && shoulder > 0 && shoulder < edge);
  assert.equal(open, 0);
  assert.equal(lawnWear(-80, -790, [path], []), 0);
});
test("trunk soil is local and diameter bounded, leaving open lawn untouched", () => {
  const trees = [{ x: -80, z: -800, diameter: 0.5 }];
  assert.equal(lawnWear(-80, -800, [], trees), 1);
  assert.ok(lawnWear(-79.4, -800, [], trees) > 0);
  assert.equal(lawnWear(-78.7, -800, [], trees), 0);
});
test("mask spatial bucketing agrees with direct geometry at texel centers", () => {
  const trunks = [{ x: -85, z: -807, diameter: 0.6 }];
  const texture = lawnWearTexture([path], trunks),
    b = LAWN_MASK;
  const pixels = texture.image.data as Uint8Array;
  assert.equal(pixels.byteLength, 1024 * 768);
  for (let row = 320; row < 400; row += 3)
    for (let col = 470; col < 590; col += 3) {
      const x = b.x + ((col + 0.5) / b.columns) * b.width,
        z = b.z + ((row + 0.5) / b.rows) * b.depth;
      assert.equal(
        pixels[row * b.columns + col],
        Math.round(lawnWear(x, z, [path], trunks) * 255),
      );
    }
  assert.ok(pixels.some((v) => v > 0));
  texture.dispose();
});
test("degenerate boundary segment stays finite and distant turf stays clean", () => {
  const edges: LawnEdge[] = [{ a: [0, 0], b: [0, 0], halfWidth: 0 }];
  assert.equal(lawnWear(0, 0, edges, []), 1);
  assert.equal(lawnWear(10, 10, edges, []), 0);
});
