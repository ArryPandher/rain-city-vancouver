import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  previewReflectionProbe,
  probePreviewRgb,
} from "../src/rendering/reflection-probe-preview";
import type { SceneReflections } from "../src/rendering/reflection-probes";

test("on-demand preview reads six existing faces, flips rows and recovers from readback errors", async () => {
  const previous = globalThis.document;
  const displayed: Uint8ClampedArray[] = [];
  const labels: string[] = [];
  const canvas = {
    width: 0,
    height: 0,
    setAttribute: () => {},
    getContext: () => ({
      fillStyle: "",
      font: "",
      fillRect: () => {},
      fillText: (s: string) => labels.push(s),
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: (p: { data: Uint8ClampedArray }) => displayed.push(p.data),
    }),
  };
  globalThis.document = { createElement: () => canvas } as unknown as Document;
  const target = new T.WebGLCubeRenderTarget(2, { type: T.HalfFloatType });
  const probe = {
    target,
    dirty: false,
    spec: { name: "Test probe", position: [0, 0, 0], materials: [] },
  } as unknown as SceneReflections["probes"][number];
  const calls: number[] = [];
  let fail = false,
    uninitialized = false;
  const currentTarget = new T.WebGLRenderTarget(3, 3);
  let currentFace = 0,
    currentMip = 0;
  const restores: unknown[][] = [];
  const renderer = {
    getRenderTarget: () => currentTarget,
    getActiveCubeFace: () => currentFace,
    getActiveMipmapLevel: () => currentMip,
    setRenderTarget: (...args: unknown[]) => restores.push(args),
    toneMapping: T.ACESFilmicToneMapping,
    toneMappingExposure: 1,
    readRenderTargetPixelsAsync: async (
      t: unknown,
      x: number,
      y: number,
      w: number,
      h: number,
      buffer: Uint16Array,
      face: number,
    ) => {
      assert.equal(t, target);
      assert.deepEqual([x, y, w, h], [0, 0, 2, 2]);
      calls.push(face);
      if (fail) {
        await Promise.resolve();
        currentFace = 4;
        currentMip = 2;
        throw new Error("readback rejected");
      }
      if (uninitialized) return undefined;
      for (let i = 0; i < 4; i++) {
        buffer[i * 4] = T.DataUtils.toHalfFloat(i < 2 ? 0.1 : 1);
        buffer[i * 4 + 1] = buffer[i * 4];
        buffer[i * 4 + 2] = buffer[i * 4];
      }
      return buffer;
    },
  } as unknown as T.WebGLRenderer;
  try {
    const result = await previewReflectionProbe(renderer, probe);
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(labels, ["+X", "-X", "+Y", "-Y", "+Z", "-Z"]);
    assert.ok(
      displayed[0][0] > displayed[0][8],
      "readback bottom-up rows are flipped",
    );
    assert.equal(canvas.width, 6);
    assert.equal(canvas.height, 52);
    fail = true;
    const error = await previewReflectionProbe(renderer, probe);
    assert.deepEqual(error, { ok: false, error: "readback rejected" });
    assert.deepEqual(
      restores.at(-1),
      [currentTarget, 4, 2],
      "restores current post-await target/face/mip",
    );
    fail = false;
    uninitialized = true;
    const empty = await previewReflectionProbe(renderer, probe);
    assert.equal(
      empty.ok,
      false,
      "uninitialized readback cannot claim a black successful capture",
    );
    assert.deepEqual(restores.at(-1), [currentTarget, 4, 2]);
    uninitialized = false;
    assert.equal(
      (await previewReflectionProbe(renderer, probe)).ok,
      true,
      "failed read releases the per-renderer guard",
    );
    probe.dirty = true;
    assert.equal((await previewReflectionProbe(renderer, probe)).ok, false);
  } finally {
    globalThis.document = previous;
    target.dispose();
    currentTarget.dispose();
  }
});

test("ACES diagnostic keeps HDR values finite and monotonic without clipping before tone mapping", () => {
  const low = probePreviewRgb([0.1, 0.1, 0.1], 1),
    high = probePreviewRgb([1, 1, 1], 1),
    hdr = probePreviewRgb([4, 4, 4], 1);
  assert.ok(low[0] < high[0] && high[0] < hdr[0]);
  assert.ok(probePreviewRgb([1, 1, 1], 2)[0] > high[0]);
  for (const channel of probePreviewRgb([NaN, -1, Infinity], 1))
    assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 255);
});
