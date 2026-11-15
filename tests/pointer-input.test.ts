import test from "node:test";
import assert from "node:assert/strict";
import { PointerInput } from "../src/game/pointer-input";
const options = { active: true, canvas: true, locked: false, weapon: false };
test("holstered fallback uses client deltas only during a canvas drag; repeated drags accumulate turns", () => {
  const p = new PointerInput();
  let yaw = 0;
  assert.equal(p.move(900, 50, 900, 50, 0, true, false), null);
  for (let i = 0; i < 3; i++) {
    p.down(0, 100, 50, options);
    const delta = p.move(900, 70, 0, 0, 1, true, false)!;
    assert.deepEqual(delta, [800, 20]);
    yaw += delta[0] * 0.0022 * 0.75;
    assert.equal(p.firing, false);
    p.up(0);
    assert.equal(p.move(100, 50, -800, -20, 0, true, false), null);
  }
  assert.ok(yaw > Math.PI);
});
test("armed fallback separates right-drag aiming from left fire and supports both buttons", () => {
  const p = new PointerInput(),
    armed = { ...options, weapon: true };
  p.down(0, 0, 0, armed);
  assert.equal(p.firing, true);
  assert.equal(p.move(100, 50, 100, 50, 1, true, false), null);
  p.up(0);
  p.down(2, 50, 50, armed);
  assert.equal(p.aiming, true);
  p.down(0, 50, 50, armed);
  assert.equal(p.firing, true);
  assert.deepEqual(p.move(70, 60, 0, 0, 3, true, false), [20, 10]);
  p.up(0);
  assert.equal(p.firing, false);
  assert.equal(p.aiming, true);
  p.up(2);
  assert.equal(p.aiming, false);
  assert.equal(p.move(80, 80, 10, 20, 0, true, false), null);
});
test("pointer lock retains free relative look, left firing and right aiming", () => {
  const p = new PointerInput(),
    locked = { ...options, locked: true, weapon: true };
  assert.deepEqual(p.move(0, 0, 17, -9, 0, true, true), [17, -9]);
  p.down(0, 0, 0, locked);
  p.down(2, 0, 0, locked);
  assert.ok(p.firing && p.aiming);
  assert.deepEqual(p.move(0, 0, -25, 12, 3, true, true), [-25, 12]);
});
test("UI and paused presses never shoot or initiate look", () => {
  for (const invalid of [
    { ...options, canvas: false, weapon: true },
    { ...options, active: false, weapon: true },
  ]) {
    const p = new PointerInput();
    assert.equal(p.down(0, 0, 0, invalid), false);
    assert.equal(p.down(2, 0, 0, invalid), false);
    assert.equal(p.firing, false);
    assert.equal(p.aiming, false);
    assert.equal(p.move(20, 20, 20, 20, 3, true, false), null);
  }
});
test("blur/pause/lost capture reset, missed releases and inactive moves clear held state", () => {
  const p = new PointerInput(),
    armed = { ...options, weapon: true };
  for (const reset of [
    () => p.reset(),
    () => p.move(0, 0, 0, 0, 0, true, false),
    () => p.move(0, 0, 0, 0, 3, false, false),
  ]) {
    p.down(2, 0, 0, armed);
    p.down(0, 0, 0, armed);
    reset();
    assert.equal(p.firing, false);
    assert.equal(p.aiming, false);
    assert.equal(p.move(10, 10, 0, 0, 3, true, false), null);
  }
});
