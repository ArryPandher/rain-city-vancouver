import test from "node:test";
import assert from "node:assert/strict";
import { walkingCameraLookHeight as height } from "../src/game/walking-camera-look";

test("ordinary level/downward walking framing is bit-for-bit unchanged", () => {
  for (const pitch of [0, 0.01, 0.19, 0.5, 0.9])
    for (const [camera, distance] of [[10.33, 7.3], [10.1, 3.8], [12, 5]]) {
      const legacy = 9.78 - Math.sin(pitch) * 2;
      assert.equal(height(legacy, camera, distance, pitch), legacy);
    }
});

test("looking up reaches the skyline for full, shortened and raised walking booms", () => {
  for (const pitch of [-0.2, -0.5, -0.95]) {
    const expected = -pitch - Math.atan2(0.55, 7.3);
    for (const [camera, distance] of [[10.33, 7.3], [10.1, 3.8], [12, 5]]) {
      const result = height(9.78 - Math.sin(pitch) * 2, camera, distance, pitch);
      const actual = Math.atan2(result - camera, distance);
      assert.ok(Math.abs(actual - expected) < 1e-12);
    }
  }
  assert.ok(Math.atan2(height(11.4, 10.33, 7.3, -0.95) - 10.33, 7.3) > 0.87);
});

test("near-neutral transition is continuous, monotonic and guards invalid input", () => {
  const look = (p: number) => height(9.78 - Math.sin(p) * 2, 10.33, 7.3, p);
  let previous = look(0);
  for (let i = 1; i <= 950; i++) {
    const y = look(-i / 1000);
    assert.ok(y > previous);
    previous = y;
  }
  for (const p of [0, -0.15])
    assert.ok(Math.abs(look(p + 1e-7) - look(p - 1e-7)) < 2e-6);
  for (const [camera, distance, p] of [[NaN, 7.3, -0.5], [10, 0, -0.5], [10, 7.3, NaN]])
    assert.equal(height(9, camera, distance, p), 9);
});
