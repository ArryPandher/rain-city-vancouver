import {
  CANADA_PLACE_ENTRANCE,
  CANADA_PLACE_ENTRANCE_GROUND_WORLD,
  canadaPlaceEntrancePoint,
} from "./canada-place-entrance-data";
import type { CanadaPlaceCapabilities } from "./canada-place-capabilities";
import { geo, pointInPoly, segmentPoint } from "./data";
import { CANADA_PLACE_GROUND_STAYS } from "./canada-place-ground-stays-data";
import source from "./canada-place-deck-data.json";
import canopy from "./canada-place-canopy-data.json";
import concourse from "./canada-place-concourse-data.json";

/** Finished source-model surface, not a surveyed geodetic elevation. */
export const CANADA_PLACE_DECK_Y = 7.88;
export const CANADA_PLACE_PIER_ID = "w223635729";
/** Mapped Pan Pacific hotel envelope; never a general public-deck exemption. */
export const CANADA_PLACE_HOTEL_ID = "r16532084";
/** Only these mapped site envelopes can be superseded on validated public deck.
 * Callers must ALSO require supportedDeck and an actor at deck/approach level. */
export const CANADA_PLACE_DECK_COLLIDER_IDS = new Set(["w223635729"]);
export const CANADA_PLACE_ORIGIN = geo(source.origin[1], source.origin[0]);
export function canadaPlaceWorld(x: number, z: number): [number, number] {
  return [x + CANADA_PLACE_ORIGIN[0], z + CANADA_PLACE_ORIGIN[1]];
}
const worldRing = (ring: number[][]) =>
  ring.flatMap(([x, z]) => canadaPlaceWorld(x, z));
export const CANADA_PLACE_PIER = worldRing(source.pier);
export const CANADA_PLACE_HOTEL = worldRing(source.hotel);
export const CANADA_PLACE_ENTRANCE_CANOPY = worldRing(canopy.footprint);
export const CANADA_PLACE_SAILS = source.sails.map(worldRing);
export const CANADA_PLACE_TERMINAL = worldRing(source.terminal);
// Same 48-sided mapped approximation as the source near GLB, plus clearances below.
export const CANADA_PLACE_HALL = worldRing(
  Array.from({ length: 48 }, (_, i) => {
    const a = (i * Math.PI) / 24;
    return [72 + 25 * Math.cos(a), -31 + 18 * Math.sin(a)];
  }),
);
export const CANADA_PLACE_SOLID_MASSES = [
  CANADA_PLACE_HOTEL,
  CANADA_PLACE_ENTRANCE_CANOPY,
  concourse.groundWorldFootprint,
  ...CANADA_PLACE_SAILS,
  CANADA_PLACE_TERMINAL,
  CANADA_PLACE_HALL,
];

// A bounded interpretation of the official front plaza and western Canadian Trail.
// These are eligibility masks, always intersected with actual PIER and solid exclusions.
// They do not designate every exposed roof/deck as public.
const front = worldRing([
  [-248, 75],
  [-225, 62],
  [-201, 62],
  [-183, 92],
  [-199, 98],
  [-241, 80],
]);
const a = source.pier[1],
  b = source.pier[2],
  len = Math.hypot(b[0] - a[0], b[1] - a[1]);
const ix = -(b[1] - a[1]) / len,
  iz = (b[0] - a[0]) / len;
const trail = worldRing([
  a,
  b,
  [b[0] + ix * 24, b[1] + iz * 24],
  [a[0] + ix * 24, a[1] + iz * 24],
]);
/** Visible east/front apron: bounded by the source HOTEL southeast return and
 * PIER's short front edges. Every supported point remains outside HOTEL and
 * inside the original PIER top; this does not open the recessed hotel arcade. */
export const CANADA_PLACE_EAST_FRONT_APRON = worldRing([
  ...source.hotel.slice(32, 39),
  ...source.pier.slice(26, 30),
]);
export const CANADA_PLACE_PUBLIC_MASKS = [
  front,
  trail,
  CANADA_PLACE_EAST_FRONT_APRON,
];
const apronRailA = source.pier[25],
  apronRailB = source.pier[26];
const apronRailDX = apronRailB[0] - apronRailA[0],
  apronRailDZ = apronRailB[1] - apronRailA[1];
const apronRailLength = Math.hypot(apronRailDX, apronRailDZ);
/** Source geometry.js creates this rail only on long PIER edge25→26. The
 * neighboring short front edges26→29 remain open; no invented entry barrier. */
