import { ShapeUtils, Vector2 } from "three";
import type { Point } from "./data";

export function ringTriangles(pts: number[]): Point[][] {
  const ring: Point[] = Array.from({ length: pts.length / 2 }, (_, i) => [
    pts[2 * i],
    pts[2 * i + 1],
  ]);
  if (
    ring.length > 1 &&
    ring[0][0] === ring.at(-1)![0] &&
    ring[0][1] === ring.at(-1)![1]
  )
    ring.pop();
  return ShapeUtils.triangulateShape(
    ring.map((p) => new Vector2(...p)),
    [],
  ).map((ids) => ids.map((i) => ring[i]));
}
export function polygonArea(p: Point[]) {
  return (
    Math.abs(
      p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}
function overlaps(a: Point[], b: Point[]) {
  for (const axis of [0, 1])
    if (
      Math.max(...a.map((p) => p[axis])) <=
        Math.min(...b.map((p) => p[axis])) ||
      Math.max(...b.map((p) => p[axis])) <= Math.min(...a.map((p) => p[axis]))
    )
      return false;
  return true;
}
/** Split a convex polygon at one directed line. Shared intersections are computed
 * once so both sides retain identical edges, including nearly collinear edges. */
function split(p: Point[], a: Point, b: Point, orientation: number) {
  const distance = (q: Point) =>
    orientation *
    ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
  const inside: Point[] = [],
    outside: Point[] = [];
  const eps = 1e-9 * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
  for (let i = 0; i < p.length; i++) {
    const q = p[i],
      r = p[(i + 1) % p.length],
      dq = distance(q),
      dr = distance(r);
    if (dq >= -eps) inside.push(q);
    if (dq <= eps) outside.push(q);
    if ((dq > eps && dr < -eps) || (dq < -eps && dr > eps)) {
      const t = dq / (dq - dr),
        hit: Point = [q[0] + t * (r[0] - q[0]), q[1] + t * (r[1] - q[1])];
      inside.push(hit);
      outside.push(hit);
    }
  }
  const clean = (ring: Point[]) => {
    const result = ring.filter(
      (p, i) =>
        Math.hypot(
          p[0] - ring[(i + ring.length - 1) % ring.length][0],
          p[1] - ring[(i + ring.length - 1) % ring.length][1],
        ) > 1e-8,
    );
    return result.length >= 3 && polygonArea(result) > 1e-8 ? result : [];
  };
  return { inside: clean(inside), outside: clean(outside) };
}
function orientation(p: Point[]) {
  return Math.sign(
    (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
      (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]),
  );
}
export function intersectTriangle(subject: Point[], triangle: Point[]) {
  if (!overlaps(subject, triangle)) return [];
  let inside = subject;
  const sign = orientation(triangle);
  for (let i = 0; i < 3 && inside.length; i++)
    inside = split(inside, triangle[i], triangle[(i + 1) % 3], sign).inside;
  return inside;
}
export function subtractTriangle(subject: Point[], triangle: Point[]) {
  if (!overlaps(subject, triangle)) return [subject];
  const output: Point[][] = [];
  let inside = subject;
  const sign = orientation(triangle);
  for (let i = 0; i < 3 && inside.length; i++) {
    const parts = split(inside, triangle[i], triangle[(i + 1) % 3], sign);
    if (parts.outside.length) output.push(parts.outside);
    inside = parts.inside;
  }
  return output;
}
/** Convex fragments avoid sweep-line boolean instability where triangulated
 * terrain shares long collinear edges with the constructed surfaces. */
export function partitionTriangle(
  subject: Point[],
  boundary: Point[][],
  cutouts: Point[][],
) {
  let pieces = boundary
    .map((t) => intersectTriangle(subject, t))
    .filter((p) => p.length);
  for (const cut of cutouts)
    pieces = pieces.flatMap((p) => subtractTriangle(p, cut));
  return pieces;
}
