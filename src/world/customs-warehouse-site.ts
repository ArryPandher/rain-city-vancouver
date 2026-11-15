import type { Point } from "./data";

export const CUSTOMS_WAREHOUSE_ID = "w1363485360";
/** Registered live-map footprint; source roof edges are fitted inside this ring. */
export const CUSTOMS_WAREHOUSE_RING: Point[] = [
  [418.54859855609675, -360.1300000001447],
  [441.04859855609675, -382.6300000001447],
  [468.04859855609675, -356.1300000001447],
  [445.54859855609675, -334.1300000001447],
];
export const CUSTOMS_WAREHOUSE_CENTRE: Point = [
  443.29859855609675, -358.2550000001447,
];
/** Photo-fit sections, relative to the shared horizontal building datum.
 * City TOPELEV is a highest element, not a continuous roof surface. The 2022
 * aerial supersedes a mistaken solid hip interpretation: broad gravel center,
 * sloped green perimeter, small rooflights. Heights remain inferred. */
export const CUSTOMS_WAREHOUSE_SECTION = {
  baseBottom: -2,
  stoneTop: 7.15,
  stoneCap: 7.5,
  lower: { sill: 7.8, head: 10.95 },
  middle: { sill: 12.3, head: 15.5 },
  upper: { sill: 17.1, spring: 19.65, crown: 20.95 },
  brickTop: 21.95,
  corniceTop: 23,
  roofJunction: 24.7596624933,
  flatRoof: 29.3,
  historicalHighestElement: 31.6296624933,
  recess: 0.42,
  bays: 5,
  course: 0.4,
} as const;

export function warehouseBays(edge: number) {
  const a = CUSTOMS_WAREHOUSE_RING[edge],
    b = CUSTOMS_WAREHOUSE_RING[(edge + 1) % 4];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const margin = 0.85;
  const width = (length - 2 * margin) / CUSTOMS_WAREHOUSE_SECTION.bays;
  return Array.from({ length: CUSTOMS_WAREHOUSE_SECTION.bays }, (_, i) => ({
    centre: margin + (i + 0.5) * width,
    width,
    openingWidth: Math.min(4.15, width - 1.35),
  }));
}

/** City 2009 part 161612 boundary, transformed to the runtime map datum.
 * The polygon marks a roof partition, not a measured ridge/eave break. */
export const CUSTOMS_WAREHOUSE_INNER_ROOF: Point[] = [
  [423.7303633593, -360.0809777638],
  [442.0026994331, -378.3307230597],
  [464.5678405807, -355.9172292726],
  [446.3037359663, -337.6675705094],
];

/** Broad flat gravel center traced from the City2022 orthophoto, registered
 * to the live outline. This is an aerial interpretation, not a roof survey. */
export const CUSTOMS_WAREHOUSE_FLAT_ROOF: Point[] = [
  [431.46357, -360.16219],
  [440.55964, -369.02266],
  [453.95425, -356.37861],
  [444.96529, -347.73983],
];