export const CANADA_PLACE_EAST_FRONT_RAIL = {
  a: canadaPlaceWorld(
    apronRailA[0] + (apronRailDZ / apronRailLength) * 0.05,
    apronRailA[1] - (apronRailDX / apronRailLength) * 0.05,
  ),
  b: canadaPlaceWorld(
    apronRailB[0] + (apronRailDZ / apronRailLength) * 0.05,
    apronRailB[1] - (apronRailDX / apronRailLength) * 0.05,
  ),
  // Actual baked steel extrema, expanded by 6mm for contact tolerance.
  halfWidth: 0.07922757691816752 + 0.006,
  bottom: 7.7764430809021 - 0.006,
  top: 8.955096321105957 + 0.006,
} as const;

/** Collision for the existing visible east rail, gated by loaded source in the
 * caller. Height-aware for normal 1.8m actors and camera spheres. */
export function canadaPlaceEastFrontRailAt(
  x: number,
  z: number,
  r = 0.36,
  referenceY = Infinity,
  camera = false,
): boolean {
  if (!valid(x, z, r) || Number.isNaN(referenceY)) return false;
  const rail = CANADA_PLACE_EAST_FRONT_RAIL;
  if (Number.isFinite(referenceY)) {
    const low = referenceY - (camera ? r : 0),
      high = referenceY + (camera ? r : 1.8);
    if (high < rail.bottom || low > rail.top) return false;
  }
  return segmentPoint(x, z, ...rail.a, ...rail.b).d <= r + rail.halfWidth;
}
/** Estimated level street-to-plaza connector; OUTSIDE the source pier it needs
 * approach-owned rendered support. Never use this ring as a water exemption alone. */
export const CANADA_PLACE_ENTRY_CONNECTOR = [
  425, -522, 435, -522, 435, -544, 425, -544,
];
export const CANADA_PLACE_DECK_ROUTE = [
  [-214.7, 81.3],
  [-220, 73],
  [-209, 62],
  [-190, 47],
  [-155, 28],
  [-115, 7],
  // A continuous waterside line outside the exact ground-stay bases.
  // Vehicle centre radius is1.16m; 1.45m base-edge offset retains physical steering clearance.
  ...CANADA_PLACE_GROUND_STAYS.map((a) => {
    const halfDepth = Math.max(...a.perimeter.map((p) => p[1]));
    const offset = halfDepth + 1.45 + (a.bay === 0 || a.bay === 4 ? 0.05 : 0);
    return [
      a.center[0] + a.normal[0] * offset,
      a.center[1] + a.normal[1] * offset,
    ];
  }),
  [15, -63],
  [42, -75],
].map(([x, z]) => canadaPlaceWorld(x, z));

function edgeDistance(x: number, z: number, p: number[]) {
  let distance = Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    distance = Math.min(
      distance,
      segmentPoint(x, z, p[i], p[i + 1], p[j], p[j + 1]).d,
    );
  }
  return distance;
}
const valid = (x: number, z: number, r: number) =>
  Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(r) && r >= 0;
function containsCircle(x: number, z: number, p: number[], r: number) {
  return pointInPoly(x, z, p) && edgeDistance(x, z, p) >= r;
}
export function inCanadaPlacePier(x: number, z: number, r = 0) {
  return valid(x, z, r) && containsCircle(x, z, CANADA_PLACE_PIER, r);
}
const ENTRANCE_ROOF_WORLD = [
  [CANADA_PLACE_ENTRANCE.start, CANADA_PLACE_ENTRANCE.roofBack],
  [CANADA_PLACE_ENTRANCE.end, CANADA_PLACE_ENTRANCE.roofBack],
  [CANADA_PLACE_ENTRANCE.end, CANADA_PLACE_ENTRANCE.roofFront],
  [CANADA_PLACE_ENTRANCE.start, CANADA_PLACE_ENTRANCE.roofFront],
].flatMap(([u, o]) => {
  const [lx, lz] = canadaPlaceEntrancePoint(u, o);
  return [lx + CANADA_PLACE_ORIGIN[0], lz + CANADA_PLACE_ORIGIN[1]];
});

/** Match the southern closed frontage's visible recess, not its overhead roof.
 * Original canopy edges retain their existing trim margin; only newly authored
 * lower cheeks/front use the measured60mm frame allowance. */
