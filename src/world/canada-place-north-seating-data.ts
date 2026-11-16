import * as T from "three";
import { geo, pointInPoly, segmentPoint } from "./data";
import source from "./canada-place-deck-data.json";

/** Metalco identifies Natural Puzzle at Canada Place. Public supplier dimensions
 * vary slightly by catalogue: this uses the 2.15×2.16m / .423m family. Shape and
 * placement are original fitted reconstructions, not manufacturer CAD. */
export const CANADA_PLACE_NORTH_SEATING = {
  ground: 7.798935890197754,
  datum: 0.08,
  height: 0.423,
  slab: 0.15,
  width: 2.15,
  depth: 2.16,
  bevel: 0.012,
  legRadius: 0.07,
  // Ordinary walking capsule; near-top support and side contact must agree.
  landingRadius: 0.36,
  placements: [
    { x: 74, z: -76, yaw: -0.2 },
    { x: 84, z: -66, yaw: 0.35 },
  ],
  legs: [
    [-0.72, 0.37],
    [0.66, 0.57],
    [-0.16, -0.76],
    [0.39, -0.49],
  ],
} as const;
/** Bounded west part of the photographed northern forecourt only. Actual PIER,
 * hall/terminal solids and rail inset remain mandatory eligibility conditions. */
export const CANADA_PLACE_NORTH_FORECOURT: number[][] = [
  [45, -82],
  [84, -88],
  [89, -78],
  [86, -56],
  [61, -56],
  [48, -64],
];
export const CANADA_PLACE_NORTH_SEATING_APPROACH = [
  [42, -75],
  [58, -76],
  [68, -70],
  [77, -61],
  [82, -59],
] as const;
const origin = geo(source.origin[1], source.origin[0]);
export function canadaPlaceNorthSeatOutline(): [number, number][] {
  const s = new T.Shape();
  s.moveTo(-0.3, -1.08);
  s.bezierCurveTo(-0.05, -1.12, 0.35, -1.12, 0.38, -0.85);
  s.bezierCurveTo(0.18, -0.72, 0.24, -0.61, 0.57, -0.58);
  s.bezierCurveTo(0.82, -0.55, 0.64, -0.32, 0.4, -0.34);
  s.bezierCurveTo(0.15, -0.34, 0.1, -0.1, 0.4, 0);
  s.bezierCurveTo(0.74, 0.12, 1.07, 0.22, 1.07, 0.63);
  s.bezierCurveTo(1.05, 1.1, 0.6, 1.08, 0.4, 0.9);
  s.bezierCurveTo(0.15, 0.72, 0.24, 0.45, -0.08, 0.4);
  s.bezierCurveTo(-0.4, 0.38, -0.43, 0.63, -0.65, 0.75);
  s.bezierCurveTo(-1, 0.92, -1.1, 0.59, -1.06, 0.3);
  s.bezierCurveTo(-1.08, 0.05, -0.85, -0.07, -0.66, -0.02);
  s.bezierCurveTo(-0.26, 0.1, -0.02, -0.15, -0.24, -0.37);
  s.bezierCurveTo(-0.5, -0.63, -0.58, -0.98, -0.3, -1.08);
  const points = s.getSpacedPoints(96).slice(0, -1),
    xs = points.map((p) => p.x),
    zs = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  return points.map((p) => [
    ((p.x - (minX + maxX) / 2) / (maxX - minX)) * 2.15,
    ((p.y - (minZ + maxZ) / 2) / (maxZ - minZ)) * 2.16,
  ]);
}
export const CANADA_PLACE_NORTH_SEAT_OUTLINE = canadaPlaceNorthSeatOutline();
export function northSeatPoint(
  p: (typeof CANADA_PLACE_NORTH_SEATING.placements)[number],
  u: number,
  v: number,
): [number, number] {
  return [
    p.x + Math.cos(p.yaw) * u + Math.sin(p.yaw) * v,
    p.z - Math.sin(p.yaw) * u + Math.cos(p.yaw) * v,
  ];
}
const outlines = CANADA_PLACE_NORTH_SEATING.placements.map((p) =>
  CANADA_PLACE_NORTH_SEAT_OUTLINE.flatMap(([u, v]) => {
    const [x, z] = northSeatPoint(p, u, v);
    return [x + origin[0], z + origin[1]];
  }),
);
function near(x: number, z: number, r = 0) {
  return (
    x >= origin[0] + 71 - r &&
    x <= origin[0] + 87 + r &&
    z >= origin[1] - 79 - r &&
    z <= origin[1] - 63 + r
  );
}
function inside(x: number, z: number, r: number) {
  if (!near(x, z, r)) return false;
  return outlines.some(
    (poly) =>
      pointInPoly(x, z, poly) ||
      poly.some(
        (_, i) =>
          i % 2 === 0 &&
          segmentPoint(
            x,
            z,
            poly[i],
            poly[i + 1],
            poly[(i + 2) % poly.length],
            poly[(i + 3) % poly.length],
          ).d <=
            r + CANADA_PLACE_NORTH_SEATING.bevel,
      ),
  );
}
export function canadaPlaceNorthSeatAt(
  x: number,
  z: number,
  r: number,
  y: number,
  bodyHeight: number,
) {
  if (!near(x, z, r)) return false;
  const d = CANADA_PLACE_NORTH_SEATING,
    base = d.ground + d.datum;
  if (y >= base + d.height - 1e-8 || y + bodyHeight <= base) return false;
  if (y + bodyHeight >= base + d.height - d.slab && inside(x, z, r))
    return true;
  // Below the slab, only the physical tubular supports obstruct a camera.
  return d.placements.some((p) =>
    d.legs.some(([u, v]) => {
      const [a, b] = northSeatPoint(p, u, v);
      return (
        Math.hypot(x - a - origin[0], z - b - origin[1]) <= r + d.legRadius
      );
    }),
  );
}
export function canadaPlaceNorthSeatHeight(
  x: number,
  z: number,
  referenceY: number,
) {
  const top =
    CANADA_PLACE_NORTH_SEATING.ground +
    CANADA_PLACE_NORTH_SEATING.datum +
    CANADA_PLACE_NORTH_SEATING.height;
  if (
    referenceY >= top - 0.2 &&
    inside(x, z, CANADA_PLACE_NORTH_SEATING.landingRadius)
  )
    return top;
}
