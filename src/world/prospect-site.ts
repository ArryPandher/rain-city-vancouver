import { pointInPoly } from "./data";

// The small paved forecourt is interpreted between the mapped outer seawall,
// lighthouse footprint and photo-guided retaining bank. It is not a survey.
export const PROSPECT_FORECOURT = [
  -1548.15, -3415.0, -1548.6, -3416.5, -1550.2, -3420.5, -1553.45, -3424.13,
  -1557.95, -3425.63, -1566, -3426, -1580, -3422, -1581.7, -3429.5, -1560.69,
  -3434.9, -1556.45, -3435.0, -1551.77, -3433.8, -1548.31, -3431.4, -1545.25,
  -3428.0, -1543.8, -3425.02, -1541.5, -3417.0,
];
export function prospectForecourtHeight(x: number, z: number) {
  if (x < -1582 || x > -1541 || z < -3436 || z > -3414) return;
  return pointInPoly(x, z, PROSPECT_FORECOURT) ? 2 : undefined;
}
