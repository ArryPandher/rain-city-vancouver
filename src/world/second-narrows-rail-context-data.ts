import bridgeSource from "./second-narrows-rail-source.json";
import { geo, type Point } from "./data";
import source from "./second-narrows-rail-context-source.json";

/** Geographic controls are retained OSM. The 650m height transition is an
 * explicit adaptation to the existing flattened yard, not a surveyed profile. */
export const SECOND_NARROWS_CONTEXT = {
  length: 650,
  bankStart: 20,
  railTop: bridgeSource.elevation.northRailTop,
  yardRailTop: 0.7,
  shoulderHalfWidth: 3.8,
  halfWidth: 16,
  step: 3,
  source,
} as const;
const reversed = new Set(["510021324", "588125863", "915622100"]);
export const SECOND_NARROWS_CONTEXT_POINTS: Point[] = source.ways.flatMap(
  (w, i) => {
    const p = w.geometry.map((p) => geo(p.lat, p.lon));
    if (reversed.has(w.id)) p.reverse();
    return i ? p.slice(1) : p;
  },
);
export const SECOND_NARROWS_CONTEXT_STATIONS = [0];
for (let i = 1; i < SECOND_NARROWS_CONTEXT_POINTS.length; i++) {
  const a = SECOND_NARROWS_CONTEXT_POINTS[i - 1],
    b = SECOND_NARROWS_CONTEXT_POINTS[i];
  SECOND_NARROWS_CONTEXT_STATIONS.push(
    SECOND_NARROWS_CONTEXT_STATIONS[i - 1] +
      Math.hypot(b[0] - a[0], b[1] - a[1]),
  );
}
const railNormals = SECOND_NARROWS_CONTEXT_POINTS.map((p, i) => {
  const before = SECOND_NARROWS_CONTEXT_POINTS[Math.max(0, i - 1)],
    after =
      SECOND_NARROWS_CONTEXT_POINTS[
        Math.min(SECOND_NARROWS_CONTEXT_POINTS.length - 1, i + 1)
      ];
  const normal = (a: Point, b: Point): Point => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
  };
  const a = i ? normal(before, p) : normal(p, after),
    b = i < SECOND_NARROWS_CONTEXT_POINTS.length - 1 ? normal(p, after) : a;
  const x = a[0] + b[0],
    z = a[1] + b[1],
    length = Math.hypot(x, z),
    nx = x / length,
    nz = z / length,
    dot = nx * a[0] + nz * a[1];
  return [nx / dot, nz / dot] as Point;
});
/** Mitered offset endpoints are interpolated along each retained source segment,
 * avoiding overlapping cross sections around closely spaced OSM bend nodes. */
export function railContextPoint(station: number, across = 0): Point {
  const ss = SECOND_NARROWS_CONTEXT_STATIONS,
    p = SECOND_NARROWS_CONTEXT_POINTS;
  let i = 1;
  while (i < ss.length - 1 && station > ss[i]) i++;
  const a = p[i - 1],
    b = p[i],
    length = ss[i] - ss[i - 1],
    t = (station - ss[i - 1]) / length;
  const na = railNormals[i - 1],
    nb = railNormals[i];
  return [
    a[0] + (b[0] - a[0]) * t + (na[0] + (nb[0] - na[0]) * t) * across,
    a[1] + (b[1] - a[1]) * t + (na[1] + (nb[1] - na[1]) * t) * across,
  ];
}
/** Linear restrained grade, with 30m easing at each end. Maximum1.49%.
 * Rails remain level across the source service-road underpass. */
export function railContextTop(s: number) {
  const start = SECOND_NARROWS_CONTEXT.bankStart,
    end = SECOND_NARROWS_CONTEXT.length;
  const x = Math.max(0, Math.min(end - start, s - start)),
    length = end - start,
    ease = 30;
  const integral =
    x < ease
      ? (x * x) / (2 * ease)
      : x > length - ease
        ? length - ease - (length - x) ** 2 / (2 * ease)
        : x - ease / 2;
  return (
    SECOND_NARROWS_CONTEXT.railTop -
    ((SECOND_NARROWS_CONTEXT.railTop - SECOND_NARROWS_CONTEXT.yardRailTop) *
      integral) /
      (length - ease)
  );
}
