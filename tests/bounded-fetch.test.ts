import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error standalone extraction helper is intentionally native ESM
import { boundedFetch } from "../scripts/lib/bounded-fetch.mjs";
const request = (response: Response, limit = 16) =>
  boundedFetch("https://fixture.invalid/local", {
    maxBytes: limit,
    budget: { limit, used: 0 },
    allowedTypes: ["application/json"],
    fetchImpl: async () => response,
  });
test("bounded extraction accepts a tiny JSON fixture before any file write", async () => {
  const data = await request(
    new Response('{"ok":true}', {
      headers: { "content-type": "application/json", "content-length": "11" },
    }),
  );
  assert.deepEqual(JSON.parse(data.toString()), { ok: true });
});
test("oversized declared response and non-JSON bulk type reject before reading", async () => {
  for (const headers of [
    { "content-type": "application/json", "content-length": "758211316" },
    { "content-type": "application/zip", "content-length": "4" },
  ]) {
    let reads = 0,
      cancelled = false;
    const response = {
      ok: true,
      headers: new Headers(headers),
      body: {
        cancel: async () => {
          cancelled = true;
        },
        async *[Symbol.asyncIterator]() {
          reads++;
          yield Buffer.from("test");
        },
      },
    } as unknown as Response;
    await assert.rejects(request(response), /byte budget|content type/);
    assert.equal(reads, 0);
    assert.equal(cancelled, true);
  }
});
test("chunked body and shared total budget cannot bypass declared-size guard", async () => {
  const budget = { limit: 12, used: 5 };
  let ended = false;
  const response = {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    body: {
      async *[Symbol.asyncIterator]() {
        try {
          yield Buffer.from("1234");
          yield Buffer.from("5678");
          yield Buffer.from("no");
        } finally {
          ended = true;
        }
      },
    },
  };
  await assert.rejects(
    boundedFetch("https://fixture.invalid/local", {
      maxBytes: 16,
      budget,
      allowedTypes: ["application/json"],
      fetchImpl: async () => response,
    }),
    /Stream exceeds/,
  );
  assert.equal(budget.used, 13);
  assert.equal(ended, true);
});
