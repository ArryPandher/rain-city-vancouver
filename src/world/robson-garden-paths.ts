import * as T from "three";
import clipping, { type MultiPolygon, type Polygon } from "polygon-clipping";
import type { Building, Road } from "./data";
import { flatPolygon } from "./geometry";
import { gridXZ, ROBSON_GARDEN_ID, ROBSON_LOWER_STAIR } from "./robson-site";

const masks = new WeakMap<Building, MultiPolygon>();
function ownership(garden: Building) {
  let mask = masks.get(garden);
  if (mask) return mask;
  const ring = Array.from(
    { length: garden.pts.length / 2 },
    (_, i) =>
      [Math.fround(garden.pts[i * 2]), Math.fround(garden.pts[i * 2 + 1])] as [
        number,
        number,
      ],
  );
  const s = ROBSON_LOWER_STAIR;
  const stair = [
    [s.startU, s.minV],
    [s.endU, s.minV],
    [s.endU, s.maxV],
    [s.startU, s.maxV],
  ].map(([u, v]) => gridXZ(u, v).map(Math.fround) as [number, number]);
  mask = clipping.union([ring], [stair]);
  masks.set(garden, mask);
  return mask;
}

function area(polygons: MultiPolygon) {
  return polygons.reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce((total, ring, hole) => {
        let a = 0;
        for (let i = 0; i < ring.length - 1; i++)
          a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        return total + (hole ? -1 : 1) * Math.abs(a / 2);
      }, 0),
    0,
  );
}

/** Remove only generic ground path fragments covered by the rendered garden
 * polygon or its exact lower stair rectangle. No custom geometry is an input.
 * New boundary vertices follow the existing route height; exterior vertices
 * and UVs retain their original values. A changed input is disposed; no-op
 * calls return the original geometry. Call only after the garden is enabled. */
export function clipRobsonGardenPaths(
  geometry: T.BufferGeometry,
  garden: Building | undefined,
  height: (x: number, z: number) => number,
  offset: number,
  road: Pick<Road, "kind" | "walkway">,
) {
  if (
    !garden ||
    garden.id !== ROBSON_GARDEN_ID ||
    road.walkway ||
    !["footway", "path", "pedestrian", "steps"].includes(road.kind) ||
    geometry.groups.length
  )
    return geometry;
  const p = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv"),
    n = geometry.getAttribute("normal"),
    ix = geometry.index;
  if (!p || !uv || !n) return geometry;
  const mask = ownership(garden);
  const points = mask.flat(2);
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minZ = Math.min(...points.map((p) => p[1])),
    maxZ = Math.max(...points.map((p) => p[1]));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  if (
    box.max.x < minX ||
    box.min.x > maxX ||
    box.max.z < minZ ||
    box.min.z > maxZ
  )
    return geometry;
  const positions: number[] = [],
    uvs: number[] = [],
    normals: number[] = [];
  let changed = false;
  function original(id: number) {
    positions.push(p.getX(id), p.getY(id), p.getZ(id));
    uvs.push(uv.getX(id), uv.getY(id));
    normals.push(n.getX(id), n.getY(id), n.getZ(id));
  }
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j));
    const a = ids.map((id) => [p.getX(id), p.getZ(id)] as [number, number]);
    const den =
      (a[1][1] - a[2][1]) * (a[0][0] - a[2][0]) +
      (a[2][0] - a[1][0]) * (a[0][1] - a[2][1]);
    const tri: Polygon = [a];
    if (
      Math.abs(den) < 1e-10 ||
      area(clipping.intersection(tri, mask)) < 1e-7
    ) {
      ids.forEach(original);
      continue;
    }
    changed = true;
    for (const polygon of clipping.difference(tri, mask)) {
      const part = flatPolygon(
        polygon[0].slice(0, -1).flat(),
        polygon.slice(1).map((r) => r.slice(0, -1).flat()),
      );
      const pp = part.getAttribute("position"),
        pi = part.index!;
      for (let k = 0; k < pi.count; k++) {
        const v = pi.getX(k),
          x = pp.getX(v),
          z = pp.getZ(v);
        const same = a.findIndex(
          (q) => Math.abs(q[0] - x) < 1e-6 && Math.abs(q[1] - z) < 1e-6,
        );
        if (same >= 0) {
          original(ids[same]);
          continue;
        }
        const w0 =
          ((a[1][1] - a[2][1]) * (x - a[2][0]) +
            (a[2][0] - a[1][0]) * (z - a[2][1])) /
          den;
        const w1 =
          ((a[2][1] - a[0][1]) * (x - a[2][0]) +
            (a[0][0] - a[2][0]) * (z - a[2][1])) /
          den;
        const w = [w0, w1, 1 - w0 - w1];
        positions.push(x, height(x, z) + offset, z);
        uvs.push(
          w.reduce((s, w, j) => s + w * uv.getX(ids[j]), 0),
          w.reduce((s, w, j) => s + w * uv.getY(ids[j]), 0),
        );
        const normal = new T.Vector3(
          ...([0, 1, 2].map((c) =>
            w.reduce((s, w, j) => s + w * n.getComponent(ids[j], c), 0),
          ) as [number, number, number]),
        ).normalize();
        normals.push(...normal.toArray());
      }
      part.dispose();
    }
  }
  if (!changed) return geometry;
  const result = new T.BufferGeometry();
  result.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  result.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  result.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.dispose();
  return result;
}
