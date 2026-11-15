import source from "./canada-place-deck-data.json";
import { geo } from "./data";

/** Short entrance-side row corroborated by repeated rail-side fixtures in the
 * TourbyTransit and Brenco2023 views. Count/20m spacing are authored estimates;
 * do not extend this row into the constricted sail-stay corridor. */
export const CANADA_PLACE_FIXTURE_EDGE_STATIONS = [45, 65, 85, 105] as const;
export const CANADA_PLACE_FIXTURE_RAIL_INSET = 0.45;
export const CANADA_PLACE_FIXTURE_COLLISION_RADIUS = 0.18;
export const CANADA_PLACE_FIXTURE_HEIGHT = 4.62;
export type CanadaPlacePromenadeFixturePlacement = {
  x: number;
  z: number;
  groundY: number;
  yaw: number;
  banner: boolean;
  globe: "single";
  edgeStation: number;
  world: readonly [number, number];
};
const a = source.pier[1],
  b = source.pier[2];
const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
export const CANADA_PLACE_FIXTURE_EDGE_AXIS = [
  (b[0] - a[0]) / length,
  (b[1] - a[1]) / length,
] as const;
const [ux, uz] = CANADA_PLACE_FIXTURE_EDGE_AXIS;
const origin = geo(source.origin[1], source.origin[0]);
/** Local+X follows the west rail NE; local+Z points inland. GroundY is source
 * local7.8; the existing landmark placement supplies its +.08 finished lift. */
export const CANADA_PLACE_PROMENADE_FIXTURES: readonly CanadaPlacePromenadeFixturePlacement[] =
  CANADA_PLACE_FIXTURE_EDGE_STATIONS.map((edgeStation) => {
    const x = a[0] + ux * edgeStation - uz * CANADA_PLACE_FIXTURE_RAIL_INSET;
    const z = a[1] + uz * edgeStation + ux * CANADA_PLACE_FIXTURE_RAIL_INSET;
    return {
      x,
      z,
      groundY: 7.8,
      yaw: Math.atan2(-uz, ux),
      banner: true,
      globe: "single",
      edgeStation,
      world: [x + origin[0], z + origin[1]],
    };
  });

/** Finite pole volumes only. Banner is above2.15m and extends seaward,
 * away from the route. The180mm base envelope protects the lower stem;
 * it does not enclose the offset upper globe or banner. Parent gates these
 * on loaded capability. */
export const CANADA_PLACE_PROMENADE_FIXTURE_COLLIDERS =
  CANADA_PLACE_PROMENADE_FIXTURES.map((p) => ({
    x: p.world[0],
    z: p.world[1],
    radius: CANADA_PLACE_FIXTURE_COLLISION_RADIUS,
    minY: p.groundY + 0.08,
    maxY: p.groundY + 0.08 + CANADA_PLACE_FIXTURE_HEIGHT,
  }));
export function canadaPlacePromenadeFixtureAt(
  x: number,
  z: number,
  radius: number,
  referenceY = 7.88,
  bodyHeight = 0,
) {
  if (
    ![x, z, radius, referenceY, bodyHeight].every(Number.isFinite) ||
    radius < 0 ||
    bodyHeight < 0
  )
    return false;
  return CANADA_PLACE_PROMENADE_FIXTURE_COLLIDERS.some(
    (p) =>
      referenceY <= p.maxY &&
      referenceY + bodyHeight >= p.minY - 0.001 &&
      Math.hypot(x - p.x, z - p.z) <= radius + p.radius,
  );
}
