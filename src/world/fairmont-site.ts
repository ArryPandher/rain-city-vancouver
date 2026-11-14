import polygonClipping from "polygon-clipping";
import map from "./fairmont-map.json";
import type { Point } from "./data";

export const FAIRMONT_ID = "w143683979";
export const fairmontParts = map.parts.map((part) => ({
  ...part,
  pts:
    signedArea(part.pts as Point[]) < 0
      ? ([...part.pts].reverse() as Point[])
      : (part.pts as Point[]),
}));
function signedArea(pts: Point[]) {
  return (
    pts.reduce((sum, p, i) => {
      const q = pts[(i + 1) % pts.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2
  );
}
export const fairmontFootprint = fairmontParts[0].pts.flat();
const origin: Point = [212.5, -600.38];
const length = Math.hypot(45.24, 17.2);
const ux = 45.24 / length,
  uz = 17.2 / length;
export function fairmontLocal(x: number, z: number): Point {
  const dx = x - origin[0],
    dz = z - origin[1];
  return [dx * ux + dz * uz, -dx * uz + dz * ux];
}
export function fairmontWorld(u: number, v: number): Point {
  return [origin[0] + u * ux - v * uz, origin[1] + u * uz + v * ux];
}

/** The OSM parts overlap. Build one exterior at each height, rather than
 * rendering coincident walls or leaving internal faces visible in the glass. */
export function fairmontSection(height: number): polygonClipping.MultiPolygon {
  const active = fairmontParts
    .slice(1)
    .filter((p) => p.minHeight <= height && p.height > height);
  if (!active.length) return [];
  return polygonClipping.union(
    [active[0].pts],
    ...active.slice(1).map((p) => [p.pts]),
  );
}
export function fairmontTowerSection(
  height: number,
): polygonClipping.MultiPolygon {
  const parts = fairmontParts.filter(
    (p) => p.height > 100 && p.height > height,
  );
  if (!parts.length) return [];
  return polygonClipping.union(
    [parts[0].pts],
    ...parts.slice(1).map((p) => [p.pts]),
  );
}

export const FAIRMONT_ROOFS = [2, 15, 30, 128, 132, 140];
export function fairmontRoof(height: number) {
  return polygonClipping.difference(
    fairmontSection(height - 0.01),
    fairmontSection(height + 0.01),
  );
}
