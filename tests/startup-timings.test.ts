import test from "node:test";
import assert from "node:assert/strict";
import { StartupTimings } from "../src/rendering/startup-timings";

test("startup distinguishes synchronous shader initialization from its readiness wait", async () => {
  let clock = 100;
  const timings = new StartupTimings(() => clock);
  timings.begin("Initializing renderer shaders");
  const started = clock;
  let ready!: () => void;
  // Like r182 compileAsync: work happens before its Promise is returned.
  const compile = () => {
    clock += 850;
    return new Promise<void>((resolve) => {
      ready = resolve;
    });
  };
  const compiled = compile();
  timings.invocation(clock - started);
  timings.begin("Waiting for renderer shaders");
  clock += 2200;
  ready();
  await compiled;
  timings.finish();
  const result = timings.snapshot();
  assert.equal(result.complete, true);
  assert.equal(result.status, "ready");
  assert.deepEqual(
    result.stages.map((s) => [s.startedMs, s.durationMs, s.invocationMs]),
    [
      [0, 850, 850],
      [850, 2200, undefined],
    ],
  );
  clock += 10000;
  assert.equal(timings.snapshot().stages[1].durationMs, 2200);
});

test("a failed startup retains its active stage and failure instead of claiming readiness", () => {
  let clock = 0;
  const timings = new StartupTimings(() => clock);
  timings.begin("Generating and merging downtown geometry");
  clock = 300;
  timings.begin("Packing downtown draw batches");
  clock = 900;
  timings.finish(new Error("allocation failed"));
  timings.begin("This stage must not run");
  const result = timings.snapshot();
  assert.equal(result.complete, false);
  assert.equal(result.status, "failed");
  assert.equal(result.stages.length, 2);
  assert.equal(result.stages[1].durationMs, 600);
  assert.match(
    timings.text(),
    /Packing downtown draw batches: 0.60s; FAILED: Error: allocation failed/,
  );
  // Reports are snapshots: consumers cannot mutate the retained evidence.
  result.stages[1].name = "changed";
  assert.equal(
    timings.snapshot().stages[1].name,
    "Packing downtown draw batches",
  );
});
