import { createExteriorLobbyGlass } from "./exterior-lobby-glass";
import { facadeFrame } from "./architectural-mesh";
import { GRANVILLE_SQUARE_TOWER_RING as ring } from "./granville-square-tower-data";

/** A coated-sheet approximation over the tower's existing closed recesses.
 * Effective IOR describes coating reflectance, not measured bulk glass. Keep
 * its former F0/roughness; remove the opaque diffuse paint that hid the lining.
 * No screen refraction, extra light, per-window material or emissive interior. */
export function createGranvilleSquareOfficeGlass() {
  const glass = createExteriorLobbyGlass(
    "Granville Square recessed coated office glass",
    0.78,
  );
  glass.ior = 1.8;
  glass.roughness = 0.13;
  glass.envMapIntensity = 0.8;
  return glass;
}

const east = facadeFrame(ring[0], ring[1]).outward,
  south = facadeFrame(ring[3], ring[0]).outward,
  // Intersection of the two exterior offset planes, not an arbitrary offset
  // from the centroid. Each visible elevation has exactly 6 m of clearance.
  distance = 6 / (1 + east[0] * south[0] + east[1] * south[1]);

/** One existing 128px capture, aligned to the ordinary southern street view.
 * Height and capture budget stay unchanged. At the previous western position,
 * rays reflected by these facades could hit the tower itself. */
export const GRANVILLE_SQUARE_OFFICE_PROBE: [number, number, number] = [
  ring[0][0] + distance * (east[0] + south[0]),
  52,
  ring[0][1] + distance * (east[1] + south[1]),
];
