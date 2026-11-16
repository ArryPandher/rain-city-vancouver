import type { Point } from "./data";
import source from "./granville-square-tower-parts.json";

export const GRANVILLE_SQUARE_TOWER_ID = source.buildingId;
/** Exact retained game outline; no procedural tower shrink or podium overhang. */
export const GRANVILLE_SQUARE_TOWER_RING = source.ring as Point[];
export const GRANVILLE_SQUARE_TOWER_PARTS = source.parts as {
  id: number;
  absoluteTop: number;
  sourceRing: Point[];
  ring: Point[];
}[];
/** City elevations use the existing shared H→world conversion. The live public
 * grade is below the inferred historical plaza, so no raised plaza is invented.
 * Main roof125.46 is authoritative to this registration; base heights are fits. */
export const GRANVILLE_SQUARE_TOWER = {
  datumOffset: -7.52,
  roof: 132.98 - 7.52,
  mechanical: 141.22 - 7.52,
  cab: 145.84 - 7.52,
  bodyRows: 28,
  bays: [12, 8, 12, 8] as readonly number[],
  bodyBaseAboveGround: 10.8,
  baseSplitAboveGround: 4.6,
  /** Owner aerial, same-face measured vertical ratios. These are opening
   * boundaries within the retained base envelope, not floor elevations.
   * The mezzanine is shorter than the ground glazing; the existing split
   * falls inside the substantial opaque belt between them. */
  baseOpeningFractions: [
    [0.06, 0.29],
    [0.485, 0.685],
  ] as const,
  bodyTopBelowRoof: 2.2,
  shadowSlitHeight: 0.65,
  openingSide: 0.4,
  openingBottom: 0.64,
  openingTop: 0.26,
  splay: 0.2,
  recess: 0.78,
  backing: 1.16,
  mullion: 0.055,
  /** Fifteenth opening from the top is louvered, i.e. row13 from bottom. */
  louverRow: 13,
  baseRecess: 1.05,
} as const;
export const granvilleSquareTowerLevel = (row: number, baseY: number) => {
  const bottom = baseY + GRANVILLE_SQUARE_TOWER.bodyBaseAboveGround;
  return (
    bottom +
    (row / GRANVILLE_SQUARE_TOWER.bodyRows) *
      (GRANVILLE_SQUARE_TOWER.roof -
        GRANVILLE_SQUARE_TOWER.bodyTopBelowRoof -
        bottom)
  );
};
