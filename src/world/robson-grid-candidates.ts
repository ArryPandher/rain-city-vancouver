import { pointInPoly, type Point } from "./data";

/** Conservative square-grid broad phase for one Robson polygon with holes.
 * A cell crossed/touched by any ring edge is always retained. Without an edge
 * inside the closed cell, membership is constant, so its centre is sufficient.
 * The caller still performs the original exact triangle boolean for every
 * retained cell, preserving clipping order and emitted Float32 vertices.
 */
export function robsonGridCandidates(polygon: Point[][], step: number) {
  const edges = new Map<number, Set<number>>();
  const rings = polygon.map((r) => r.flat());
  const holes = rings.slice(1);
  const epsilon = step * 1e-8;
  for (const ring of polygon) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      const first = Math.floor((Math.min(a[0], b[0]) - epsilon) / step);
      const last = Math.floor((Math.max(a[0], b[0]) + epsilon) / step);
      for (let ix = first; ix <= last; ix++) {
        let lo = 0,
          hi = 1;
        if (dx !== 0) {
          const ta = (ix * step - epsilon - a[0]) / dx;
          const tb = ((ix + 1) * step + epsilon - a[0]) / dx;
          lo = Math.max(0, Math.min(ta, tb));
          hi = Math.min(1, Math.max(ta, tb));
          if (lo > hi) continue;
        }
        const za = a[1] + dz * lo,
          zb = a[1] + dz * hi;
        let row = edges.get(ix);
        if (!row) edges.set(ix, (row = new Set()));
        for (
          let iz = Math.floor((Math.min(za, zb) - epsilon) / step);
          iz <= Math.floor((Math.max(za, zb) + epsilon) / step);
          iz++
        )
          row.add(iz);
      }
    }
  }
  return (ix: number, iz: number) => {
    if (edges.get(ix)?.has(iz)) return true;
    const x = (ix + 0.5) * step,
      z = (iz + 0.5) * step;
    return (
      rings.length > 0 &&
      pointInPoly(x, z, rings[0]) &&
      !holes.some((hole) => pointInPoly(x, z, hole))
    );
  };
}
