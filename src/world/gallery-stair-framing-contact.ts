import {
  GALLERY_STAIR_FRAMING as D,
  galleryStairLocal,
  galleryStairRails,
} from "./gallery-stair-framing-data";

import {
  GALLERY_REAR_STEPS as S,
  galleryStairBackV,
} from "./gallery-entry-stairs-data";
const rails = galleryStairRails();
/** Finite wall and matching cylindrical rail contact, in the same source frame. */
export function galleryStairFramingBlocked(
  x: number,
  z: number,
  radius: number,
  y: number,
  camera: boolean,
) {
  const [u, v] = galleryStairLocal(x, z);
  if (
    v < D.minV - radius - 0.5 ||
    v > S.endV + radius + 0.1 ||
    u < D.terraces[0].minU - radius ||
    u > D.terraces[1].maxU + radius
  )
    return false;
  const low = camera ? y - radius : y + 0.06;
  const high = camera ? y + radius : y + 1.8;
  for (const t of D.terraces) {
    // Match the recessed wall and its wider120mm coping separately.
    for (const [insetU, insetV, bottom, top] of [
      [0.03, 0.015, D.bottom, D.top - 0.12],
      [0, 0, D.top - 0.12, D.top],
    ]) {
      if (high <= D.datum + bottom || low >= D.datum + top) continue;
      const du = Math.max(t.minU + insetU - u, 0, u - t.maxU + insetU);
      const dv = Math.max(D.minV + insetV - v, 0, v - D.maxV + insetV);
      if (Math.hypot(du, dv) < radius) return true;
    }
  }
  for (const { a, b } of rails) {
    // Clip the physical member against the actor/camera vertical interval,
    // then test its projected segment with radius. This cannot make an
    // infinitely high fence or a collision plane through the open stair.
    const dy = b[1] - a[1],
      minY = low - D.datum - D.railRadius,
      maxY = high - D.datum + D.railRadius;
    let t0 = 0,
      t1 = 1;
    if (Math.abs(dy) < 1e-9) {
      if (a[1] < minY || a[1] > maxY) continue;
    } else {
      const ta = (minY - a[1]) / dy,
        tb = (maxY - a[1]) / dy;
      t0 = Math.max(0, Math.min(ta, tb));
      t1 = Math.min(1, Math.max(ta, tb));
      if (t0 > t1) continue;
    }
    const ax = a[0] + (b[0] - a[0]) * t0,
      az = a[2] + (b[2] - a[2]) * t0;
    const dx = (b[0] - a[0]) * (t1 - t0),
      dz = (b[2] - a[2]) * (t1 - t0);
    const t = Math.max(
      0,
      Math.min(1, ((u - ax) * dx + (v - az) * dz) / (dx * dx + dz * dz || 1)),
    );
    if (Math.hypot(u - ax - dx * t, v - az - dz * t) < radius + D.railRadius)
      return true;
  }
  return false;
}
export function galleryStairFramingHeight(
  x: number,
  z: number,
  referenceY: number,
) {
  const [u, v] = galleryStairLocal(x, z),
    top = D.top + D.datum;
  if (
    referenceY < top - 0.35 ||
    v < Math.max(D.minV, galleryStairBackV(u)) ||
    v > D.maxV
  )
    return;
  if (D.terraces.some((t) => u >= t.minU && u <= t.maxU)) return top;
}
