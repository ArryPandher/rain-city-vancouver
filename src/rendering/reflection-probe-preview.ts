import * as T from "three";
import type { SceneReflections } from "./reflection-probes";

const active = new WeakSet<T.WebGLRenderer>();
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** CPU equivalent of installed Three ACESFilmicToneMapping + sRGB output.
 * Small CPU/GPU rounding differences remain; this excludes all composer effects
 * (bloom/contact occlusion/post-grade) and is NOT a final-game screenshot match.
 */
export function probePreviewRgb(
  rgb: readonly number[],
  exposure: number,
): number[] {
  const c = rgb.map(
    (v) => (Math.max(0, Number.isFinite(v) ? v : 0) * exposure) / 0.6,
  );
  const input = [
    0.59719 * c[0] + 0.35458 * c[1] + 0.04823 * c[2],
    0.076 * c[0] + 0.90834 * c[1] + 0.01566 * c[2],
    0.0284 * c[0] + 0.13383 * c[1] + 0.83777 * c[2],
  ].map(
    (v) =>
      (v * (v + 0.0245786) - 0.000090537) /
      (v * (0.983729 * v + 0.432951) + 0.238081),
  );
  return [
    1.60475 * input[0] - 0.53108 * input[1] - 0.07367 * input[2],
    -0.10208 * input[0] + 1.10813 * input[1] - 0.00605 * input[2],
    -0.00327 * input[0] - 0.07276 * input[1] + 1.07602 * input[2],
  ].map((v) => {
    const linear = clamp(v);
    return Math.round(
      255 *
        (linear <= 0.0031308
          ? 12.92 * linear
          : 1.055 * linear ** (1 / 2.4) - 0.055),
    );
  });
}

/** On-demand inspection of existing raw cube faces, before PMREM filtering.
 * Never invokes a render/capture or changes scene visibility/render settings.
 * A failed read rebinds the renderer's current logical framebuffer for recovery.
 * Caller owns showing/exporting the returned canvas and should disable its
 * button until this promise settles. Unsupported readbacks return an error.
 */
export async function previewReflectionProbe(
  renderer: T.WebGLRenderer,
  probe: SceneReflections["probes"][number],
): Promise<
  | { ok: true; canvas: HTMLCanvasElement; description: string }
  | { ok: false; error: string }
> {
  if (active.has(renderer))
    return { ok: false, error: "A probe preview is already being read." };
  active.add(renderer);
  try {
    if (probe.dirty)
      throw new Error("This probe has no current capture to inspect.");
    if (probe.target.texture.type !== T.HalfFloatType)
      throw new Error("Preview requires an existing HalfFloat cube target.");
    if (renderer.toneMapping !== T.ACESFilmicToneMapping)
      throw new Error(
        "Preview currently supports the game's ACES tone mapping only.",
      );
    const size = probe.target.width,
      exposure = renderer.toneMappingExposure;
    if (
      !Number.isInteger(size) ||
      size < 1 ||
      size > 1024 ||
      probe.target.height !== size
    )
      throw new Error("Unsupported cube target dimensions.");
    const canvas = document.createElement("canvas"),
      labelHeight = 24;
    canvas.width = size * 3;
    canvas.height = (size + labelHeight) * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas preview is unavailable.");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#fff";
    const buffer = new Uint16Array(size * size * 4);
    const labels = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
    for (let face = 0; face < 6; face++) {
      try {
        const result = await renderer.readRenderTargetPixelsAsync(
          probe.target,
          0,
          0,
          size,
          size,
          buffer,
          face,
        );
        if (result === undefined)
          throw new Error(
            "Probe framebuffer is uninitialized; no pixels were read.",
          );
      } catch (error) {
        // Three can bind the read framebuffer before rejecting its format/type.
        // Read CURRENT logical state after awaiting: the game may have rendered
        // another target meanwhile. Never restore a stale pre-read snapshot.
        try {
          renderer.setRenderTarget(
            renderer.getRenderTarget(),
            renderer.getActiveCubeFace(),
            renderer.getActiveMipmapLevel(),
          );
        } catch (restoreError) {
          throw new Error(
            `Probe readback and framebuffer restoration failed: ${String(error)}; ${String(restoreError)}`,
          );
        }
        throw error;
      }
      const pixels = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const source = ((size - 1 - y) * size + x) * 4,
            destination = (y * size + x) * 4;
          const rgb = probePreviewRgb(
            [
              T.DataUtils.fromHalfFloat(buffer[source]),
              T.DataUtils.fromHalfFloat(buffer[source + 1]),
              T.DataUtils.fromHalfFloat(buffer[source + 2]),
            ],
            exposure,
          );
          pixels.data.set([...rgb, 255], destination);
        }
      const x = (face % 3) * size,
        y = Math.floor(face / 3) * (size + labelHeight);
      ctx.fillText(labels[face], x + 6, y + 16);
      ctx.putImageData(pixels, x, y + labelHeight);
    }
    const description = `${probe.spec.name}: existing raw ${size}px cube faces; exposure ${exposure}. ACES/sRGB CPU preview, without PMREM, bloom or final grading. Face orientation is each cube camera's view, not a panorama.`;
    canvas.setAttribute("aria-label", description);
    return { ok: true, canvas, description };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    active.delete(renderer);
  }
}
