import polygonClipping from "polygon-clipping";
import { createPwcApronSite } from "./pwc-apron-site";
import {
  createFairmontApronSite,
  FAIRMONT_APRON_DRIVEWAY_ID,
} from "./fairmont-apron-site";
import {
  pointInPoly,
  roadWidth,
  type Building,
  type Point,
  type Road,
} from "./data";

/** Authored local integration estimates, not surveyed/geodetic elevations.
 * See docs/sources/canada-place-grade-plan.md. */
export const CANADA_PLACE_DECK_HEIGHT = 7.88;
export const CANADA_PLACE_WALK_OFFSET = 0.15;
export const CANADA_PLACE_BASE_HEIGHT =
  CANADA_PLACE_DECK_HEIGHT - CANADA_PLACE_WALK_OFFSET;
export const CANADA_PLACE_EASE_LENGTH = 15;
export const CANADA_PLACE_HOWE_IDS = [
  "w232195213",
  "w1255990033",
  "w1550614843",
] as const;
export const CANADA_PLACE_WATERFRONT_IDS = [
  "w1255990035",
  "w706831744",
] as const;
export const CANADA_PLACE_ROAD_IDS = new Set<string>([
  ...CANADA_PLACE_HOWE_IDS,
  ...CANADA_PLACE_WATERFRONT_IDS,
]);
/** Mapped service/driveway stubs with no surveyed layer/elevation. Preserve the
 * old render datum consistently; do not invent abrupt ramps across the site. */
export const CANADA_PLACE_SERVICE_IDS = new Set([
  "w143682532",
  "w143682533",
  "w251863020",
]);
export type CanadaPlaceSupportPolygon = { outer: Point[]; holes: Point[][] };
export type CanadaPlaceSiteOptions = {
  roads: readonly Road[];
  buildings: readonly Building[];
  /** Existing VCC/Jack/baseline ground, without calling the new Canada site.
   * Required for the western link: it matches the full end cross-section. */
  westernHeight?: (x: number, z: number) => number;
  /** Explicit source-guided entry connectors; not a blanket plaza rectangle. */
  connectors?: Point[][];
  /** Existing modeled pier: do not render a second support surface over it. */
  existingDeck?: Point[];
};

/** Integrate a constant grade with linear 15m slope easements at both ends. */
export function canadaPlaceHoweProfile(station: number, length: number) {
  if (length <= 0) return 0;
  const s = Math.max(0, Math.min(length, station));
  const ease = Math.min(CANADA_PLACE_EASE_LENGTH, length / 2);
  const grade = CANADA_PLACE_BASE_HEIGHT / (length - ease);
  if (s < ease) return (grade * s * s) / (2 * ease);
  if (s > length - ease)
    return CANADA_PLACE_BASE_HEIGHT - (grade * (length - s) ** 2) / (2 * ease);
  return grade * (s - ease / 2);
}
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};
const points = (flat: readonly number[]): Point[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => [
    flat[2 * i],
    flat[2 * i + 1],
  ]);
const lengthOf = (p: Point[]) =>
  p
    .slice(1)
    .reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
