import type { Point } from "./data";
import { howeStationPavilionLayout } from "./howe-station-pavilion";

/** 2022 City orthophoto roof fit; ±0.5–1m horizontal registration.
 * Vertical dimensions are source-guided/photo-fit estimates, not a survey. */
export const HOWE_STATION_SPEC = {
  origin: [481.02957, -430.88932] as Point,
  axis: [-0.66573, 0.74619] as Point,
  length: 11.371,
  width: 4.653,
  stairStart: 2.621,
  landingHeight: 8.08,
};
export const HOWE_STATION = howeStationPavilionLayout(HOWE_STATION_SPEC);
/** Inferred closure between observed paving and mapped walls; not a flat terrace. */
export const HOWE_FORECOURT: Point[] = [
  [466.66812, -421.43723],
  [478.35201, -432.65403],
  [506.00389, -461.95297],
  [516.0486, -456.63],
  [497.5486, -437.13],
  [494.0486, -429.63],
  [495.5486, -427.63],
  [489.5486, -421.13],
  [484.5486, -422.13],
  [479.0486, -411.13],
];
