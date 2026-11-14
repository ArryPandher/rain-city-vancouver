import * as T from "three";
import type { Building } from "./data";
import { isHouse } from "./building-use";
import { footprintArea } from "./building-profile";
type Point = [number, number];
type Plane = [number, number, number];
const value = (plane: Plane, p: Point) =>
  plane[0] * p[0] + plane[1] * p[1] + plane[2];
function clip(points: Point[], plane: Plane) {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      va = value(plane, a),
      vb = value(plane, b);
    if (va <= 1e-8) out.push(a);
    if (va < 0 !== vb < 0) {
      const t = va / (va - vb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
/** Clip each footprint triangle to the roof facets, preserving concave outlines. */
export function pitchedRoof(building: Building, height: number) {
  const shape =
    building.roofShape ?? (isHouse(building.kind) ? "gabled" : "flat");
  if (
    !["gabled", "hipped", "pyramidal"].includes(shape) ||
    height > 24 ||
    footprintArea(building.pts) > 2000
  )
    return null;
  const points: Point[] = Array.from(
    { length: building.pts.length / 2 },
    (_, i) => [building.pts[i * 2], building.pts[i * 2 + 1]],
  );
  if (points.length < 3) return null;
  let ux = 1,
    uz = 0,
    longest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len > longest) {
      longest = len;
      ux = dx / len;
      uz = dz / len;
    }
  }
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length,
    cz = points.reduce((s, p) => s + p[1], 0) / points.length;
  const local = points.map(
    ([x, z]) =>
      [(x - cx) * ux + (z - cz) * uz, -(x - cx) * uz + (z - cz) * ux] as Point,
  );
  const us = local.map((p) => p[0]),
    vs = local.map((p) => p[1]),
    minU = Math.min(...us),
    maxU = Math.max(...us),
    minV = Math.min(...vs),
    maxV = Math.max(...vs);
  const midU = (minU + maxU) / 2,
    midV = (minV + maxV) / 2,
    halfU = (maxU - minU) / 2,
    halfV = (maxV - minV) / 2;
  if (Math.min(halfU, halfV) < 0.5) return null;
  const rise = Math.min(
    height * 0.35,
    building.roofHeight ??
      Math.max(1.1, Math.min(3.5, Math.min(halfU, halfV) * 0.48)),
  );
  const bodyHeight = building.height ? height - rise : height,
    totalHeight = bodyHeight + rise;
  const planes: Plane[] =
    halfU >= halfV
      ? [
          [0, 1 / halfV, 1 - midV / halfV],
          [0, -1 / halfV, 1 + midV / halfV],
        ]
      : [
          [1 / halfU, 0, 1 - midU / halfU],
          [-1 / halfU, 0, 1 + midU / halfU],
        ];
  if (shape !== "gabled")
    planes.push(
      ...((halfU >= halfV
        ? [
            [
              1 / (shape === "hipped" ? halfV : halfU),
              0,
              -minU / (shape === "hipped" ? halfV : halfU),
            ],
            [
              -1 / (shape === "hipped" ? halfV : halfU),
              0,
              maxU / (shape === "hipped" ? halfV : halfU),
            ],
          ]
        : [
            [
              0,
              1 / (shape === "hipped" ? halfU : halfV),
              -minV / (shape === "hipped" ? halfU : halfV),
            ],
            [
              0,
              -1 / (shape === "hipped" ? halfU : halfV),
              maxV / (shape === "hipped" ? halfU : halfV),
            ],
          ]) as Plane[]),
    );
  const world = (p: Point) =>
    [cx + p[0] * ux - p[1] * uz, cz + p[0] * uz + p[1] * ux] as Point;
  const roofPos: number[] = [],
    roofUV: number[] = [],
    wallPos: number[] = [],
    wallUV: number[] = [];
  const edges: [number, number, number, number, number, number][] = [];
  const top = (p: Point) =>
    bodyHeight +
    rise * Math.max(0, Math.min(...planes.map((f) => value(f, p))));
  const triangles = T.ShapeUtils.triangulateShape(
    local.map((p) => new T.Vector2(...p)),
    [],
  );
  for (const ids of triangles) {
    for (const f of planes) {
      let polygon = ids.map((i) => local[i]);
      for (const other of planes) {
        if (other === f) continue;
        polygon = clip(polygon, [
          f[0] - other[0],
          f[1] - other[1],
          f[2] - other[2],
        ]);
        if (polygon.length < 3) break;
      }
      for (let j = 1; j < polygon.length - 1; j++) {
        let tri = [polygon[0], polygon[j], polygon[j + 1]];
        const [a, b, c] = tri;
        const area =
          (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(area) < 1e-8) continue;
        if (area > 0) tri = [a, c, b];
        for (const p of tri) {
          const [x, z] = world(p);
          roofPos.push(x, top(p), z);
          roofUV.push(p[0] / 3.5, p[1] / 3.5);
        }
      }
    }
  }
  for (let i = 0; i < local.length; i++) {
    const a = local[i],
      b = local[(i + 1) % local.length],
      cuts = [0, 1];
    for (let f = 0; f < planes.length; f++)
      for (let g = f + 1; g < planes.length; g++) {
        const d: Plane = [
            planes[f][0] - planes[g][0],
            planes[f][1] - planes[g][1],
            planes[f][2] - planes[g][2],
          ],
          va = value(d, a),
          vb = value(d, b);
        if (va * vb < 0) cuts.push(va / (va - vb));
      }
    cuts.sort((x, y) => x - y);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let j = 0; j < cuts.length - 1; j++) {
      const t0 = cuts[j],
        t1 = cuts[j + 1],
        p: Point = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
        q: Point = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1],
        h0 = top(p),
        h1 = top(q);
      const [x, z] = world(p),
        [xx, zz] = world(q);
      if (Math.hypot(xx - x, zz - z) < 0.01) continue;
      edges.push([x, h0, z, xx, h1, zz]);
      if (Math.max(h0, h1) - bodyHeight < 0.001) continue;
      wallPos.push(
        x,
        bodyHeight,
        z,
        x,
        h0,
        z,
        xx,
        bodyHeight,
        zz,
        xx,
        bodyHeight,
        zz,
        x,
        h0,
        z,
        xx,
        h1,
        zz,
      );
      wallUV.push(
        (t0 * length) / 24,
        bodyHeight / 51.2,
        (t0 * length) / 24,
        h0 / 51.2,
        (t1 * length) / 24,
        bodyHeight / 51.2,
        (t1 * length) / 24,
        bodyHeight / 51.2,
        (t0 * length) / 24,
        h0 / 51.2,
        (t1 * length) / 24,
        h1 / 51.2,
      );
    }
  }
  const geometry = (positions: number[], uv: number[]) => {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  return {
    bodyHeight,
    totalHeight,
    roof: geometry(roofPos, roofUV),
    gables: geometry(wallPos, wallUV),
    edges,
  };
}
