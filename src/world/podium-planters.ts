import clipping, {
  type Polygon,
  type MultiPolygon,
  type Ring,
} from "polygon-clipping";

export type PlanterRegion = { outer: number[]; holes: number[][] };
export type PodiumPlanter = {
  curb: PlanterRegion;
  rim: PlanterRegion[];
  planting: PlanterRegion[];
};

function polygon(points: number[]): Polygon {
  const ring: Ring = [];
  for (let i = 0; i < points.length; i += 2)
    ring.push([points[i], points[i + 1]]);
  return [ring];
}
function area(p: Polygon): number {
  return p.reduce((total, ring, index) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return total + Math.abs(sum / 2) * (index ? -1 : 1);
  }, 0);
}

// Remove a conservative buffer around every boundary, including holes. Edge
// rectangles plus vertex squares avoid unstable concave offset-line joins.
function inset(polygons: MultiPolygon, distance: number): MultiPolygon {
  const cuts: Polygon[] = [];
  for (const p of polygons)
    for (const ring of p) {
      for (let i = 0; i < ring.length; i++) {
        const [x, z] = ring[i],
          [xx, zz] = ring[(i + 1) % ring.length];
        const len = Math.hypot(xx - x, zz - z);
        if (len < 1e-8) continue;
        const nx = (-(zz - z) / len) * distance,
          nz = ((xx - x) / len) * distance;
        cuts.push([
          [
            [x + nx, z + nz],
            [xx + nx, zz + nz],
            [xx - nx, zz - nz],
            [x - nx, z - nz],
          ],
        ]);
        cuts.push([
          [
            [x - distance, z - distance],
            [x + distance, z - distance],
            [x + distance, z + distance],
            [x - distance, z + distance],
          ],
        ]);
      }
    }
  return cuts.length ? clipping.difference(polygons, ...cuts) : [];
}
function region(p: Polygon): PlanterRegion {
  // clipping returns CCW outer / CW holes; omit duplicate closing vertices so
  // walls() does not create a degenerate final quad.
  const rings = p.map((r) => r.slice(0, -1).flat());
  return { outer: rings[0], holes: rings.slice(1) };
}

/** Localized generic planting only: not a survey of real roof gardens.
 * The caller passes the exact outline used for its generated tower walls.
 */
export function podiumPlanters(
  podium: number[],
  tower: number[],
  candidate: number[],
): PodiumPlanter[] {
  if (
    [podium, tower, candidate].some(
      (p) => p.length < 6 || p.length % 2 || !p.every(Number.isFinite),
    )
  )
    return [];
  try {
    const exposed = clipping.difference(polygon(podium), polygon(tower));
    const supported = inset(exposed, 0.65);
    const selected = clipping.intersection(supported, polygon(candidate));
    // Erode the selection itself to remove needles and sub-metre strips. This
    // leaves a real setback even at the clipping envelope's artificial edges.
    const usable = inset(selected, 0.45);
    return usable.flatMap((p) => {
      if (area(p) < 4) return [];
      const planting = inset([p], 0.22).filter((patch) => area(patch) >= 2);
      return planting.length
        ? [
            {
              curb: region(p),
              rim: clipping.difference([p], planting).map(region),
              planting: planting.map(region),
            },
          ]
        : [];
    });
  } catch {
    // Invalid source rings must not take down the surrounding building shell.
    return [];
  }
}
