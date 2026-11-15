import test from "node:test";
import assert from "node:assert/strict";
import {
  FrameSample,
  type FrameSampleContext,
} from "../src/rendering/frame-sample";
const context: FrameSampleContext = {
  viewport: { width: 903, height: 670, pixelRatio: 1 },
  preset: "balanced",
  weather: "day",
  position: [-81, 1.55, -798],
};
test("route FPS uses elapsed time and retains a real 200ms stall rather than capped physics time", () => {
  const sample = new FrameSample(context, 1);
  sample.add(5); // button precedes this frame: do not count this old interval.
  for (let i = 0; i < 99; i++) assert.equal(sample.add(0.01), false);
  assert.equal(sample.add(0.2), true);
  const result = sample.finish({ ...context, position: [-70, 2, -770] });
  assert.equal(result.valid, true);
  assert.equal(result.frames, 100);
  assert.ok(Math.abs(result.elapsedSeconds - 1.19) < 1e-10);
  assert.ok(Math.abs(result.meanFPS! - 100 / 1.19) < 1e-10);
  assert.deepEqual(result.frameMilliseconds, {
    median: 10,
    p95: 10,
    p99: 10,
    max: 200,
  });
  assert.equal(result.framesOver50ms, 1);
  assert.equal(result.framesOver100ms, 1);
  assert.deepEqual(result.end.position, [-70, 2, -770]);
});
test("nearest rank tail percentiles and median are defined for uneven frame intervals", () => {
  const sample = new FrameSample(context, 1);
  sample.add(0.01);
  // 100 intervals of 1..100ms => exactly 5.05s and median50.5ms.
  for (let i = 1; i <= 100; i++) sample.add(i / 1000);
  const result = sample.finish(context);
  assert.deepEqual(result.frameMilliseconds, {
    median: 50.5,
    p95: 95,
    p99: 99,
    max: 100,
  });
  assert.equal(result.framesOver50ms, 50);
  assert.equal(result.framesOver100ms, 0);
  assert.ok(Math.abs(result.meanFPS! - 100 / 5.05) < 1e-10);
});
test("pause/visibility abort reports an invalid partial run without menu frames", () => {
  const sample = new FrameSample(context);
  sample.add(0.02);
  sample.add(0.02);
  sample.add(0.1);
  const result = sample.finish(context, "document hidden");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "document hidden");
  assert.equal(result.frames, 2);
  assert.ok(Math.abs(result.elapsedSeconds - 0.12) < 1e-10);
  assert.equal(
    sample.add(4),
    false,
    "finished sampler rejects later static/menu time",
  );
});
test("aborted start contains no invented FPS, and full 20s ends on its whole final interval", () => {
  const empty = new FrameSample(context).finish(context, "game paused");
  assert.equal(empty.frames, 0);
  assert.equal(empty.meanFPS, null);
  assert.equal(empty.frameMilliseconds, null);
  const sample = new FrameSample(context);
  sample.add(1);
  for (let i = 0; i < 39; i++) assert.equal(sample.add(0.5), false);
  assert.equal(sample.add(0.6), true);
  const result = sample.finish(context);
  assert.equal(result.valid, true);
  assert.equal(result.elapsedSeconds, 20.1);
  assert.equal(result.framesOver100ms, 40);
});
