import { pointInPoly, segmentPoint, type CityData, type Point } from "./data";
import type { CanadaPlaceSite } from "./canada-place-site";
import {
  CANADA_PLACE_ENTRY_CONNECTOR,
  CANADA_PLACE_DECK_Y,
  supportedDeck,
} from "./canada-place-deck";
const open = (r: Point[]) =>
  r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1]
    ? r.slice(0, -1)
    : r;
export type CanadaPlaceGuardSegment = {
  a: Point;
  b: Point;
  baseA: number;
  baseB: number;
  topA: number;
  topB: number;
};
/** Estimated safety rails, not a reconstruction of the real railing layout.
 * Shared segment endpoints/heights are also consumed by collision. */
export function canadaPlaceGuardSegments(
  data: Pick<CityData, "buildings">,
  site: CanadaPlaceSite,
  oldHeight: (x: number, z: number) => number,
): CanadaPlaceGuardSegment[] {
  const nearby = data.buildings.filter((b) =>
    b.pts.some(
      (x, i) =>
        i % 2 === 0 &&
        x >= site.bounds.minX - 2 &&
        x <= site.bounds.maxX + 2 &&
        b.pts[i + 1] >= site.bounds.minZ - 2 &&
        b.pts[i + 1] <= site.bounds.maxZ + 2,
    ),
  );
  const contact = (x: number, z: number) =>
    nearby.some(
      (b) =>
        pointInPoly(x, z, b.pts) ||
        b.pts.some(
          (_, i) =>
            i % 2 === 0 &&
            segmentPoint(
              x,
              z,
              b.pts[i],
              b.pts[i + 1],
              b.pts[(i + 2) % b.pts.length],
              b.pts[(i + 3) % b.pts.length],
            ).d < 0.55,
        ),
    );
  const segments: CanadaPlaceGuardSegment[] = [];
  for (const polygon of site.supportPolygons) {
    const ring = open(polygon.outer);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length],
        length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (length < 0.15) continue;
      const nx = (q[1] - p[1]) / length,
        nz = -(q[0] - p[0]) / length,
        n = Math.ceil(length / 2);
      for (let j = 0; j < n; j++) {
        const edge = (t: number): Point => [
          p[0] + (q[0] - p[0]) * t,
          p[1] + (q[1] - p[1]) * t,
        ];
        const e = edge(j / n),
          f = edge((j + 1) / n);
        if (
          ![e, f, edge((j + 0.5) / n)].every(([x, z]) => {
            const ox = x + nx * 0.2,
              oz = z + nz * 0.2,
              top = site.supportHeight(x, z) + 0.15;
            return (
              !contact(x, z) &&
              !pointInPoly(x, z, CANADA_PLACE_ENTRY_CONNECTOR) &&
              !site.contains(ox, oz) &&
              top - oldHeight(ox, oz) > 0.75 &&
              !(
                supportedDeck(ox, oz) &&
                Math.abs(top - CANADA_PLACE_DECK_Y) < 0.3
              )
            );
          })
        )
          continue;
        const a: Point = [e[0] - nx * 0.12, e[1] - nz * 0.12],
          b: Point = [f[0] - nx * 0.12, f[1] - nz * 0.12];
        if (!site.contains(...a) || !site.contains(...b)) continue;
        const baseA = site.supportHeight(...a) + 0.15,
          baseB = site.supportHeight(...b) + 0.15;
        segments.push({
          a,
          b,
          baseA,
          baseB,
          topA: baseA + 1.05,
          topB: baseB + 1.05,
        });
      }
    }
  }
  return segments;
}
