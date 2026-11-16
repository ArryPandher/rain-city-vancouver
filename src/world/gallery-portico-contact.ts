import {
  GALLERY_PORTICO as D,
  GALLERY_PORTICO_SHAFT_PROFILE,
} from "./gallery-portico-data";
import { GALLERY_REAR_STEPS } from "./gallery-entry-stairs-data";

const profile: readonly (readonly [number, number])[] = [
  [3.2, 0.554],
  ...GALLERY_PORTICO_SHAFT_PROFILE.map(
    ([radius, height]) => [height, radius] as const,
  ),
];

/** Finite source-local column volumes. Ground/roof support is not changed.
 * Circular caps are a conservative bound on the24-sided rendered stone (<5mm). */
export function galleryPorticoBlocked(
  u: number,
  v: number,
  radius: number,
  y: number,
  camera: boolean,
) {
  if (
    u < D.shaftU[0] - radius - 0.71 ||
    u > D.shaftU[4] + radius + 0.71 ||
    Math.abs(v - D.shaftV) > radius + 0.6
  )
    return false;
  const low = (camera ? y - radius : y + 0.06) - GALLERY_REAR_STEPS.datum;
  const high = (camera ? y + radius : y + 1.8) - GALLERY_REAR_STEPS.datum;
  if (high <= 3.2 || low >= D.capitalTop) return false;
  let r = 0;
  for (let i = 1; i < profile.length; i++) {
    const [a, ar] = profile[i - 1],
      [b, br] = profile[i];
    const start = Math.max(low, a),
      end = Math.min(high, b);
    if (start > end) continue;
    r = Math.max(
      r,
      ar + ((br - ar) * (start - a)) / (b - a),
      ar + ((br - ar) * (end - a)) / (b - a),
    );
  }
  for (const x of D.shaftU) {
    if (r > 0 && Math.hypot(u - x, v - D.shaftV) < radius + r) return true;
    // Echinus/cushion and top abacus remain finite for close upward camera sweeps.
    for (const [bottom, top, halfU, halfV] of [
      [11.54, 11.72, 0.53, 0.53],
      [11.72, 11.94, 0.52, 0.455],
      [11.9, 12.05, 0.7, 0.59],
    ]) {
      if (high <= bottom || low >= top) continue;
      if (
        Math.hypot(
          Math.max(0, Math.abs(u - x) - halfU),
          Math.max(0, Math.abs(v - D.shaftV) - halfV),
        ) < radius
      )
        return true;
    }
    for (const side of [-1, 1]) {
      const dy = Math.max(low - D.scrollCentreY, 0, D.scrollCentreY - high);
      if (dy >= D.scrollRadius) continue;
      const halfU = Math.sqrt(D.scrollRadius * D.scrollRadius - dy * dy);
      if (
        Math.hypot(
          Math.max(0, Math.abs(u - x - side * D.scrollOffset) - halfU),
          Math.max(0, Math.abs(v - D.shaftV) - 0.47),
        ) < radius
      )
        return true;
    }
  }
  return false;
}
