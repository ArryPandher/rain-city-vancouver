import { GALLERY_BISTRO as D } from "./gallery-bistro-data";
import {
  GALLERY_REAR_STEPS as S,
  galleryStairBackV,
} from "./gallery-entry-stairs-data";

/** Source-local finite contact. Existing Gallery provider supplies the transform
 * and capability gate; no global terrain or road height is changed. */
export function galleryBistroHeight(u: number, v: number, referenceY: number) {
  if (
    referenceY < D.top + S.datum - 0.35 ||
    u < D.cheekMaxU ||
    u > D.maxU ||
    v < galleryStairBackV(u) ||
    v > D.frontV
  )
    return;
  return D.top + S.datum;
}
export function galleryBistroBlocked(
  u: number,
  v: number,
  r: number,
  y: number,
  camera: boolean,
) {
  if (u < D.minU - r || u > D.maxU + r || v < 23 - r || v > D.cheekFrontV + r)
    return false;
  const low = camera ? y - r : y + 0.06,
    high = camera ? y + r : y + 1.8;
  const box = (
    a: number,
    b: number,
    c: number,
    d: number,
    bottom: number,
    top: number,
  ) =>
    high > bottom + S.datum &&
    low < top + S.datum &&
    Math.hypot(Math.max(a - u, 0, u - b), Math.max(c - v, 0, v - d)) < r;
  if (box(D.minU, D.maxU, galleryStairBackV(u), D.frontV, D.bottom, D.top))
    return true;
  if (box(D.minU, D.cheekMaxU, D.frontV, D.cheekFrontV, D.bottom, D.top))
    return true;
  for (const p of D.planters)
    if (
      box(
        p.minU,
        p.maxU,
        p.minV,
        p.maxV,
        D.top,
        D.top + D.planterHeight + D.foliageHeight,
      )
    )
      return true;
  for (const p of D.parasols) {
    const dist = Math.hypot(u - p.u, v - p.v);
    if (
      dist < r + 0.027 &&
      high > D.top + S.datum &&
      low < D.top + D.canopyPeak + S.datum
    )
      return true;
    if (
      dist < r + D.tableRadius &&
      high > D.top + D.tableHeight - 0.045 + S.datum &&
      low < D.top + D.tableHeight + S.datum
    )
      return true;
    if (
      box(p.u - 0.24, p.u + 0.24, p.v - 0.24, p.v + 0.24, D.top, D.top + 0.07)
    )
      return true;
    for (const [du, dv] of [
      [-0.85, 0],
      [0.85, 0],
      [0, -0.85],
      [0, 0.85],
    ])
      if (
        box(
          p.u + du - 0.235,
          p.u + du + 0.235,
          p.v + dv - 0.235,
          p.v + dv + 0.235,
          D.top,
          D.top + 0.88,
        )
      )
        return true;
    const extent = Math.max(Math.abs(u - p.u), Math.abs(v - p.v));
    if (extent < D.canopyWidth / 2 + r) {
      const eave = D.top + D.canopyEave + S.datum,
        slope = (D.canopyPeak - D.canopyEave) / (D.canopyWidth / 2);
      const nearest = Math.max(0, extent - r),
        farthest = Math.min(D.canopyWidth / 2, extent + r);
      const roofHigh = eave + (D.canopyWidth / 2 - nearest) * slope,
        roofLow = eave + (D.canopyWidth / 2 - farthest) * slope - 0.025;
      if (high > roofLow && low < roofHigh) return true;
    }
  }
  return false;
}
