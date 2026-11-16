import * as T from "three";
import clipping, { type MultiPolygon } from "polygon-clipping";
import { flatPolygon } from "./geometry";
import type { Road } from "./data";
import type { RobsonStreetEdgeSite } from "./robson-street-edge";

const area = (polygons: MultiPolygon) =>
  polygons.reduce(
    (total, polygon) =>
      total +
      polygon.reduce((sum, ring, hole) => {
        let a = 0;
        for (let i = 0; i < ring.length - 1; i++)
          a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        return sum + (hole ? -1 : 1) * Math.abs(a / 2);
      }, 0),
    0,
  );

/** Exact world-XZ replacement of duplicate pedestrian finish only. Affine interpolation preserves
 * the original surface and all attributes outside the holes, including UVs.
 * A changed input is disposed; a disjoint input keeps identity and indexing.
 * Apply transforms first. Road and bridge geometry are never inputs. */
export function clipRobsonStreetPaths(
  source: T.BufferGeometry,
  site: RobsonStreetEdgeSite,
  road: Road,
): T.BufferGeometry {
  // Original traffic, bikeways, steps, crossing paint and the public plaza
  // remain byte-identical. Only duplicated footway finish is replaced.
  if (road.kind !== "footway" || road.crossing) return source;
  const masks: MultiPolygon = site.coverage;
  const points = masks.flat(2);
  const bounds = {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minZ: Math.min(...points.map((p) => p[1])),
    maxZ: Math.max(...points.map((p) => p[1])),
  };
  source.computeBoundingBox();
  const box = source.boundingBox;
  if (
    !box ||
    box.max.x < bounds.minX ||
    box.min.x > bounds.maxX ||
    box.max.z < bounds.minZ ||
    box.min.z > bounds.maxZ
  )
    return source;
  if (source.groups.length)
    throw new Error(
      "Robson street finish cuts require an ungrouped world-space surface",
    );
  const position = source.getAttribute("position"),
    index = source.index;
  const attributes = Object.entries(source.attributes),
    result = new Map(attributes.map(([name]) => [name, [] as number[]]));
  let changed = false;
  const original = (id: number) => {
    for (const [name, attr] of attributes)
      for (let c = 0; c < attr.itemSize; c++)
        result.get(name)!.push(attr.getComponent(id, c));
  };
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
    const a = ids.map(
      (id) => [position.getX(id), position.getZ(id)] as [number, number],
    );
    const denominator =
      (a[1][1] - a[2][1]) * (a[0][0] - a[2][0]) +
      (a[2][0] - a[1][0]) * (a[0][1] - a[2][1]);
    if (
      Math.abs(denominator) < 1e-10 ||
      Math.max(...a.map((p) => p[0])) < bounds.minX ||
      Math.min(...a.map((p) => p[0])) > bounds.maxX ||
      Math.max(...a.map((p) => p[1])) < bounds.minZ ||
      Math.min(...a.map((p) => p[1])) > bounds.maxZ ||
      area(clipping.intersection([a], masks)) < 1e-8
    ) {
      ids.forEach(original);
      continue;
    }
    changed = true;
    for (const polygon of clipping.difference([a], masks)) {
      const piece = flatPolygon(
        polygon[0].slice(0, -1).flat(),
        polygon.slice(1).map((r) => r.slice(0, -1).flat()),
      );
      const p = piece.getAttribute("position"),
        ix = piece.index!;
      for (let j = 0; j < ix.count; j++) {
        const id = ix.getX(j),
          x = p.getX(id),
          z = p.getZ(id);
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
          denominator;
        const w1 =
          ((a[2][1] - a[0][1]) * (x - a[2][0]) +
            (a[0][0] - a[2][0]) * (z - a[2][1])) /
          denominator;
        const weights = [w0, w1, 1 - w0 - w1];
        for (const [name, attr] of attributes)
          for (let c = 0; c < attr.itemSize; c++) {
            result
              .get(name)!
              .push(
                name === "position" && c === 0
                  ? x
                  : name === "position" && c === 2
                    ? z
                    : weights.reduce(
                        (sum, w, k) => sum + w * attr.getComponent(ids[k], c),
                        0,
                      ),
              );
          }
      }
      piece.dispose();
    }
  }
  if (!changed) return source;
  const geometry = new T.BufferGeometry();
  for (const [name, attr] of attributes)
    geometry.setAttribute(
      name,
      new T.Float32BufferAttribute(
        result.get(name)!,
        attr.itemSize,
        attr.normalized,
      ),
    );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  source.dispose();
  return geometry;
}