function join(roads: readonly Road[], ids: readonly string[]) {
  const path: Point[] = [];
  for (const id of ids) {
    const road = roads.find((r) => r.id === id);
    if (!road) throw new Error(`Canada Place site missing mapped road ${id}`);
    const p = points(road.pts);
    if (
      path.length &&
      Math.hypot(path.at(-1)![0] - p[0][0], path.at(-1)![1] - p[0][1]) > 0.05
    )
      throw new Error(`Canada Place road junction disconnected at ${id}`);
    path.push(...(path.length ? p.slice(1) : p));
  }
  return path;
}
function nearest(path: Point[], x: number, z: number, blend = false) {
  let station = 0,
    best = { distance: Infinity, station: 0 };
  const samples: { distance: number; station: number }[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (!length) continue;
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length)),
    );
    const distance = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    const sample = { distance, station: station + t * length };
    samples.push(sample);
    if (distance < best.distance) best = sample;
    station += length;
  }
  if (!blend || best.distance < 1e-7) return best;
  // A hard segment winner also jumps at the medial lines of adjacent bend
  // segments. Inverse-distance station interpolation is continuous, converges
  // to the exact station on the centreline, and agrees at shared vertices.
  let total = 0,
    sum = 0;
  for (const sample of samples) {
    const weight =
      ((best.distance ** 2 + 1e-8) / (sample.distance ** 2 + 1e-8)) ** 2;
    total += weight;
    sum += weight * sample.station;
  }
  return { distance: best.distance, station: total ? sum / total : 0 };
}
function bufferRoad(road: Road): Point[][][] {
  // Includes mapped roadway plus a 3.5m public-sidewalk/support allowance.
  // Building subtraction below bounds this allowance at actual wall footprints.
  const radius = roadWidth(road) / 2 + 3.5,
    p = points(road.pts),
    polygons: Point[][][] = [];
  for (const a of p)
    polygons.push([
      Array.from(
        { length: 24 },
        (_, i): Point => [
          a[0] + radius * Math.cos((i * Math.PI) / 12),
          a[1] + radius * Math.sin((i * Math.PI) / 12),
        ],
      ),
    ]);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!length) continue;
    const nx = ((b[1] - a[1]) / length) * radius,
      nz = (-(b[0] - a[0]) / length) * radius;
    polygons.push([
      [
        [a[0] + nx, a[1] + nz],
        [b[0] + nx, b[1] + nz],
        [b[0] - nx, b[1] - nz],
        [a[0] - nx, a[1] - nz],
      ],
    ]);
  }
  return polygons;
}
export function createCanadaPlaceSite(options: CanadaPlaceSiteOptions) {
  const { roads, buildings, westernHeight } = options;
  const howePath = join(roads, CANADA_PLACE_HOWE_IDS),
    howeLength = lengthOf(howePath);
  // Without the existing-height callback there is no safe western datum tie.
  const waterfrontPath = westernHeight
    ? join(roads, CANADA_PLACE_WATERFRONT_IDS)
    : [];
  const waterfrontLength = lengthOf(waterfrontPath);
  const roadIds = new Set<string>([
    ...CANADA_PLACE_HOWE_IDS,
    ...(westernHeight ? CANADA_PLACE_WATERFRONT_IDS : []),
  ]);
  const parts = roads
    .filter((r) => r.id && roadIds.has(r.id))
    .flatMap(bufferRoad);
  const union = polygonClipping.union(parts[0], ...parts.slice(1));
  let clipped = buildings.length
    ? polygonClipping.difference(
        union,
        ...buildings.map((b) => [points(b.pts)]),
      )
    : union;
  for (const connector of options.connectors ?? []) {
    // The coarse OSM whole-pier parent protrudes beyond the modeled edge.
    // Only explicit entry support may cross it; actual hotel/hall solids stay.
    const cuts = buildings
      .filter((b) => b.id !== "w223635729")
      .map((b) => [points(b.pts)]);
    if (options.existingDeck) cuts.push([options.existingDeck]);
    const addition = cuts.length
      ? polygonClipping.difference([connector], ...cuts)
      : [[connector]];
    clipped = polygonClipping.union(clipped, addition);
  }
  const primaryPolygons: CanadaPlaceSupportPolygon[] = clipped.map((p) => ({
    outer: p[0].slice(0, -1) as Point[],
    holes: p.slice(1).map((h) => h.slice(0, -1) as Point[]),
  }));
  const flat = primaryPolygons.map((p) => ({
    outer: p.outer.flat(),
    holes: p.holes.map((h) => h.flat()),
  }));
  const primaryContains = (x: number, z: number) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    flat.some(
      (p) =>
        pointInPoly(x, z, p.outer) &&
        !p.holes.some((h) => pointInPoly(x, z, h)),
    );
  const westEnd = waterfrontPath.at(-1);
  const westDatum =
    westEnd && westernHeight
      ? westernHeight(...westEnd)
      : CANADA_PLACE_BASE_HEIGHT;
  /** Unmasked sampler for rendering boundary vertices (pointInPoly excludes some edges). */
  const primaryHeight = (x: number, z: number) => {
    const h = nearest(howePath, x, z, true);
    const w = waterfrontPath.length ? nearest(waterfrontPath, x, z) : undefined;
    const howeHeight = canadaPlaceHoweProfile(h.station, howeLength);
    if (!w) return howeHeight;
    const s = w.station;
    // Level arrival landing; eased waterfront descent, then exact existing
    // cross-section blend over the final 15m. End cap equals old terrain.
    const t = smooth((s - 100) / Math.max(1, waterfrontLength - 100));
    const authored =
      CANADA_PLACE_BASE_HEIGHT + (westDatum - CANADA_PLACE_BASE_HEIGHT) * t;
    const tie = smooth((s - (waterfrontLength - 15)) / 15);
    const waterfrontHeight = authored * (1 - tie) + westernHeight!(x, z) * tie;
    // Nearest-route selection alone jumps across the medial line inside the
    // tight Howe bend. Blend across a 4m band, retaining exact samples away
    // from that line and the identical shared-node/landing datum.
    const band = smooth((h.distance - w.distance + 2) / 4);
    const corner = band + (1 - band) * (1 - smooth(w.distance / 0.5));
    return howeHeight * (1 - corner) + waterfrontHeight * corner;
  };
  const fairmontApron = createFairmontApronSite({
    roads,
    buildings,
    primaryPolygons,
    primaryContains,
    primaryHeight,
  });
  const pwcApron = createPwcApronSite({
    roads,
    buildings,
    primaryPolygons,
    primaryContains,
    primaryHeight,
  });
  if (pwcApron)
    clipped = polygonClipping.union(
      clipped,
      ...pwcApron.supportPolygons.map((p) => [p.outer, ...p.holes]),
    );
  if (fairmontApron) {
    clipped = polygonClipping.union(
      clipped,
      ...fairmontApron.supportPolygons.map((p) => [p.outer, ...p.holes]),
    );
    roadIds.add(FAIRMONT_APRON_DRIVEWAY_ID);
  }
  const supportPolygons: CanadaPlaceSupportPolygon[] = clipped.map((p) => ({
    outer: p[0].slice(0, -1) as Point[],
    holes: p.slice(1).map((h) => h.slice(0, -1) as Point[]),
  }));
  const contains = (x: number, z: number) =>
    primaryContains(x, z) ||
    !!fairmontApron?.contains(x, z) ||
    !!pwcApron?.contains(x, z);
  const supportHeight = (x: number, z: number) =>
    fairmontApron?.covers(x, z)
      ? fairmontApron.height(x, z)
      : pwcApron?.covers(x, z)
        ? pwcApron.height(x, z)
        : primaryHeight(x, z);
  const baselineHeight = (x: number, z: number) =>
    contains(x, z) ? supportHeight(x, z) : undefined;
  const bounds = supportPolygons
    .flatMap((p) => p.outer)
    .reduce(
      (b, p) => ({
        minX: Math.min(b.minX, p[0]),
        maxX: Math.max(b.maxX, p[0]),
        minZ: Math.min(b.minZ, p[1]),
        maxZ: Math.max(b.maxZ, p[1]),
      }),
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    );
  // Conservative segment-box overlap also catches long roads crossing the site
  // with neither endpoint inside, for ribbon subdivision selection.
  const intersects = (p: readonly number[]) => {
    for (let i = 0; i + 3 < p.length; i += 2)
      if (
        Math.max(p[i], p[i + 2]) >= bounds.minX &&
        Math.min(p[i], p[i + 2]) <= bounds.maxX &&
        Math.max(p[i + 1], p[i + 3]) >= bounds.minZ &&
        Math.min(p[i + 1], p[i + 3]) <= bounds.maxZ
      )
        return true;
    return false;
  };
  return {
    baselineHeight,
    supportHeight,
    fairmontApron,
    pwcApron,
    contains,
    intersects,
    supportPolygons,
    bounds,
    roadIds,
    howePath,
    waterfrontPath,
    howeLength,
    waterfrontLength,
    westernTieEnabled: !!westernHeight,
  };
}
export type CanadaPlaceSite = ReturnType<typeof createCanadaPlaceSite>;
