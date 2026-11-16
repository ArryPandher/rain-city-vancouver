import {
  GALLERY_REAR_STEPS as S,
  galleryStairBackV,
} from "./gallery-entry-stairs-data";

/** Official 2023 photograph establishes a broad planted bistro platform and
 * full-size parasols. Footprint and furniture stations are bounded estimates,
 * fitted to the decoded facade and clear of mapped transverse circulation. */
export const GALLERY_BISTRO = {
  minU: S.maxU,
  cheekMaxU: S.maxU + 1.8,
  maxU: 19,
  frontV: 28.3,
  cheekFrontV: 30.93,
  top: S.top,
  bottom: -S.datum,
  parasols: [
    { u: 8.2, v: 25.85 },
    { u: 12.5, v: 25.85 },
    { u: 16.8, v: 25.85 },
  ],
  canopyWidth: 3,
  canopyEave: 2.35,
  canopyPeak: 3.03,
  tableRadius: 0.49,
  tableHeight: 0.74,
  planters: [
    { minU: 6.05, maxU: 18.72, minV: 27.43, maxV: 28.12 },
    { minU: 18.2, maxU: 18.85, minV: 23.58, maxV: 27.43 },
  ],
  planterHeight: 0.64,
  foliageHeight: 0.48,
} as const;
export function galleryBistroRing(): [number, number][] {
  const d = GALLERY_BISTRO;
  return [
    [d.minU, galleryStairBackV(d.minU)],
    [d.maxU, galleryStairBackV(d.maxU)],
    [d.maxU, d.frontV],
    [d.cheekMaxU, d.frontV],
    [d.cheekMaxU, d.cheekFrontV],
    [d.minU, d.cheekFrontV],
  ];
}
