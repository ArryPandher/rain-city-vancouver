import test from "node:test";
import assert from "node:assert/strict";
import { TreeDetailStream } from "../src/world/detail-stream";
const wait = () => new Promise((resolve) => setTimeout(resolve, 25));
test("downtown becomes usable before detail starts and never downloads remote forest", async () => {
  const calls: string[] = [];
  const stream = new TreeDetailStream({
    street: async () => {
      calls.push("street");
    },
    forest: async () => {
      calls.push("forest");
    },
  });
  assert.deepEqual(calls, []);
  stream.update(-81, -798);
  assert.deepEqual(
    calls,
    [],
    "first frame gets a render yield before optional work",
  );
  await wait();
  assert.deepEqual(calls, ["street"]);
  assert.equal(stream.status.street.state, "ready");
  for (let i = 0; i < 10; i++) stream.update(-81, -798);
  await wait();
  assert.deepEqual(calls, ["street"]);
  assert.equal(stream.status.forest.state, "waiting");
});
test("Stanley arrival prioritizes forest, bounded to one in-flight job", async () => {
  const calls: string[] = [];
  let finish!: () => void;
  const stream = new TreeDetailStream({
    street: async () => {
      calls.push("street");
    },
    forest: async () => {
      calls.push("forest");
      await new Promise<void>((r) => (finish = r));
    },
  });
  stream.update(-1700, -2300);
  await wait();
  stream.update(0, -700);
  await wait();
  assert.deepEqual(calls, ["forest"]);
  finish();
  await wait();
  stream.update(0, -700);
  await wait();
  assert.deepEqual(calls, ["forest", "street"]);
});
test("failed optional detail is recorded without retry loops or blocking the other region", async () => {
  const failures: string[] = [];
  const stream = new TreeDetailStream(
    {
      street: async () => {
        throw new Error("offline");
      },
      forest: async () => {},
    },
    (kind) => failures.push(kind),
  );
  stream.update(0, -700);
  await wait();
  assert.equal(stream.status.street.state, "failed");
  stream.update(0, -700);
  stream.update(-1700, -2300);
  await wait();
  assert.deepEqual(failures, ["street"]);
  assert.equal(stream.status.forest.state, "ready");
  assert.ok(stream.status.street.milliseconds! >= 0);
});
