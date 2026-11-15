import type { Point } from "./data";

export const PACIFIC_COAST_ID = "w143683962";
/** Exact current simplified map outline. Cordova=edge0; Howe=edge1. */
export const PACIFIC_COAST_RING: Point[] = [
  [416.0485985560963, -407.1300000001447],
  [427.5485985560963, -395.1300000001447],
  [405.0485985560963, -372.6300000001447],
  [393.0485985560963, -384.6300000001447],
];
export const PACIFIC_COAST_CENTRE: Point = [
  410.4235985560963, -389.8800000001447,
];
/** Photographic section fit after the first native street comparison,
 * relative to the shared horizontal building datum. A taller street base and
 * 1.39m top frieze restore the modern facade's source-supported proportions.
 * Six upper window courses plus the modern street floor are visible. Three
 * original lower floors are under the raised street, not extra above-road rows.
 * Flat roof/parapet uses City41.57 - neighborhood7.52 - local datum9.257773.
 * TOPELEV describes the highest element, not a surveyed complete roof plane. */
export const PACIFIC_COAST_SECTION = {
  baseBottom: -1.3,
  baseTop: 4.65,
  beltTop: 4.95,
  roof: 24.3,
  parapet: 24.7922268448,
  plantRoom: 26.9,
  historicalHighestElement: 27.6522268448,
  windowRecess: 0.34,
  baseRecess: 0.52,
  rows: [
    { sill: 5.4, head: 7.65 },
    { sill: 8.55, head: 10.8 },
    { sill: 11.7, head: 13.95 },
    { sill: 14.85, head: 17.1 },
    { sill: 18.0, head: 20.25 },
    { sill: 21.15, head: 23.4 },
  ],
} as const;
/** Small City2009 rooftop part165371; all vertices lie inside the live outline.
 * The 2022 aerial shows a small plant enclosure, not a building-wide hip. */
export const PACIFIC_COAST_PLANT_RING: Point[] = [
  [421.116867782, -389.8013479662],
  [417.2621127981, -385.7693449603],
  [410.5522775693, -391.6146290014],
  [414.2339155025, -395.8054357648],
];
export function pacificCoastBays(edge: number) {
  const a = PACIFIC_COAST_RING[edge],
    b = PACIFIC_COAST_RING[(edge + 1) % 4];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const count = edge % 2 ? 7 : 3,
    margin = edge % 2 ? 0.8 : 1.05,
    width = (length - 2 * margin) / count;
  return Array.from({ length: count }, (_, i) => {
    const centre = margin + (i + 0.5) * width,
      openingWidth = width * (edge % 2 ? 0.75 : 0.72);
    return {
      centre,
      width,
      left: centre - openingWidth / 2,
      right: centre + openingWidth / 2,
    };
  });
}

/** Closed entrance thresholds sampled on the existing shared Howe sidewalk
 * (0.3m outside each mapped bay), then raised 40mm. Refit if that grade changes. */
export const PACIFIC_COAST_ENTRANCE_THRESHOLDS: Record<number, number> = {
  2: -0.34212081459707825,
  3: -0.23680399950014944,
};
