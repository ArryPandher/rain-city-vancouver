import type { Point } from "./data";
export const TERMINAL_CITY_ID = "w143683933";
export const TERMINAL_CITY_HEIGHT = 99;
export const TERMINAL_CITY_CLUB_HEIGHT = 21.94;
export const TERMINAL_CITY_FLOORS = 30;
export const TERMINAL_CITY_ORIGIN: Point = [
  325.5485985560963, -391.6300000001447,
];
export const TERMINAL_CITY_U: Point = [0.7115399211638492, -0.7026456721493012];
export const TERMINAL_CITY_V: Point = [0.7026456721493012, 0.7115399211638492];
export function terminalCityPoint(u: number, v: number): Point {
  return [
    TERMINAL_CITY_ORIGIN[0] + u * TERMINAL_CITY_U[0] + v * TERMINAL_CITY_V[0],
    TERMINAL_CITY_ORIGIN[1] + u * TERMINAL_CITY_U[1] + v * TERMINAL_CITY_V[1],
  ];
}
export const TERMINAL_CITY_RING: Point[] = [
  [325.5485985560963, -391.6300000001447],
  [365.5485985560963, -431.1300000001447],
  [385.0485985560963, -411.6300000001447],
  [345.5485985560963, -372.1300000001447],
];
/** Simplified City 2009 roof-part union in the mapped building basis. Individual
 * historical LiDAR roof fragments establish the asymmetric setbacks, not floor counts.
 * The slight NW source overhang is constrained inside the mapped envelope. */
export const TERMINAL_CITY_TOWER_UV: Point[] = [
  [2.7, 0.8],
  [37.15, 0.2],
  [37.5, 9.05],
  [34.05, 10.5],
  [34.05, 20.8],
  [19.05, 21.6],
  [19.05, 25.7],
  [3.8, 26.5],
];
export const TERMINAL_CITY_UPPER_UV: Point[] = [
  [2.7, 0.8],
  [37.15, 0.2],
  [37.5, 9.05],
  [34.05, 10.5],
  [34.05, 20.8],
  [3.57, 22.35],
];
export const TERMINAL_CITY_TOP_UV: Point[] = [
  [2.7, 0.8],
  [37.15, 0.2],
  [37.5, 9.05],
  [22.9, 14.84],
  [3.2, 14.56],
];
export const terminalCityLevel = (floor: number) =>
  floor <= 4
    ? (floor * TERMINAL_CITY_CLUB_HEIGHT) / 4
    : TERMINAL_CITY_CLUB_HEIGHT +
      ((floor - 4) * (94.94 - TERMINAL_CITY_CLUB_HEIGHT)) / 26;

/** Bow along Hornby Plaza, as resolved in the north-up roof aerial. Sagitta is
 * a 1.1m photographic estimate within the historical source overhang. */
export function terminalCityBowedRing(r: Point[]): Point[] {
  const [a, b] = r;
  const front: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    front.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - 1.1 * Math.sin(Math.PI * t),
    ]);
  }
  return [...front, ...r.slice(2)];
}
