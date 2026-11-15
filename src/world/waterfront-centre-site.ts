import { pointInPoly, type Point } from "./data";
export const WATERFRONT_CENTRE_ID = "w143683980";
export const WATERFRONT_CENTRE_HEIGHT = 91.75;
export const WATERFRONT_CENTRE_GROUND = 5.5;
export const WATERFRONT_CENTRE_FLOORS = 22;
export const WATERFRONT_CENTRE_ORIGIN: Point = [344.198598556, -512.68];
/** Source-map world ring, unmodified collision envelope. Height is OSM-derived;
 * detailed section/radii/setbacks below are photographic estimates. */
export const WATERFRONT_CENTRE_RING: Point[] = [
  [324.048598556, -526.63],
  [345.048598556, -549.63],
  [368.548598556, -539.13],
  [380.048598556, -510.13],
  [369.048598556, -484.63],
  [361.048598556, -482.13],
  [326.048598556, -502.13],
  [327.048598556, -505.13],
  [321.548598556, -510.13],
  [319.548598556, -517.13],
];
export const waterfrontLevel = (level: number) =>
  level === 0
    ? 0
    : WATERFRONT_CENTRE_GROUND +
      ((level - 1) * (WATERFRONT_CENTRE_HEIGHT - WATERFRONT_CENTRE_GROUND)) /
        21;
/** Rounded Burrard/Cordova end through the mapped coarse corner, not Canada Place.
 * Bezier convex combinations smooth the source corner without moving streets. */
export function waterfrontTowerRing(): Point[] {
  const r = WATERFRONT_CENTRE_RING,
    c = WATERFRONT_CENTRE_ORIGIN;
  const inset = (p: Point, d: number): Point => {
    const n = Math.hypot(c[0] - p[0], c[1] - p[1]);
    return [p[0] + ((c[0] - p[0]) * d) / n, p[1] + ((c[1] - p[1]) * d) / n];
  };
  const ring: Point[] = [
    inset(r[0], 0.3),
    ...r.slice(1, 6).map((p) => inset(p, 2.1)),
    inset(r[6], 0.3),
  ];
  const controls = [r[6], r[7], r[8], r[9], r[0]].map((p) => inset(p, 0.3));
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    let q = controls.map((p) => [...p] as Point);
    while (q.length > 1)
      q = q
        .slice(0, -1)
        .map((p, j) => [
          p[0] * (1 - t) + q[j + 1][0] * t,
          p[1] * (1 - t) + q[j + 1][1] * t,
        ]);
    let p = q[0];
    while (!pointInPoly(p[0], p[1], r.flat()))
      p = [p[0] * 0.99 + c[0] * 0.01, p[1] * 0.99 + c[1] * 0.01];
    ring.push(p);
  }
  return ring;
}
