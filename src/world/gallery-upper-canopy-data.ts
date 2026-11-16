/** Modern upper east terrace, fitted to official2023 rear photograph.
 * Six visible stations/five bays supersede the initial four-bay proposal.
 * The cropped far end and hidden back anchorage remain inferred. */
export const GALLERY_UPPER_CANOPY = {
  base: 13.14921760559082,
  minU: 7.65,
  maxU: 19.05,
  // Image x[569,611.75,645.5,706.5,775.25,845.5], horizontalVP~−179.
  // Rectified by reciprocal distance from the vanishing point, not equal spacing.
  stations: [
    7.65, 9.9337547621, 11.5693837196, 14.209220081, 16.7797977011, 19.05,
  ],
  front: 22.95,
  back: 17.9,
  frontPost: 22.2,
  backPost: 18.15,
  roofRise: 3.4,
  arch: 0.4,
  rearFall: 0.12,
  tensionSag: 0.075,
  fabricThickness: 0.018,
  glassV: 22.42,
  glassBottom: 0.83,
  glassTop: 2.55,
  footWidth: 0.24,
  postWidth: 0.11,
} as const;
/** t runs from public front to hidden rear. Convex transverse roof with small
 * inter-frame sag; derivatives allow smooth physical normals on both skins. */
export function galleryUpperCanopyRoof(s: number, t: number) {
  const d = GALLERY_UPPER_CANOPY;
  return (
    d.base +
    d.roofRise +
    d.arch * Math.sin(Math.PI * t) -
    d.rearFall * t -
    d.tensionSag * Math.sin(Math.PI * s) * Math.sin(Math.PI * t)
  );
}
export function galleryUpperCanopyRoofGradient(
  s: number,
  t: number,
  width: number,
) {
  const d = GALLERY_UPPER_CANOPY;
  return [
    (-d.tensionSag * Math.PI * Math.cos(Math.PI * s) * Math.sin(Math.PI * t)) /
      width,
    (d.arch * Math.PI * Math.cos(Math.PI * t) -
      d.rearFall -
      d.tensionSag * Math.PI * Math.sin(Math.PI * s) * Math.cos(Math.PI * t)) /
      (d.back - d.front),
  ] as const;
}
