import { buildingsOverlappingPolygon } from "./local-building-broadphase";
import clipping from "polygon-clipping";
import {
  pointInPoly,
  segmentPoint,
  type Building,
  type Point,
  type Road,
} from "./data";
import {
  FAIRMONT_WATERFRONT_ID,
  FAIRMONT_WATERFRONT_RING as hotel,
} from "./fairmont-waterfront-site";

/** This mapped driveway shares junction nodes with both Howe and Canada Place;
 * it is not a surveyed lower-level/parkade route. Other service roads stay separate. */
export const FAIRMONT_APRON_DRIVEWAY_ID = "w251586099";
type Polygon = { outer: Point[]; holes: Point[][] };
const points = (flat: readonly number[]): Point[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => [
    flat[2 * i],
    flat[2 * i + 1],
  ]);
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};
const same = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;

/** Source-bounded exterior apron. Boundary runs along the existing road
 * centrelines, the hotel Howe face and the mapped driveway junctions. The
 * original support height is authoritative wherever its mask already exists.
 * New-area heights blend continuously to it, without changing unrelated roads. */
export function createFairmontApronSite(options: {
  roads: readonly Road[];
  buildings: readonly Building[];
  primaryPolygons: readonly Polygon[];
  primaryContains: (x: number, z: number) => boolean;
  primaryHeight: (x: number, z: number) => number;
}) {
  const drive = options.roads.find((r) => r.id === FAIRMONT_APRON_DRIVEWAY_ID),
    howe = options.roads.find((r) => r.id === "w1255990033"),
    turn = options.roads.find((r) => r.id === "w1550614843"),
    canada = options.roads.find((r) => r.id === "w1255990035");
  if (
    !drive ||
    !howe ||
    !turn ||
    !canada ||
    !options.buildings.some((b) => b.id === FAIRMONT_WATERFRONT_ID)
  )
    return undefined;
  const driveway = points(drive.pts),
    howePoints = points(howe.pts),
    turnPoints = points(turn.pts),
    canadaPoints = points(canada.pts),
    north = driveway[0],
    south = driveway.at(-1)!,
    northIndex = canadaPoints.findIndex((p) => same(p, north));
  if (
    northIndex < 0 ||
    !same(howePoints[0], south) ||
    !same(howePoints.at(-1)!, turnPoints[0]) ||
    !same(turnPoints.at(-1)!, canadaPoints[0])
  )
    throw new Error(
      "Fairmont driveway source junctions changed; re-register apron",
    );
  const boundary: Point[] = [
    ...howePoints,
    ...turnPoints.slice(1),
    ...canadaPoints.slice(1, northIndex + 1),
    ...hotel.slice(0, 4),
  ];
  const clipped = clipping.difference(
      [boundary],
      ...buildingsOverlappingPolygon(options.buildings, boundary).map((b) => [
        points(b.pts),
      ]),
    ),
    supportPolygons: Polygon[] = clipped.map((p) => ({
      outer: p[0].slice(0, -1) as Point[],
      holes: p.slice(1).map((h) => h.slice(0, -1) as Point[]),
    })),
    flat = supportPolygons.map((p) => ({
      outer: p.outer.flat(),
      holes: p.holes.map((h) => h.flat()),
    })),
    bounds = boundary.reduce(
      (b, p) => ({
        minX: Math.min(b.minX, p[0]),
        maxX: Math.max(b.maxX, p[0]),
        minZ: Math.min(b.minZ, p[1]),
        maxZ: Math.max(b.maxZ, p[1]),
      }),
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    ),
    contains = (x: number, z: number) =>
      x >= bounds.minX &&
      x <= bounds.maxX &&
      z >= bounds.minZ &&
      z <= bounds.maxZ &&
      flat.some(
        (p) =>
          pointInPoly(x, z, p.outer) &&
          !p.holes.some((h) => pointInPoly(x, z, h)),
      ),
    segments = options.primaryPolygons
      .flatMap((p) => [p.outer, ...p.holes])
      .flatMap((r) =>
        r.map((a, i) => [a, r[(i + 1) % r.length]] as [Point, Point]),
      )
      .filter(
        ([a, b]) =>
          Math.max(a[0], b[0]) >= bounds.minX - 1 &&
          Math.min(a[0], b[0]) <= bounds.maxX + 1 &&
          Math.max(a[1], b[1]) >= bounds.minZ - 1 &&
          Math.min(a[1], b[1]) <= bounds.maxZ + 1,
      );
  // Rendering samples polygon boundaries, where pointInPoly may exclude the
  // point. Keep those samples on the same new surface as the inside floor.
  const covers = (x: number, z: number) =>
    x >= bounds.minX - 1e-4 &&
    x <= bounds.maxX + 1e-4 &&
    z >= bounds.minZ - 1e-4 &&
    z <= bounds.maxZ + 1e-4 &&
    (contains(x, z) ||
      supportPolygons.some((p) =>
        [p.outer, ...p.holes].some((r) =>
          r.some(
            (a, i) =>
              segmentPoint(x, z, ...a, ...r[(i + 1) % r.length]).d < 1e-4,
          ),
        ),
      ));
  // Cache the actual old support-edge heights. Extrapolating the primary
  // Howe/Canada medial blend through this gap creates a false 36% driveway.
  const edgeSamples = segments.flatMap(([a, b]) => {
    const n = Math.max(
      1,
      Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5),
    );
    return Array.from({ length: n }, (_, i) => {
      const p: Point = [
          a[0] + ((b[0] - a[0]) * i) / n,
          a[1] + ((b[1] - a[1]) * i) / n,
        ],
        q: Point = [
          a[0] + ((b[0] - a[0]) * (i + 1)) / n,
          a[1] + ((b[1] - a[1]) * (i + 1)) / n,
        ];
      return {
        a: p,
        b: q,
        ha: options.primaryHeight(...p),
        hb: options.primaryHeight(...q),
      };
    });
  });
  const stations: number[] = [0];
  for (let i = 1; i < driveway.length; i++)
    stations.push(
      stations[i - 1] +
        Math.hypot(
          driveway[i][0] - driveway[i - 1][0],
          driveway[i][1] - driveway[i - 1][1],
        ),
    );
  const length = stations.at(-1)!,
    startHeight = options.primaryHeight(...north),
    endHeight = options.primaryHeight(...south);
  const profileHeight = (x: number, z: number) => {
    const samples = driveway.slice(1).map((b, i) => {
        const a = driveway[i],
          q = segmentPoint(x, z, ...a, ...b);
        return {
          d: q.d,
          s: stations[i] + q.t * (stations[i + 1] - stations[i]),
        };
      }),
      nearest = samples.reduce((a, b) => (a.d <= b.d ? a : b)),
      weights = samples.map(
        (p) => ((nearest.d * nearest.d + 1e-8) / (p.d * p.d + 1e-8)) ** 2,
      ),
      sum = weights.reduce((a, b) => a + b, 0),
      station =
        nearest.d < 1e-6
          ? nearest.s
          : samples.reduce((n, p, i) => n + p.s * weights[i], 0) / sum;
    return startHeight + ((endHeight - startHeight) * station) / length;
  };
  const height = (x: number, z: number) => {
    if (options.primaryContains(x, z)) return options.primaryHeight(x, z);
    let mainDistance = Infinity,
      hotelDistance = Infinity;
    const samples = edgeSamples.map((edge) => {
      const q = segmentPoint(x, z, ...edge.a, ...edge.b);
      mainDistance = Math.min(mainDistance, q.d);
      return { d: q.d, h: edge.ha + (edge.hb - edge.ha) * q.t };
    });
    let sum = 0,
      value = 0;
    for (const p of samples) {
      const weight =
        ((mainDistance * mainDistance + 1e-8) / (p.d * p.d + 1e-8)) ** 2;
      sum += weight;
      value += weight * p.h;
    }
    const edgeHeight = value / sum,
      boundaryBlend = smooth(mainDistance),
      upper =
        mainDistance < 1
          ? options.primaryHeight(x, z) * (1 - boundaryBlend) +
            edgeHeight * boundaryBlend
          : edgeHeight;
    for (let i = 0; i < 3; i++)
      hotelDistance = Math.min(
        hotelDistance,
        segmentPoint(x, z, ...hotel[i], ...hotel[i + 1]).d,
      );
    // The blend preserves the original edge's value and first derivative;
    // inverse-distance station/edge fields avoid medial-line winner jumps.
    // A 2 m corner allowance prevents the two zero-distance boundaries from
    // pinching different target datums into a narrow ridge at the south tip.
    const w = smooth(
      mainDistance /
        (mainDistance + hotelDistance + 2 * Math.exp(-mainDistance / 3)),
    );
    return upper * (1 - w) + profileHeight(x, z) * w;
  };
  return {
    contains,
    covers,
    height,
    profileHeight,
    supportPolygons,
    boundary,
    bounds,
    driveway,
    length,
    startHeight,
    endHeight,
  };
}
export type FairmontApronSite = NonNullable<
  ReturnType<typeof createFairmontApronSite>
>;
