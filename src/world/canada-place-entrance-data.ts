import canopy from "./canada-place-canopy-data.json";
import { geo } from "./data";
const length = Math.hypot(canopy.b[0] - canopy.a[0], canopy.b[1] - canopy.a[1]);
const count = Math.ceil(length / 1.35);
/** Southern HOTEL16 end assembly. Extent/dimensions are photo-guided estimates;
 * the northern return follows an existing primary frame, not a surveyed door. */
export const CANADA_PLACE_ENTRANCE = {
  start: (length * 32) / count,
  end: length,
  front: 2.6,
  back: 2.3,
  base: 7.8,
  sill: 7.95,
  roofBack: 2.6,
  roofFront: 4,
  roofBackY: 10.55,
  roofFrontY: 10.4,
} as const;
const dx = (canopy.b[0] - canopy.a[0]) / length,
  dz = (canopy.b[1] - canopy.a[1]) / length;
const origin = geo(canopy.origin[1], canopy.origin[0]);
export function canadaPlaceEntrancePoint(
  u: number,
  out: number,
): [number, number] {
  return [canopy.a[0] + dx * u - dz * out, canopy.a[1] + dz * u + dx * out];
}
/** Closed ground solid; only the southern lower front recesses from3m to2.6m.
 * The roof projects farther but is intentionally NOT included in this polygon. */
export const CANADA_PLACE_ENTRANCE_GROUND_LOCAL = [
  canadaPlaceEntrancePoint(0, 0),
  canadaPlaceEntrancePoint(length, 0),
  canadaPlaceEntrancePoint(length, 2.6),
  canadaPlaceEntrancePoint(CANADA_PLACE_ENTRANCE.start, 2.6),
  canadaPlaceEntrancePoint(CANADA_PLACE_ENTRANCE.start, 3),
  canadaPlaceEntrancePoint(0, 3),
];
export const CANADA_PLACE_ENTRANCE_GROUND_WORLD =
  CANADA_PLACE_ENTRANCE_GROUND_LOCAL.flatMap(([x, z]) => [
    x + origin[0],
    z + origin[1],
  ]);
