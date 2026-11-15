import polygonClipping from "polygon-clipping";
import { pointInPoly, segmentPoint, type Point } from "./data";

export interface ExteriorRecessCollision {
  floorAt(x: number, z: number): number | undefined;
  blocked(
    x: number,
    z: number,
    radius: number,
    y: number,
    camera: boolean,
  ): boolean;
}

/** Subtract only modeled exterior openings. The remaining footprint, rear
 * glazing, terminal returns, columns and ceiling still form a closed building. */
export function createExteriorRecessCollision(options: {
  footprint: Point[];
  openings: Point[][];
  closures: [Point, Point][];
  columns: { point: Point; radius: number }[];
  floorAt(x: number, z: number): number | undefined;
  ceiling: number | ((x: number, z: number) => number);
}): ExteriorRecessCollision {
  const residual = polygonClipping
    .difference(
      [options.footprint],
      ...options.openings.map((p) => {
        // Cross the opening by 1 mm before clipping: collinear floating-point
        // coordinates must not leave an invisible wall along the original face.
        const dx = p[1][0] - p[0][0],
          dz = p[1][1] - p[0][1];
        const length = Math.hypot(dx, dz);
        return [
          p.map(
            (v, i): Point =>
              i < 2
                ? [v[0] + (dz / length) * 0.001, v[1] - (dx / length) * 0.001]
                : v,
          ),
        ];
      }),
    )
    .map((p) => p.map((ring) => ring.flat()));
  const original = [[options.footprint.flat()]];
  const circleHits = (
    polygons: number[][][],
    x: number,
    z: number,
    r: number,
  ) =>
    polygons.some((rings) => {
      if (
        pointInPoly(x, z, rings[0]) &&
        !rings.slice(1).some((h) => pointInPoly(x, z, h))
      )
        return true;
      return rings.some((ring) => {
        for (let i = 0; i < ring.length; i += 2) {
          const next = (i + 2) % ring.length;
          if (
            segmentPoint(x, z, ring[i], ring[i + 1], ring[next], ring[next + 1])
              .d < r
          )
            return true;
        }
        return false;
      });
    });
  return {
    floorAt: options.floorAt,
    blocked(x, z, radius, referenceY, camera) {
      const floor = options.floorAt(x, z) ?? 0;
      const y = Number.isFinite(referenceY) ? referenceY : floor;
      const top = camera ? y + radius : y + 1.8;
      const ceiling =
        typeof options.ceiling === "number"
          ? options.ceiling
          : options.ceiling(x, z);
      if (top >= ceiling || (camera && y + radius < floor))
        return circleHits(original, x, z, radius);
      if (circleHits(residual, x, z, radius)) return true;
      if (
        options.closures.some(
          ([a, b]) => segmentPoint(x, z, ...a, ...b).d < radius + 0.025,
        )
      )
        return true;
      return options.columns.some(
        (p) => Math.hypot(x - p.point[0], z - p.point[1]) < radius + p.radius,
      );
    },
  };
}
