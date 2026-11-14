import { pointInPoly, segmentPoint } from "./data";
import map from "./prospect-lookout-map.json";
export const LOOKOUT_ROADS = new Set(
  Object.keys(map.ways).filter((id) => id !== "w361265984"),
);
export const LOOKOUT_UPPER = map.ways.w1158086219.pts;
export const LOOKOUT_FENCE = map.ways.w361265984.pts;
export const LOOKOUT_COURT = [
  -1610, -3405.2, -1606.8, -3408, -1601.4, -3408, -1597, -3406.8, -1594.7,
  -3403.8, -1594.3, -3400.8, -1594.8, -3396.8, -1594.9, -3393.1, -1597.5,
  -3392.2,
];
export const LOOKOUT_GARDEN = [
  -1603.7, -3401.9, -1601.5, -3403, -1599.7, -3402, -1599.8, -3399.4, -1601.5,
  -3398.4, -1603.8, -3399.6,
];
export function pathRectangle(a: number[], b: number[], width: number) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    nx = ((dz / length) * width) / 2,
    nz = ((-dx / length) * width) / 2;
  return [
    a[0] + nx,
    a[1] + nz,
    b[0] + nx,
    b[1] + nz,
    b[0] - nx,
    b[1] - nz,
    a[0] - nx,
    a[1] - nz,
  ];
}
export interface LookoutFlight {
  a: number[];
  b: number[];
  top: number;
  bottom: number;
  width: number;
  steps: number;
  pts: number[];
}
function flight(
  a: number[],
  b: number[],
  top: number,
  bottom: number,
  width = 2.6,
): LookoutFlight {
  return {
    a,
    b,
    top,
    bottom,
    width,
    steps: Math.ceil((top - bottom) / 0.17),
    pts: pathRectangle(a, b, width),
  };
}
const top = [-1632.27, -3378.81],
  mid = [-1621, -3392.8],
  bottom = [-1613.3, -3402.5],
  length = Math.hypot(bottom[0] - top[0], bottom[1] - top[1]),
  direction = [(bottom[0] - top[0]) / length, (bottom[1] - top[1]) / length],
  before = mid.map((n, i) => n - direction[i] * 1.2),
  after = mid.map((n, i) => n + direction[i] * 1.2);
export const LOOKOUT_FLIGHTS = [
  flight(top, before, 66, 61.4),
  flight(after, bottom, 61.4, 58.4),
  flight([-1610.3, -3401.8], [-1607.2, -3405.1], 58.4, 56.3),
  flight([-1599.7, -3391.2], [-1596.4, -3394.9], 58.4, 56.3),
];
type Level = {
  pts: number[];
  height: number;
  kind: "concrete" | "asphalt" | "grass";
};
function pathAreas(pts: number[], height: number, width = 2.8) {
  const out: Level[] = [];
  for (let i = 0; i < pts.length - 2; i += 2)
    out.push({
      pts: pathRectangle(pts.slice(i, i + 2), pts.slice(i + 2, i + 4), width),
      height,
      kind: "asphalt",
    });
  // Round caps fill the turning wedges between adjoining path rectangles.
  for (let i = 0; i < pts.length; i += 2)
    out.push({
      height,
      kind: "asphalt",
      pts: Array.from({ length: 16 }, (_, j) => [
        pts[i] + (Math.cos((j * Math.PI) / 8) * width) / 2,
        pts[i + 1] + (Math.sin((j * Math.PI) / 8) * width) / 2,
      ]).flat(),
    });
  return out;
}
export const LOOKOUT_LEVELS: Level[] = [
  { pts: LOOKOUT_GARDEN, height: 56.55, kind: "grass" },
  { pts: LOOKOUT_UPPER, height: 66, kind: "concrete" },
  { pts: LOOKOUT_COURT, height: 56.3, kind: "concrete" },
  { pts: pathRectangle(before, after, 2.8), height: 61.4, kind: "concrete" },
  ...pathAreas(map.ways.w190392418.pts, 61.4),
  ...pathAreas(map.ways.w190392419.pts, 58.4),
];
export const LOOKOUT_CUTOUTS = [
  ...LOOKOUT_LEVELS.map((a) => a.pts),
  ...LOOKOUT_FLIGHTS.map((f) => f.pts),
];
export function lookoutFlightHeight(f: LookoutFlight, x: number, z: number) {
  const t = segmentPoint(x, z, f.a[0], f.a[1], f.b[0], f.b[1]).t,
    step = Math.min(f.steps - 1, Math.floor(t * f.steps));
  return f.top - ((f.top - f.bottom) * (step + 1)) / f.steps;
}
/** Explicit interpreted construction levels share their tread heights with actors. */
export function prospectLookoutHeight(
  x: number,
  z: number,
): number | undefined {
  if (x < -1652 || x > -1591 || z < -3411 || z > -3353) return;
  for (const f of LOOKOUT_FLIGHTS)
    if (pointInPoly(x, z, f.pts)) return lookoutFlightHeight(f, x, z);
  for (const a of LOOKOUT_LEVELS) if (pointInPoly(x, z, a.pts)) return a.height;
}
