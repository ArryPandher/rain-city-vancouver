import {
  PAN_PACIFIC_HOWE_PODIUM as D,
  PAN_PACIFIC_HOWE_RUN as RUN,
  PAN_PACIFIC_HOWE_RUN_STATIONS as STATIONS,
  PAN_PACIFIC_HOWE_LENGTH as LENGTH,
} from "./pan-pacific-howe-podium-data";
import { panPacificHowePodiumPoint } from "./pan-pacific-howe-podium";

const margin = 0.035;
const edges = RUN.slice(0, -1).map((a, i) => {
  const dx = RUN[i + 1][0] - a[0],
    dz = RUN[i + 1][1] - a[1];
  const length = Math.hypot(dx, dz);
  return {
    x: a[0],
    z: a[1],
    dx: dx / length,
    dz: dz / length,
    length,
    station: STATIONS[i],
  };
});
const columns = D.supports.map(({ u }) =>
  panPacificHowePodiumPoint(u, 0, -D.columnInset),
);

/** Camera-only exception to the old solid HOTEL proxy. Caller MUST gate by the
 * loaded podium capability, subtract landmark origin/+0.08y, and retain all
 * other collision checks. This supplies no actor, floor or public-route access.
 * Five segment projections and six support checks; no per-frame mesh queries. */
export function panPacificHowePodiumCameraClearance(
  localX: number,
  localZ: number,
  r: number,
  localY: number,
): boolean {
  if (
    !Number.isFinite(localX) ||
    !Number.isFinite(localZ) ||
    !Number.isFinite(r) ||
    !Number.isFinite(localY) ||
    r < 0
  )
    return false;
  const clearance = r + margin,
    low = localY - clearance,
    high = localY + clearance;
  if (low <= D.floor || high >= D.lowerBeamBottom - 0.014) return false;
  let nearest = Infinity,
    along = 0,
    out = 0;
  for (const edge of edges) {
    const x = localX - edge.x,
      z = localZ - edge.z;
    const s = x * edge.dx + z * edge.dz;
    const clipped = Math.max(0, Math.min(edge.length, s));
    const distance =
      (x - clipped * edge.dx) ** 2 + (z - clipped * edge.dz) ** 2;
    if (distance < nearest) {
      nearest = distance;
      along = edge.station + s;
      out = -x * edge.dz + z * edge.dx;
    }
  }
  // End cheeks occupy .0035 of the run and have angled mitered boundaries.
  // Extra centimetres cover their slight change of normal and GLB quantization.
  const end = 0.0035 * LENGTH + clearance;
  if (along <= end || along >= LENGTH - end) return false;
  // Frontmost lower backing/frame face is recess-.05 inward. A narrow exterior
  // mouth crosses ONLY the old proxy's .55m trim inflation, without widening
  // the longitudinal interval or opening any other hotel elevation.
  if (out < -D.recess + 0.05 + clearance || out > 0.55 + r + margin)
    return false;
  // Continuous envelopes retain the thin open rails and every repeated post.
  if (
    low <= D.floor + D.guardHeight &&
    out <= -0.14 + 0.015 + clearance &&
    out >= -0.14 - 0.045 - clearance
  )
    return false;
  const galleryFront = -D.galleryInset;
  if (
    low <= D.galleryY &&
    high >= D.galleryY - 0.25 &&
    out <= galleryFront + clearance
  )
    return false;
  const galleryRail = -D.galleryInset - 0.03;
  if (
    low <= D.galleryY + D.guardHeight &&
    high >= D.galleryY &&
    out <= galleryRail + 0.015 + clearance &&
    out >= galleryRail - 0.045 - clearance
  )
    return false;
  // Conservative enclosing radii include octagonal flares and square bearings.
  let supportRadius: number = D.columnRadius;
  if (low <= D.floor + 0.18) supportRadius = 0.51;
  if (high >= 13.66) supportRadius = Math.max(supportRadius, 0.47);
  if (high >= 13.86) supportRadius = Math.max(supportRadius, 0.66);
  if (high >= 14.12) supportRadius = Math.max(supportRadius, Math.SQRT2 * 0.6);
  for (const p of columns)
    if (Math.hypot(localX - p.x, localZ - p.z) <= supportRadius + clearance)
      return false;
  return true;
}