function canopySolidAt(x: number, z: number, r: number, y: number) {
  const e = CANADA_PLACE_ENTRANCE;
  // Finite overhead envelope includes the shallow sloped glass/frame thickness.
  // A normal player/car at7.88 stays below it; a high camera cannot pass through.
  if (
    y + r >= Math.min(e.roofFrontY, e.roofBackY) - 0.06 + 0.08 &&
    y - r <= Math.max(e.roofFrontY, e.roofBackY) + 0.06 + 0.08
  ) {
    if (
      pointInPoly(x, z, ENTRANCE_ROOF_WORLD) ||
      edgeDistance(x, z, ENTRANCE_ROOF_WORLD) <= r + 0.06
    )
      return true;
  }

  if (!Number.isFinite(y) || y >= canopy.spring + 0.08)
    return (
      pointInPoly(x, z, CANADA_PLACE_ENTRANCE_CANOPY) ||
      edgeDistance(x, z, CANADA_PLACE_ENTRANCE_CANOPY) <= r + 0.55
    );
  const p = CANADA_PLACE_ENTRANCE_GROUND_WORLD;
  if (pointInPoly(x, z, p)) return true;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length,
      edge = i / 2;
    // Do not carry the old front edge's rounded550mm endpoint inflation into
    // the new narrow recess beyond its north return.
    const beyondOldFront =
      edge === 4 &&
      (x - p[i]) * (p[j] - p[i]) + (z - p[i + 1]) * (p[j + 1] - p[i + 1]) < 0;
    const margin = (edge >= 1 && edge <= 3) || beyondOldFront ? 0.06 : 0.55;
    if (segmentPoint(x, z, p[i], p[i + 1], p[j], p[j + 1]).d <= r + margin)
      return true;
  }
  return false;
}
/** Closed hotel/exhibition/end-hall volume at and above public deck. The 0.55 m
 * margin includes source projecting facade trim; it is deliberately conservative. */
export function solidAt(
  x: number,
  z: number,
  r = 0,
  referenceY = CANADA_PLACE_DECK_Y,
  capabilities?: CanadaPlaceCapabilities,
) {
  if (!valid(x, z, r)) return true;
  if (
    (!capabilities || capabilities.entranceCanopy) &&
    canopySolidAt(x, z, r, referenceY)
  )
    return true;
  const enabledMasses = CANADA_PLACE_SOLID_MASSES.filter(
    (p) =>
      (!capabilities ||
        capabilities.concourse ||
        p !== concourse.groundWorldFootprint) &&
      p !== CANADA_PLACE_ENTRANCE_CANOPY,
  );
  const masses =
    referenceY >= concourse.groundGlassHeadY + 0.08
      ? enabledMasses.map((p) =>
          p === concourse.groundWorldFootprint ? concourse.worldFootprint : p,
        )
      : enabledMasses;
  return masses.some(
    (p) => pointInPoly(x, z, p) || edgeDistance(x, z, p) <= r + 0.55,
  );
}
/** Exact visible plinth footprint, independently height-gated. Do not add the
 * larger facade trim allowance or turn the2.45m blocks into infinite walls. */
export function canadaPlaceGroundStayAt(
  x: number,
  z: number,
  r = 0,
  referenceY = Infinity,
) {
  if (!valid(x, z, r) || Number.isNaN(referenceY)) return true;
  return CANADA_PLACE_GROUND_STAYS.some(
    (a) =>
      (!Number.isFinite(referenceY) ||
        (referenceY >= a.worldMinY - 0.02 && referenceY < a.worldMaxY)) &&
      (pointInPoly(x, z, a.worldFootprint) ||
        edgeDistance(x, z, a.worldFootprint) < r),
  );
}
/** Backed entrance opening only; outside PIER the approach owns its support. */
export function inCanadaPlaceEntryConnector(x: number, z: number, r = 0) {
  return (
    valid(x, z, r) && containsCircle(x, z, CANADA_PLACE_ENTRY_CONNECTOR, r)
  );
}
/** Exposed public source surface only. Caller height-gates entry: this says
 * nothing about traversing the lower solid pier, private terraces or sea.
 * Only at the backed entry connector may the actor circle straddle the pier rim. */
export function supportedDeck(
  x: number,
  z: number,
  r = 0,
  capabilities?: CanadaPlaceCapabilities,
) {
  if (
    (capabilities && !capabilities.loaded) ||
    !valid(x, z, r) ||
    !pointInPoly(x, z, CANADA_PLACE_PIER) ||
    solidAt(x, z, r, CANADA_PLACE_DECK_Y, capabilities)
  )
    return false;
  // The observed front arrival crosses the short, unrailed PIER edge26/27.
  // Its real surface reaches the rim; the older .65m trail inset wrongly drops
  // feet below that visible floor. Keep the complete actor circle on source
  // support with 12mm for decoded quantization, plus all solid exclusions above.
  if (
    containsCircle(x, z, CANADA_PLACE_EAST_FRONT_APRON, r) &&
    containsCircle(x, z, CANADA_PLACE_PIER, r + 0.012)
  )
    return true;
  const entryOpening = inCanadaPlaceEntryConnector(x, z, r);
  if (!entryOpening && !containsCircle(x, z, CANADA_PLACE_PIER, r + 0.65))
    return false;
  return (
    entryOpening ||
    CANADA_PLACE_PUBLIC_MASKS.some((p) => containsCircle(x, z, p, r))
  );
}
