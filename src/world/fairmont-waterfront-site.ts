import { pointInPoly, type Point } from "./data";
import source from "./fairmont-waterfront-parts.json";

export const FAIRMONT_WATERFRONT_ID = "w363651936";
export const FAIRMONT_WATERFRONT_ORIGIN: Point = [430.367, -472.925];
export const FAIRMONT_WATERFRONT_BASE_HEIGHT = 8;
export const FAIRMONT_WATERFRONT_BODY_HEIGHT = 64;
/** Historical LiDAR group maximum, not a surveyed architectural elevation. */
export const FAIRMONT_WATERFRONT_HEIGHT = 69.44;
export const FAIRMONT_WATERFRONT_RING = source.baseRing as Point[];
export const FAIRMONT_WATERFRONT_CANOPY_SOURCE_RING = source.canopy
  .ring as Point[];
/** City 162733: 22.08 m top minus 15.65 m local base = 6.43 m.
 * Applied above the local apron; the sampled slope is an integration estimate. */
export const FAIRMONT_WATERFRONT_CANOPY_TOP = 6.43;
export const FAIRMONT_WATERFRONT_CANOPY_UNDERSIDE =
  FAIRMONT_WATERFRONT_CANOPY_TOP - 0.64;
/** Preserve the existing fourth-level row; only the Howe base grows to it. */
export const FAIRMONT_WATERFRONT_HOWE_BASE_TOP = 8 + (2 * 56) / 19;
// Historical roof points exceed the retained wall by roughly 1–2 m. Move only
// the attachment edge into that wall; preserve the mapped outer projection.
export const FAIRMONT_WATERFRONT_CANOPY_RING: Point[] =
  FAIRMONT_WATERFRONT_CANOPY_SOURCE_RING.map((p, i) => {
    if (i < 1 || i > 7) return [...p];
    const dx = FAIRMONT_WATERFRONT_ORIGIN[0] - p[0],
      dz = FAIRMONT_WATERFRONT_ORIGIN[1] - p[1],
      length = Math.hypot(dx, dz);
    let distance = 0;
    while (
      distance < length &&
      !pointInPoly(
        p[0] + (dx * distance) / length,
        p[1] + (dz * distance) / length,
        FAIRMONT_WATERFRONT_RING.flat(),
      )
    )
      distance += 0.025;
    distance += 0.25;
    return [p[0] + (dx * distance) / length, p[1] + (dz * distance) / length];
  });
export const FAIRMONT_WATERFRONT_PARTS = source.parts as {
  name: string;
  osmId: number;
  low: number;
  high: number;
  osmHeight: string;
  ring: Point[];
}[];
export const fairmontWaterfrontLevel = (level: number) =>
  level <= 2
    ? level * 4
    : level <= 21
      ? 8 + ((level - 2) * 56) / 19
      : 64 + ((level - 21) * (FAIRMONT_WATERFRONT_HEIGHT - 64)) / 2;
/** Heights are shared by parts and internal-face suppression; no ground uplift. */
export function fairmontWaterfrontPartHeight(x: number, z: number) {
  let h = pointInPoly(x, z, FAIRMONT_WATERFRONT_RING.flat()) ? 8 : 0;
  for (const p of FAIRMONT_WATERFRONT_PARTS)
    if (pointInPoly(x, z, p.ring.flat())) h = Math.max(h, p.high);
  return h;
}
