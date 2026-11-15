import { pointInPoly, type Point } from "./data";
import { facadeFrame } from "./architectural-mesh";
import source from "./pwc-place-parts.json";

export const PWC_PLACE_ID = "w138256216";
export const PWC_PLACE_ORIGIN: Point = [489, -401];
export const PWC_PLACE_RING = source.baseRing as Point[];
export const PWC_PLACE_TOWER_RING = source.towerRing as Point[];
export const PWC_PLACE_SPINE_RING = source.spineRing as Point[];
export const PWC_PLACE_CROWN_RING = source.crownRing as Point[];
export const PWC_PLACE_BODY_ROOF = source.bodyRoof as Point[][][];
export const PWC_PLACE_SPINE_ROOF = source.spineRoof as Point[][][];
export const PWC_PLACE_LOBBY_TOP = 8.2;
/** CVU overall height; City absolute roof differences retain the stepped profile. */
export const PWC_PLACE_HEIGHT = 83;
export const PWC_PLACE_BODY_TOP = 74.42;
export const PWC_PLACE_SPINE_TOP = 78.32;

/** Source Howe frontage; leaf layout and dimensions are bounded photo estimates. */
export const PWC_PLACE_ENTRANCE = {
  a: PWC_PLACE_RING[0],
  b: PWC_PLACE_RING[1],
  left: 6,
  right: 12,
  floor: 0.18,
  top: 6.8,
  depth: 3.4,
};
export const pwcPlaceEntranceFrame = () =>
  facadeFrame(PWC_PLACE_ENTRANCE.a, PWC_PLACE_ENTRANCE.b);

const verticalZone = source.facadeZones.find((p) => p.osmId === 361497586)!;
export function pwcPlaceFacadeStyle(x: number, z: number) {
  return pointInPoly(x, z, verticalZone.ring.flat())
    ? "vertical"
    : "horizontal";
}
export function pwcPlaceHeight(x: number, z: number) {
  if (pointInPoly(x, z, PWC_PLACE_CROWN_RING.flat())) return PWC_PLACE_HEIGHT;
  if (pointInPoly(x, z, PWC_PLACE_SPINE_RING.flat()))
    return PWC_PLACE_SPINE_TOP;
  if (pointInPoly(x, z, PWC_PLACE_TOWER_RING.flat())) return PWC_PLACE_BODY_TOP;
  return pointInPoly(x, z, PWC_PLACE_RING.flat()) ? PWC_PLACE_LOBBY_TOP : 0;
}
/** Two nominal lobby/mezzanine levels and eighteen main office divisions. */
export const pwcPlaceLevel = (level: number) =>
  level <= 2
    ? (level * PWC_PLACE_LOBBY_TOP) / 2
    : PWC_PLACE_LOBBY_TOP +
      ((level - 2) * (PWC_PLACE_BODY_TOP - PWC_PLACE_LOBBY_TOP)) / 18;
