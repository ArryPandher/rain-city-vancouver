import { SpatialHash } from "./collision";
import { pointInPoly, type Point } from "./data";
import { ringTriangles, subtractTriangle } from "./triangle-partition";

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
  private water = new SpatialHash<{ pts: number[] }>(160);
  private cuts = new SpatialHash<Point[]>(64);
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
      this.water.add({ pts }, minX, minZ, maxX, maxZ);
      // Triangulate each water/cutout polygon once. Re-running a polygon boolean
      // with the entire coastline for every shore cell made startup very slow.
      for (const triangle of ringTriangles(pts)) {
        const loX = Math.max(minX, Math.min(...triangle.map((p) => p[0]))),
          hiX = Math.min(maxX, Math.max(...triangle.map((p) => p[0]))),
          loZ = Math.max(minZ, Math.min(...triangle.map((p) => p[1]))),
          hiZ = Math.min(maxZ, Math.max(...triangle.map((p) => p[1])));
        if (loX <= hiX && loZ <= hiZ)
          this.cuts.add(triangle, loX, loZ, hiX, hiZ);
      }
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
    let pieces = [points];
    for (const cut of this.cuts.query(x, z, radius))
      pieces = pieces.flatMap((p) => subtractTriangle(p, cut));
    // Subtracting triangles preserves convex fragments, so a fan is sufficient.
    return pieces.flatMap((p) =>
      p.slice(2).map((_, i) => [p[0], p[i + 1], p[i + 2]]),
    );
  }
}
