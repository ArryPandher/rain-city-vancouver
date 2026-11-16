import { buildingsOverlappingPolygon } from "./local-building-broadphase";
import clipping from "polygon-clipping";
import {
  pointInPoly,
  segmentPoint,
  type Building,
  type Point,
  type Road,
} from "./data";
import { PWC_PLACE_ID, PWC_PLACE_RING } from "./pwc-place-site";

type Polygon = { outer: Point[]; holes: Point[][] };
const points = (flat: readonly number[]): Point[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => [
    flat[i * 2],
    flat[i * 2 + 1],
  ]);
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};

/** Small forecourt between the retained Howe-facing edges and their projections
 * onto the existing mapped Howe way. No new roadway or building footprint. */
export function createPwcApronSite(options: {
  roads: readonly Road[];
  buildings: readonly Building[];
  primaryPolygons: readonly Polygon[];
  primaryContains: (x: number, z: number) => boolean;
  primaryHeight: (x: number, z: number) => number;
}) {
  const road = options.roads.find((r) => r.id === "w232195213");
  if (!road || !options.buildings.some((b) => b.id === PWC_PLACE_ID))
    return undefined;
  const path = points(road.pts),
    frontage = PWC_PLACE_RING.slice(0, 3);
  const nearestRoad = (p: Point) =>
    path
      .slice(1)
      .map((b, i) => ({ ...segmentPoint(...p, ...path[i], ...b), segment: i }))
      .reduce((a, b) => (a.d <= b.d ? a : b));
  const start = nearestRoad(frontage[0]),
    end = nearestRoad(frontage[2]);
  if (
    start.segment > end.segment ||
    (start.segment === end.segment && start.t >= end.t)
  )
    throw new Error("PwC Howe source registration changed");
  const boundary: Point[] = [
    ...frontage,
    [end.x, end.z],
    ...path.slice(start.segment + 1, end.segment + 1).reverse(),
    [start.x, start.z],
  ];
  const clipped = clipping.difference(
    [boundary],
    ...buildingsOverlappingPolygon(options.buildings, boundary).map((b) => [
      points(b.pts),
    ]),
  );
  const supportPolygons: Polygon[] = clipped.map((p) => ({
    outer: p[0].slice(0, -1) as Point[],
    holes: p.slice(1).map((h) => h.slice(0, -1) as Point[]),
  }));
  const flat = supportPolygons.map((p) => ({
    outer: p.outer.flat(),
    holes: p.holes.map((h) => h.flat()),
  }));
  const bounds = boundary.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p[0]),
      maxX: Math.max(b.maxX, p[0]),
      minZ: Math.min(b.minZ, p[1]),
      maxZ: Math.max(b.maxZ, p[1]),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  const inBounds = (x: number, z: number, margin = 0) =>
    x >= bounds.minX - margin &&
    x <= bounds.maxX + margin &&
    z >= bounds.minZ - margin &&
    z <= bounds.maxZ + margin;
  const contains = (x: number, z: number) =>
    inBounds(x, z) &&
    flat.some(
      (p) =>
        pointInPoly(x, z, p.outer) &&
        !p.holes.some((h) => pointInPoly(x, z, h)),
    );
  const edges = supportPolygons
    .flatMap((p) => [p.outer, ...p.holes])
    .flatMap((r) =>
      r.map((a, i) => [a, r[(i + 1) % r.length]] as [Point, Point]),
    );
  const covers = (x: number, z: number) =>
    inBounds(x, z, 0.0001) &&
    (contains(x, z) ||
      edges.some(([a, b]) => segmentPoint(x, z, ...a, ...b).d < 0.0001));
  const primaryEdges = options.primaryPolygons
    .flatMap((p) => [p.outer, ...p.holes])
    .flatMap((r) =>
      r.map((a, i) => [a, r[(i + 1) % r.length]] as [Point, Point]),
    )
    .filter(
      ([a, b]) =>
        Math.max(a[0], b[0]) >= bounds.minX - 2 &&
        Math.min(a[0], b[0]) <= bounds.maxX + 2 &&
        Math.max(a[1], b[1]) >= bounds.minZ - 2 &&
        Math.min(a[1], b[1]) <= bounds.maxZ + 2,
    );
  if (!primaryEdges.length) return undefined;
  const wallHeights = frontage.map((p) => {
    const q = nearestRoad(p);
    return options.primaryHeight(q.x, q.z);
  });
  const profileHeight = (x: number, z: number) => {
    const samples = frontage
      .slice(1)
      .map((b, i) => ({ ...segmentPoint(x, z, ...frontage[i], ...b), i }));
    const q = samples.reduce((a, b) => (a.d <= b.d ? a : b));
    const at = (p: typeof q) =>
      wallHeights[p.i] + (wallHeights[p.i + 1] - wallHeights[p.i]) * p.t;
    if (q.d < 1e-6) return at(q);
    const weights = samples.map(
      (p) => ((q.d * q.d + 1e-10) / (p.d * p.d + 1e-10)) ** 2,
    );
    return (
      samples.reduce((sum, p, i) => sum + at(p) * weights[i], 0) /
      weights.reduce((a, b) => a + b, 0)
    );
  };
  const height = (x: number, z: number) => {
    if (options.primaryContains(x, z)) return options.primaryHeight(x, z);
    const samples = primaryEdges.map(([a, b]) =>
      segmentPoint(x, z, ...a, ...b),
    );
    const nearest = samples.reduce((a, b) => (a.d <= b.d ? a : b));
    // Sample actual old support boundary, not its unmasked extrapolation. The
    // latter can introduce a steep lateral slope away from the mapped roadway.
    const weights = samples.map(
      (p) => ((nearest.d * nearest.d + 1e-10) / (p.d * p.d + 1e-10)) ** 2,
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    const tie =
      nearest.d < 1e-6
        ? options.primaryHeight(nearest.x, nearest.z)
        : samples.reduce(
            (h, p, i) => h + options.primaryHeight(p.x, p.z) * weights[i],
            0,
          ) / sum;
    const wallDistance = Math.min(
      ...frontage
        .slice(1)
        .map((b, i) => segmentPoint(x, z, ...frontage[i], ...b).d),
    );
    const blend = smooth(nearest.d / Math.max(1e-8, nearest.d + wallDistance));
    return tie * (1 - blend) + profileHeight(x, z) * blend;
  };
  return {
    contains,
    covers,
    height,
    profileHeight,
    supportPolygons,
    boundary,
    bounds,
    frontage,
    wallHeights,
  };
}
export type PwcApronSite = NonNullable<ReturnType<typeof createPwcApronSite>>;
