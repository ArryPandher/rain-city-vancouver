import { pointInPoly, type Point } from "./data";
import { facadeFrame } from "./architectural-mesh";
import source from "./granville-square-howe-parts.json";

export const GRANVILLE_HOWE_ID = source.buildingId;
/** Same six vertices as the live map, reversed only for inward façade frames. */
export const GRANVILLE_HOWE_RING = source.baseRing as Point[];
export const GRANVILLE_HOWE_LOW_RING = source.lowRing as Point[];
export const GRANVILLE_HOWE_HIGH_ROOF = source.highRoof as Point[][][];
export const GRANVILLE_HOWE_ORIGIN: Point = [518.048598556, -427.296666667];
export const GRANVILLE_HOWE_HIGH_TOP = source.highTop;
export const GRANVILLE_HOWE_LOW_TOP = source.lowTop;
export const GRANVILLE_HOWE_SIGN_EDGE = 2;
/** Photo-fit section dimensions, not a survey of this building. Metres. */
export const GRANVILLE_HOWE_SECTION = {
  lower: { sill: 1.35, head: 4.7, recess: 0.7 },
  middle: { sill: 6.35, head: 8.25, recess: 1.1 },
  upper: { sill: 11.25, head: 13.95, recess: 1.05 },
  belt: { low: 8.25, knee: 10.35, high: 11.25, lowDepth: 1.1, highDepth: 0.08 },
  pier: 0.46,
  targetBay: 3.3,
  signTop: 15.9,
  signDepth: 2,
} as const;

export type GranvilleHoweFacade = {
  edge: number;
  a: Point;
  b: Point;
  top: number;
};

/** Snap only the two source shared-boundary endpoints to enclosing map edges.
 * This fills the small source/map generalization gap without narrow roof slivers. */
export function granvilleHoweFacades(): GranvilleHoweFacade[] {
  const result: GranvilleHoweFacade[] = [];
  for (let edge = 0; edge < GRANVILLE_HOWE_RING.length; edge++) {
    const a = GRANVILLE_HOWE_RING[edge],
      b = GRANVILLE_HOWE_RING[(edge + 1) % GRANVILLE_HOWE_RING.length],
      cut =
        edge === 1
          ? source.sharedBoundary.registered[2]
          : edge === 5
            ? source.sharedBoundary.registered[0]
            : undefined,
      points = [a, ...(cut ? [cut as Point] : []), b];
    for (let j = 1; j < points.length; j++) {
      const f = facadeFrame(points[j - 1], points[j]),
        mid = f.p(f.length / 2, 0, 0.05);
      result.push({
        edge,
        a: points[j - 1],
        b: points[j],
        top: pointInPoly(mid[0], mid[2], GRANVILLE_HOWE_LOW_RING.flat())
          ? GRANVILLE_HOWE_LOW_TOP
          : GRANVILLE_HOWE_HIGH_TOP,
      });
    }
  }
  return result;
}
