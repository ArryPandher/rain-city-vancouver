import polygonClipping from "polygon-clipping";
import map from "./rogers-map.json";
import type { Point } from "./data";
export const ROGERS_ID = "w361502265";
// Interpretation of storey-only map tags; explicit metre tags take priority.
const storeyHeights: Record<number, number> = {
  3: 11.6,
  7: 26.4,
  10: 37.2,
  17: 62.4,
};
export const ROGERS_BASE = 5;
export const rogersParts = map.parts.map((p) => {
  let pts = p.pts as Point[];
  const area = pts.reduce((a, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area < 0) pts = [...pts].reverse();
  return { ...p, pts, height: p.height || storeyHeights[p.levels] || 0 };
});
export const rogersFootprint = rogersParts[0].pts.flat();
const length = Math.hypot(0.721, 0.693),
  ux = 0.721 / length,
  uz = 0.693 / length;
export function rogersWorld(u: number, v: number): Point {
  return [136.08 + u * ux - v * uz, -629.07 + u * uz + v * ux];
}
export function rogersLocal(x: number, z: number): Point {
  return [
    (x - 136.08) * ux + (z + 629.07) * uz,
    -(x - 136.08) * uz + (z + 629.07) * ux,
  ];
}
export function rogersSection(height: number): polygonClipping.MultiPolygon {
  const active = rogersParts.slice(1).filter((p) => p.height > height);
  if (!active.length) return [];
  return polygonClipping.union(
    [active[0].pts],
    ...active.slice(1).map((p) => [p.pts]),
  );
}
export const ROGERS_ROOFS = [11.6, 26.4, 37.2, 62.4, 142, 149];
export function rogersRoof(height: number) {
  return polygonClipping.difference(
    rogersSection(height - 0.01),
    rogersSection(height + 0.01),
  );
}
// Light Art's pool is interpreted at the foot of the north-facing light shaft.
export const ROGERS_LIGHT: Point = rogersWorld(22.35, -13.9);
export const ROGERS_POOL = [
  [20.9, -14.2],
  [25.9, -14.2],
  [26.2, -17.1],
  [25.2, -18.5],
  [21.8, -18.5],
  [20.6, -17.1],
].map((p) => rogersWorld(p[0], p[1]));
