import polygonClipping, { type Polygon } from "polygon-clipping";
import { ShapeUtils, Vector2 } from "three";
import { SpatialHash } from "./collision";
import { pointInPoly, type Point } from "./data";

interface Edge {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}
/** Cut the visible heightfield at mapped water polygons. Interior cells remain
 * unchanged; only shore-crossing cells need polygon boolean operations.
 */
export class ShorelineClip {
  private edges = new SpatialHash<Edge>(32);
  private water = new SpatialHash<{ pts: number[]; polygon: Polygon }>(160);
  constructor(
    oceans: number[][],
    bounds: { minX: number; minZ: number; maxX: number; maxZ: number },
  ) {
    for (const pts of oceans) {
      const xs = pts.filter((_, i) => i % 2 === 0),
        zs = pts.filter((_, i) => i % 2 === 1);
      const minX = Math.max(bounds.minX, Math.min(...xs)),
        maxX = Math.min(bounds.maxX, Math.max(...xs)),
        minZ = Math.max(bounds.minZ, Math.min(...zs)),
        maxZ = Math.min(bounds.maxZ, Math.max(...zs));
      if (minX > maxX || minZ > maxZ) continue;
      const ring: Point[] = xs.map((x, i) => [x, zs[i]]);
      ring.push([...ring[0]]);
      this.water.add({ pts, polygon: [ring] }, minX, minZ, maxX, maxZ);
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i],
          b = ring[i + 1];
        const edge = {
          minX: Math.min(a[0], b[0]),
          maxX: Math.max(a[0], b[0]),
          minZ: Math.min(a[1], b[1]),
          maxZ: Math.max(a[1], b[1]),
        };
        const x0 = Math.max(minX, edge.minX),
          x1 = Math.min(maxX, edge.maxX),
          z0 = Math.max(minZ, edge.minZ),
          z1 = Math.min(maxZ, edge.maxZ);
        if (x0 <= x1 && z0 <= z1) this.edges.add(edge, x0, z0, x1, z1);
      }
    }
  }
  cell(x: number, z: number, radius: number): "land" | "water" | "shore" {
    if (
      this.edges
        .query(x, z, radius)
        .some(
          (e) =>
            e.minX <= x + radius &&
            e.maxX >= x - radius &&
            e.minZ <= z + radius &&
            e.maxZ >= z - radius,
        )
    )
      return "shore";
    return this.water.query(x, z).some((w) => pointInPoly(x, z, w.pts))
      ? "water"
      : "land";
  }
  triangle(points: Point[]): Point[][] {
    const x = points.reduce((n, p) => n + p[0], 0) / 3,
      z = points.reduce((n, p) => n + p[1], 0) / 3,
      radius = Math.max(...points.map((p) => Math.hypot(p[0] - x, p[1] - z)));
    const polygons = this.water.query(x, z, radius).map((w) => w.polygon);
    if (!polygons.length) return [points];
    const result = polygonClipping.difference(
      [[...points, points[0]]],
      ...polygons,
    );
    const triangles: Point[][] = [];
    for (const polygon of result) {
      const rings = polygon.map((r) =>
          r.slice(0, -1).map((p) => new Vector2(p[0], p[1])),
        ),
        flat = rings.flat();
      for (const indices of ShapeUtils.triangulateShape(
        rings[0],
        rings.slice(1),
      ))
        triangles.push(indices.map((i) => [flat[i].x, flat[i].y]));
    }
    return triangles;
  }
}
