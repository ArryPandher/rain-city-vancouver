import test from "node:test";
import assert from "node:assert/strict";
import { FileLoader } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadLandmarkWithRetry } from "../src/world/landmark-load-retry";

function response(status: number, body = "") {
  const result = new Response(body, { status });
  // Exercise FileLoader's supported non-streaming response path in Node,
  // where the browser ProgressEvent constructor is not available.
  Object.defineProperty(result, "body", { value: undefined });
  return result;
}

test("actual Three FileLoader HTTP failures retry only 408, 429 and 5xx", async (t) => {
  for (const status of [408, 429, 500, 503, 599, 400, 401, 403, 404, 410]) {
    let requests = 0;
    const delays: number[] = [];
    const fetch = t.mock.method(globalThis, "fetch", async () => {
      requests++;
      return response(requests === 1 ? status : 200, "landmark");
    });
    const action = loadLandmarkWithRetry(
      () =>
        new FileLoader().loadAsync(`https://landmark.test/model-${status}.glb`),
      async (ms) => {
        delays.push(ms);
      },
    );
    if (status === 408 || status === 429 || status >= 500) {
      assert.equal(await action, "landmark");
      assert.equal(requests, 2);
      assert.deepEqual(delays, [500]);
    } else {
      await assert.rejects(action, (error: unknown) => {
        assert.ok(error instanceof Error && "response" in error);
        assert.ok(error.response instanceof Response);
        assert.equal(error.response.status, status);
        return true;
      });
      assert.equal(requests, 1);
      assert.deepEqual(delays, []);
    }
    fetch.mock.restore();
  }
});

test("actual FileLoader exhaustion stops at three and retains the first HTTP error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response(503));
  const errors: unknown[] = [],
    delays: number[] = [];
  await assert.rejects(
    loadLandmarkWithRetry(
      async () => {
        try {
          return await new FileLoader().loadAsync(
            "https://landmark.test/exhaust.glb",
          );
        } catch (error) {
          errors.push(error);
          throw error;
        }
      },
      async (ms) => {
        delays.push(ms);
      },
    ),
    (error: unknown) => {
      assert.equal(error, errors[0]);
      return true;
    },
  );
  assert.equal(errors.length, 3);
  assert.deepEqual(delays, [500, 1500]);
});

test("fetch network TypeErrors retry but arbitrary parser TypeErrors do not", async (t) => {
  for (const message of [
    "Failed to fetch",
    "Load failed",
    "NetworkError when attempting to fetch resource.",
    "fetch failed",
  ]) {
    let attempts = 0;
    const error = new TypeError(message),
      delays: number[] = [];
    const fetch = t.mock.method(globalThis, "fetch", async () => {
      throw error;
    });
    await assert.rejects(
      loadLandmarkWithRetry(
        () => {
          attempts++;
          return new FileLoader().loadAsync(
            `https://landmark.test/network-${attempts}.glb`,
          );
        },
        async (ms) => {
          delays.push(ms);
        },
      ),
      (actual) => actual === error,
    );
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [500, 1500]);
    fetch.mock.restore();
  }
  for (const error of [
    new TypeError("Cannot read properties of undefined"),
    new SyntaxError("Invalid JSON"),
    new Error("503 service unavailable"),
    new Error("Failed to fetch"),
    new DOMException("Aborted", "AbortError"),
    { status: 503 },
    { response: { status: 503 } },
  ]) {
    let attempts = 0;
    await assert.rejects(
      loadLandmarkWithRetry(
        async () => {
          attempts++;
          throw error;
        },
        async () => {
          assert.fail("not a retryable request error");
        },
      ),
      (actual) => actual === error,
    );
    assert.equal(attempts, 1);
  }
});

test("actual GLTFLoader corrupt content fails immediately after successful HTTP response", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return response(200, "not valid glTF");
  });
  await assert.rejects(
    loadLandmarkWithRetry(
      () => new GLTFLoader().loadAsync("https://landmark.test/corrupt.glb"),
      async () => {
        assert.fail("corrupt assets must not retry");
      },
    ),
    SyntaxError,
  );
  assert.equal(requests, 1);
});

test("success returns unchanged value and a later parse failure takes precedence", async () => {
  const value = { scene: "ready" };
  assert.equal(
    await loadLandmarkWithRetry(
      async () => value,
      async () => {
        assert.fail();
      },
    ),
    value,
  );
  let attempts = 0;
  const parseError = new TypeError("Invalid bufferView");
  await assert.rejects(
    loadLandmarkWithRetry(
      async () => {
        if (++attempts === 1) throw new TypeError("Failed to fetch");
        throw parseError;
      },
      async () => {},
    ),
    (error) => error === parseError,
  );
  assert.equal(attempts, 2);
});

test("only actual error ProgressEvents retry; abort, timeout, progress and plain objects do not", async (t) => {
  class BrowserProgressEvent extends Event {
    readonly lengthComputable = false;
    readonly loaded = 0;
    readonly total = 0;
  }
  // Node has no ProgressEvent; install its browser shape to cover the guarded
  // instanceof path, then restore the environment after this test.
  const previous = Object.getOwnPropertyDescriptor(globalThis, "ProgressEvent");
  Object.defineProperty(globalThis, "ProgressEvent", {
    configurable: true,
    value: BrowserProgressEvent,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "ProgressEvent", previous);
    else Reflect.deleteProperty(globalThis, "ProgressEvent");
  });
  for (const error of [
    new BrowserProgressEvent("error"),
    new BrowserProgressEvent("abort"),
    new BrowserProgressEvent("timeout"),
    new BrowserProgressEvent("progress"),
    { type: "error" },
  ]) {
    let attempts = 0;
    await assert.rejects(
      loadLandmarkWithRetry(
        async () => {
          attempts++;
          throw error;
        },
        async () => {},
      ),
      (actual) => actual === error,
    );
    assert.equal(
      attempts,
      error instanceof BrowserProgressEvent && error.type === "error" ? 3 : 1,
    );
  }
});
