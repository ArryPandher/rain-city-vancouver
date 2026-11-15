import { pointInPoly, segmentPoint } from "./data";
export const ROBSON_GARDEN_ID = "w1384440657";
export const ROBSON_CANOPIES = new Set(["w297300290", "w297300291"]);
export const robsonWalkableBuilding = (id: string) =>
  id === ROBSON_GARDEN_ID || ROBSON_CANOPIES.has(id);
export const gridUV = (x: number, z: number): [number, number] => [
  (x - z) / Math.SQRT2,
  (x + z) / Math.SQRT2,
];
export const gridXZ = (u: number, v: number): [number, number] => [
  (u + v) / Math.SQRT2,
  (v - u) / Math.SQRT2,
];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** A continuous interpretation of the roof garden, with grade-level perimeter access. */
export function robsonBaseHeight(x: number, z: number, footprint: number[]) {
  const [u, v] = gridUV(x, z);
  if (
    u < -300 ||
    u > -158 ||
    v < -44 ||
    v > 20 ||
    !pointInPoly(x, z, footprint)
  )
    return undefined;
  const terrace =
    u < -260
      ? 6.4
      : u < -248
        ? 6.4 - 3.2 * clamp((u + 260) / 12)
        : u < -225
          ? 3.2
          : u < -213
            ? 3.2 - 1.6 * clamp((u + 225) / 12)
            : u < -190
              ? 1.6
              : 1.6 * (1 - clamp((u + 190) / 12));
  let edge = Infinity;
  for (let i = 0; i < footprint.length; i += 2) {
    const j = (i + 2) % footprint.length;
    edge = Math.min(
      edge,
      segmentPoint(
        x,
        z,
        footprint[i],
        footprint[i + 1],
        footprint[j],
        footprint[j + 1],
      ).d,
    );
  }
  return 0.08 + Math.min(terrace, edge * 0.45);
}
/** Gallery-facing lower stair: authored within the existing northward grade
 * transition. The parallel route at v=-22 remains a continuous ramp. */
export const ROBSON_LOWER_STAIR = {
  startU: -190,
  endU: -178,
  minV: -18,
  maxV: -6,
  high: 1.68,
  low: 0.08,
  steps: 10,
};
export function robsonHeight(x: number, z: number, footprint: number[]) {
  const base = robsonBaseHeight(x, z, footprint);
  if (base === undefined) return;
  const [u, v] = gridUV(x, z),
    s = ROBSON_LOWER_STAIR;
  if (u < s.startU || u >= s.endU || v < s.minV || v > s.maxV) return base;
  const step = Math.min(
    s.steps - 1,
    Math.floor(((u - s.startU) / (s.endU - s.startU)) * s.steps + 1e-9),
  );
  return s.high - (step * (s.high - s.low)) / s.steps;
}
export const ROBSON_PLANTERS = [
  { u: -278, v: -35, w: 13, d: 5 },
  { u: -238, v: -35, w: 14, d: 5 },
  { u: -206, v: -35, w: 13, d: 5 },
  { u: -240, v: 10, w: 14, d: 5 },
  { u: -206, v: 10, w: 13, d: 5 },
];
export const ROBSON_POOL = { u: -274, v: -12, w: 18, d: 12 };
export function robsonObstacle(x: number, z: number, r: number) {
  const [u, v] = gridUV(x, z);
  if (u < -300 - r || u > -180 + r || v < -42 - r || v > 18 + r) return false;
  return [...ROBSON_PLANTERS, ROBSON_POOL].some(
    (b) =>
      Math.hypot(
        Math.max(0, Math.abs(u - b.u) - b.w / 2),
        Math.max(0, Math.abs(v - b.v) - b.d / 2),
      ) < r ||
      (Math.abs(u - b.u) <= b.w / 2 && Math.abs(v - b.v) <= b.d / 2),
  );
}
