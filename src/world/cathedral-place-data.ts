import source from "./cathedral-place-source.json";
import type { Point } from "./data";

export const CATHEDRAL_PLACE_ID = source.buildingId;
export const CATHEDRAL_PLACE_RING = source.ring as Point[];
export const CATHEDRAL_PLACE_TIERS = source.tiers as {
  top: number;
  polygons: Point[][][];
}[];
/** Heights above the existing live grade. City MAXHT_M116.38 and mapped116.4
 * agree; City per-part top/base fields do not. Do not substitute a geodetic
 * roof directly into the game's flattened Gallery district. */
export const CATHEDRAL_PLACE = {
  apex: 116.4,
  roofPeak: 112.3,
  crownPanelSpring: 100.2,
  crownSolidFraction: 0.69,
  crownPanelThickness: 0.045,
  crownLatticePitch: 0.65,
  crownLatticeRows: 3,
  crownLatticeBar: 0.075,
  crownSpring: 99,
  mainBodyTop: 90.87,
  groundStorey: 5.6,
  upperRows: 22,
  stoneDepth: 0.16,
  paneDepth: 0.56,
  cornerPaneDepth: 0.08,
  backingDepth: 0.98,
  cornerWidth: 2.45,
  bayWidth: 3.15,
  frameWidth: 0.06,
} as const;
export const cathedralPlaceLevel = (i: number) =>
  i === 0
    ? 0
    : CATHEDRAL_PLACE.groundStorey +
      ((i - 1) / CATHEDRAL_PLACE.upperRows) *
        (CATHEDRAL_PLACE.mainBodyTop - CATHEDRAL_PLACE.groundStorey);
