import { facadeFrame, type Vertex3 } from "./architectural-mesh";
import { PACIFIC_COAST_RING as ring } from "./pacific-coast-site";
import type { Point } from "./data";

/** Original interpretation of the raised frontage in the 2013 photo. The
 * mapped Howe sidewalk is narrow; these dimensions preserve its through-route
 * and stop before the existing entrances. They are not surveyed measurements. */
export const PACIFIC_APRON = {
  cordovaWidth: 1.5,
  howeWidth: 1.05,
  howeLength: 8.8,
  platformBelowDatum: 0.1,
  railHeight: 0.72,
  railRadius: 0.022,
} as const;
export type ApronTriangle = [Vertex3, Vertex3, Vertex3];
export type ApronRail = { a: Vertex3; b: Vertex3 };

export function createPacificCoastApronSite(
  baselineHeight: (x: number, z: number) => number,
  datum: number,
) {
  const cordova = facadeFrame(ring[0], ring[1]),
    howe = facadeFrame(ring[1], ring[2]);
  const top = datum - PACIFIC_APRON.platformBelowDatum;
  const point = (f: typeof cordova, u: number, d: number): Point => {
    const p = f.p(u, 0, -d);
    return [p[0], p[2]];
  };
  const cOuter = point(cordova, cordova.length, PACIFIC_APRON.cordovaWidth),
    hOuter = point(howe, 0, PACIFIC_APRON.howeWidth);
  const n0 = cordova.outward,
    n1 = howe.outward,
    dot = n0[0] * n1[0] + n0[1] * n1[1],
    den = 1 - dot * dot,
    a = (PACIFIC_APRON.cordovaWidth - dot * PACIFIC_APRON.howeWidth) / den,
    b = (PACIFIC_APRON.howeWidth - dot * PACIFIC_APRON.cordovaWidth) / den;
  const corner: Point = [
    ring[1][0] + n0[0] * a + n1[0] * b,
    ring[1][1] + n0[1] * a + n1[1] * b,
  ];
  const start = point(cordova, 0, PACIFIC_APRON.cordovaWidth),
    end = point(howe, PACIFIC_APRON.howeLength, PACIFIC_APRON.howeWidth),
    endInner = point(howe, PACIFIC_APRON.howeLength, 0);
  const polygon: Point[] = [ring[0], ring[1], endInner, end, corner, start];
  const bounds = {
    minX: Math.min(...polygon.map((p) => p[0])),
    maxX: Math.max(...polygon.map((p) => p[0])),
    minZ: Math.min(...polygon.map((p) => p[1])),
    maxZ: Math.max(...polygon.map((p) => p[1])),
  };
  const triangles: ApronTriangle[] = [];
  const howeHeight = (u: number, p: Point) => {
    const t = Math.max(
        0,
        Math.min(1, (u - 1.4) / (PACIFIC_APRON.howeLength - 1.4)),
      ),
      blend = t * t * (3 - 2 * t);
    // Both mapped streets have sidewalk:none. Their current finished terrain
    // and walking support use baseline height, not Canada's +.15m shoulder.
    return top + (baselineHeight(...p) - top) * blend;
  };
  const addQuad = (a: Vertex3, b: Vertex3, c: Vertex3, d: Vertex3) =>
    triangles.push([a, b, c], [a, c, d]);
  const strip = (
    f: typeof cordova,
    length: number,
    width: number,
    y: (u: number, p: Point) => number,
  ) => {
    const n = Math.ceil(length / 0.5);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < 2; j++) {
        const vertex = (ii: number, jj: number): Vertex3 => {
          const u = (length * ii) / n,
            p = point(f, u, (width * jj) / 2);
          return [p[0], y(u, p), p[1]];
        };
        addQuad(
          vertex(i, j),
          vertex(i + 1, j),
          vertex(i + 1, j + 1),
          vertex(i, j + 1),
        );
      }
  };
  strip(cordova, cordova.length, PACIFIC_APRON.cordovaWidth, () => top);
  strip(howe, PACIFIC_APRON.howeLength, PACIFIC_APRON.howeWidth, howeHeight);
  const vertex = (p: Point): Vertex3 => [p[0], top, p[1]];
  addQuad(vertex(ring[1]), vertex(cOuter), vertex(corner), vertex(hOuter));
  /** Inclusive barycentrics: rendered triangles and collision use one surface. */
  const height = (x: number, z: number) => {
    if (
      x < bounds.minX - 0.0001 ||
      x > bounds.maxX + 0.0001 ||
      z < bounds.minZ - 0.0001 ||
      z > bounds.maxZ + 0.0001
    )
      return undefined;
    for (const [a, b, c] of triangles) {
      const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(det) < 1e-10) continue;
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      if (u >= -0.0001 && v >= -0.0001 && u + v <= 1.0001)
        return u * a[1] + v * b[1] + (1 - u - v) * c[1];
    }
    return undefined;
  };
  // No rail crosses the Howe entry. The short Cordova end return guards its
  // drop; the open Howe end is the gently graded, physically supported access.
  const edgePath: Point[] = [ring[0], start, corner, end];
  const edges: { a: Vertex3; b: Vertex3; bottomA: number; bottomB: number }[] =
      [],
    rails: ApronRail[] = [];
  for (let i = 1; i < edgePath.length; i++) {
    const a = edgePath[i - 1],
      b = edgePath[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const p = (t: number): Vertex3 => {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      return [x, height(x, z) ?? top, z];
    };
    const n = Math.ceil(length / 0.5);
    for (let j = 0; j < n; j++) {
      const pa = p(j / n),
        pb = p((j + 1) / n);
      edges.push({
        a: pa,
        b: pb,
        bottomA: baselineHeight(pa[0], pa[2]) - 0.07,
        bottomB: baselineHeight(pb[0], pb[2]) - 0.07,
      });
    }
    const posts = Math.max(1, Math.ceil(length / 1.85));
    for (let j = 0; j < posts; j++) {
      const a = p(j / posts),
        b = p((j + 1) / posts);
      rails.push({
        a: [a[0], a[1] + PACIFIC_APRON.railHeight, a[2]],
        b: [b[0], b[1] + PACIFIC_APRON.railHeight, b[2]],
      });
    }
  }
  return {
    polygon,
    bounds,
    triangles,
    edges,
    rails,
    top,
    height,
    entrance: [endInner, end] as [Point, Point],
  };
}
export type PacificCoastApronSite = ReturnType<
  typeof createPacificCoastApronSite
>;
