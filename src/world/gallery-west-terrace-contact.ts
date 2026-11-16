import {
  GALLERY_WEST_TERRACE as D,
  galleryWestTerraceBoxes,
} from "./gallery-west-terrace-data";
const boxes = galleryWestTerraceBoxes();
/** Addition only: does not exempt or open the existing private gallery mass. */
export function galleryWestTerraceBlocked(
  u: number,
  v: number,
  radius: number,
  worldY: number,
  camera: boolean,
) {
  if (![u, v, radius, worldY].every(Number.isFinite) || radius < 0)
    return false;
  if (
    u < D.minU - radius ||
    u > D.maxU + radius ||
    v < D.rearV - radius ||
    v > D.frontV + radius
  )
    return false;
  const localY = worldY - D.datum;
  return boxes.some((b) => {
    const du = Math.max(b.minU - u, 0, u - b.maxU),
      dv = Math.max(b.minV - v, 0, v - b.maxV);
    if (camera) {
      const dy = Math.max(b.bottom - localY, 0, localY - b.top);
      return Math.hypot(du, dv, dy) < radius;
    }
    return (
      localY + 1.8 > b.bottom &&
      localY + 0.06 < b.top &&
      Math.hypot(du, dv) < radius
    );
  });
}
