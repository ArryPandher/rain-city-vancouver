import data from "./canada-place-concourse-data.json";
/** Photo-registered longitudinal zones; exact metre boundaries are estimates. */
export const canadaPlaceSolidBayAt = (s: number) =>
  data.solidBays.find(([a, b]) => s > a + 1e-7 && s < b - 1e-7);
export const canadaPlaceUpperFasciaAt = (s: number) =>
  data.upperFasciaRanges.some(([a, b]) => s >= a && s <= b);
export const canadaPlaceRoofOutwardAt = (s: number) =>
  canadaPlaceSolidBayAt(s)
    ? data.solidBayOutward
    : data.profile[canadaPlaceUpperFasciaAt(s) ? 17 : 25][0];
export const CANADA_PLACE_DOOR_INTERVALS = [
  [0, data.solidBays[0][0]],
  [data.solidBays[0][1], data.solidBays[1][0]],
  [data.solidBays[1][1], data.length],
];
