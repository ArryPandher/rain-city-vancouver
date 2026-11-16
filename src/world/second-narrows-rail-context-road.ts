import * as T from "three";
import clipping from "polygon-clipping";
import { flatPolygon } from "./geometry";
import type { SecondNarrowsRailContext } from "./second-narrows-rail-context";
type P = [number, number];
export const RAIL_CONTEXT_SERVICE_ROADS = new Set([
  "w24007615",
  "w1265138308",
  "w1265138309",
]);

/** Re-triangulate only the three local service road ribbons against the exact
 * emitted bank triangles. Water, elevated roads and every off-patch road retain
 * their original buffers. All other vertex attributes remain affine source data. */
export function fitRailContextRoad(
  source: T.BufferGeometry,
  context: SecondNarrowsRailContext,
  offset: number,
) {
  source.computeBoundingBox();
  const b = source.boundingBox!,
    g = context.parts.ground.boundingBox!;
  if (
    b.max.x < g.min.x ||
    b.min.x > g.max.x ||
    b.max.z < g.min.z ||
    b.min.z > g.max.z
  )
    return source;
  const p = source.getAttribute("position"),
    ix = source.index,
    attrs = Object.entries(source.attributes);
  const result = new Map(attrs.map(([name]) => [name, [] as number[]]));
  let changed = false;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((k) => (ix ? ix.getX(i + k) : i + k));
    const a = ids.map((id) => [p.getX(id), p.getZ(id)] as P);
    const d =
      (a[1][1] - a[2][1]) * (a[0][0] - a[2][0]) +
      (a[2][0] - a[1][0]) * (a[0][1] - a[2][1]);
    const bounds: [number, number, number, number] = [
      Math.min(...a.map((v) => v[0])),
      Math.min(...a.map((v) => v[1])),
      Math.max(...a.map((v) => v[0])),
      Math.max(...a.map((v) => v[1])),
    ];
    const candidates = context.nearbyGround(bounds);
    const emit = (x: number, z: number, y?: number) => {
      const u =
        ((a[1][1] - a[2][1]) * (x - a[2][0]) +
          (a[2][0] - a[1][0]) * (z - a[2][1])) /
        d;
      const v =
        ((a[2][1] - a[0][1]) * (x - a[2][0]) +
          (a[0][0] - a[2][0]) * (z - a[2][1])) /
        d;
      const weights = [u, v, 1 - u - v];
      for (const [name, attr] of attrs)
        for (let k = 0; k < attr.itemSize; k++)
          result
            .get(name)!
            .push(
              name === "position" && k === 0
                ? x
                : name === "position" && k === 2
                  ? z
                  : name === "position" && k === 1 && y !== undefined
                    ? y
                    : weights.reduce(
                        (s, w, j) => s + w * attr.getComponent(ids[j], k),
                        0,
                      ),
            );
    };
    if (Math.abs(d) < 1e-10 || !candidates.length) {
      for (const id of ids)
        for (const [name, attr] of attrs)
          for (let k = 0; k < attr.itemSize; k++)
            result.get(name)!.push(attr.getComponent(id, k));
      continue;
    }
    let hit = false;
    for (const ground of candidates) {
      const q = ground.points.map((v) => [v[0], v[2]] as P),
        sign = Math.sign(
          (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) -
            (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]),
        );
      let polygon = a;
      for (let e = 0; e < 3 && polygon.length; e++) {
        const c = q[e],
          n = q[(e + 1) % 3],
          next: P[] = [];
        const distance = (v: P) =>
          sign *
          ((n[0] - c[0]) * (v[1] - c[1]) - (n[1] - c[1]) * (v[0] - c[0]));
        for (let j = 0; j < polygon.length; j++) {
          const v = polygon[j],
            w = polygon[(j + 1) % polygon.length],
            dv = distance(v),
            dw = distance(w),
            inside = dv >= -1e-9;
          if (inside) next.push(v);
          if (inside !== dw >= -1e-9) {
            const t = dv / (dv - dw);
            next.push([v[0] + (w[0] - v[0]) * t, v[1] + (w[1] - v[1]) * t]);
          }
        }
        polygon = next;
      }
      if (polygon.length < 3) continue;
      const [v, w, t] = ground.points,
        den = (w[2] - t[2]) * (v[0] - t[0]) + (t[0] - w[0]) * (v[2] - t[2]);
      const height = (x: number, z: number) => {
        const u =
            ((w[2] - t[2]) * (x - t[0]) + (t[0] - w[0]) * (z - t[2])) / den,
          vv = ((t[2] - v[2]) * (x - t[0]) + (v[0] - t[0]) * (z - t[2])) / den;
        return v[1] * u + w[1] * vv + t[1] * (1 - u - vv) + offset;
      };
      for (let j = 2; j < polygon.length; j++) {
        const tri = [polygon[0], polygon[j - 1], polygon[j]];
        const area =
          (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) -
          (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]);
        if (Math.abs(area) < 1e-8) continue;
        hit = true;
        tri.forEach((v) => emit(v[0], v[1], height(...v)));
      }
    }
    if (!hit) {
      ids.forEach((id) => {
        for (const [name, attr] of attrs)
          for (let k = 0; k < attr.itemSize; k++)
            result.get(name)!.push(attr.getComponent(id, k));
      });
      continue;
    }
    changed = true;
    for (const polygon of clipping.difference([a], context.masks)) {
      const out = flatPolygon(
          polygon[0].slice(0, -1).flat(),
          polygon.slice(1).map((r) => r.slice(0, -1).flat()),
        ),
        pos = out.getAttribute("position"),
        index = out.index!;
      for (let k = 0; k < index.count; k++) {
        const id = index.getX(k);
        emit(pos.getX(id), pos.getZ(id), offset);
      }
      out.dispose();
    }
  }
  if (!changed) return source;
  const geometry = new T.BufferGeometry();
  for (const [name, attr] of attrs)
    geometry.setAttribute(
      name,
      new T.Float32BufferAttribute(
        result.get(name)!,
        attr.itemSize,
        attr.normalized,
      ),
    );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  source.dispose();
  return geometry;
}
