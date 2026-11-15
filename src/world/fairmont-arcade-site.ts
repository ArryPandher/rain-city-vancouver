import { type Vertex3, facadeFrame } from "./architectural-mesh";
import { pointInPoly, segmentPoint, type Point } from "./data";
import {
  FAIRMONT_WATERFRONT_RING as ring,
  FAIRMONT_WATERFRONT_CANOPY_SOURCE_RING as canopy,
  FAIRMONT_WATERFRONT_CANOPY_RING as roofPlan,
  FAIRMONT_WATERFRONT_CANOPY_UNDERSIDE,
  FAIRMONT_WATERFRONT_CANOPY_TOP,
} from "./fairmont-waterfront-site";

/** MCM photo interpretation, registered to the City canopy attachment chain.
 * These are estimated exterior sections, not surveyed lobby dimensions. */
export const FAIRMONT_ARCADE_DEPTH = 2.65;
export const FAIRMONT_ARCADE_PIER_RADIUS = 0.74;
export const FAIRMONT_ARCADE_PIER_DEPTH = 0.94;
/** Same 150 mm pavement finish as Canada Place, plus a 15 mm threshold lip. */
export const FAIRMONT_ARCADE_FLOOR_LIP = 0.015;
export const FAIRMONT_ARCADE_FLOOR_OFFSET = 0.15 + FAIRMONT_ARCADE_FLOOR_LIP;
export const FAIRMONT_ARCADE_CEILING = FAIRMONT_WATERFRONT_CANOPY_UNDERSIDE;

function nearestHowe(p: Point) {
  let best = { x: 0, z: 0, d: Infinity, t: 0, edge: 0 };
  for (let edge = 0; edge < 3; edge++) {
    const q = segmentPoint(...p, ...ring[edge], ...ring[edge + 1]);
    if (q.d < best.d) best = { ...q, edge };
  }
  return best;
}
function insetVertex(i: number): Point {
  const previous = facadeFrame(
      ring[(i + ring.length - 1) % ring.length],
      ring[i],
    ),
    next = facadeFrame(ring[i], ring[(i + 1) % ring.length]),
    a = previous.outward,
    b = next.outward,
    scale = FAIRMONT_ARCADE_DEPTH / (1 + a[0] * b[0] + a[1] * b[1]);
  return [
    ring[i][0] - (a[0] + b[0]) * scale,
    ring[i][1] - (a[1] + b[1]) * scale,
  ];
}
const terminal = nearestHowe(canopy[1]);
/** Only the retained wall under the mapped Howe projection is replaced. */
export const FAIRMONT_ARCADE_FRONTAGES = [0, 1, 2].map((edge) => {
  const f = facadeFrame(ring[edge], ring[edge + 1]),
    fraction = edge === terminal.edge ? terminal.t : 1,
    backA = insetVertex(edge),
    backEnd = insetVertex(edge + 1);
  return {
    edge,
    a: ring[edge],
    b: f.p(f.length * fraction, 0).filter((_, i) => i !== 1) as Point,
    backA,
    backB:
      edge === terminal.edge
        ? ([
            f.p(f.length * fraction, 0, FAIRMONT_ARCADE_DEPTH)[0],
            f.p(f.length * fraction, 0, FAIRMONT_ARCADE_DEPTH)[2],
          ] as Point)
        : backEnd,
    length: f.length * fraction,
  };
});
/** Six substantial piers follow attachment vertices 1–6. The short Canada Place
 * terminal span is closed by a wall return; vertex 7 is too close to the old
 * footprint corner to support a round pier without entering public space. */
export const FAIRMONT_ARCADE_PIERS = canopy.slice(1, 7).map((source, i) => {
  const q = nearestHowe(source),
    f = facadeFrame(ring[q.edge], ring[q.edge + 1]),
    // Terminal pier is fitted 0.85 m inside the closed Howe-junction return so its
    // full section remains in the exterior recess. The photograph, not the
    // historical roof vertex, supplies the pier station interpretation.
    along = q.t * f.length - (i === 0 ? 0.85 : 0),
    centre = f.p(along, 0, FAIRMONT_ARCADE_PIER_DEPTH);
  const point: Point = [centre[0], centre[2]];
  for (let j = 0; j < 32; j++) {
    const angle = (j * Math.PI) / 16;
    if (
      !pointInPoly(
        point[0] + Math.cos(angle) * FAIRMONT_ARCADE_PIER_RADIUS,
        point[1] + Math.sin(angle) * FAIRMONT_ARCADE_PIER_RADIUS,
        ring.flat(),
      )
    )
      throw new Error("Fairmont arcade pier escapes retained hotel footprint");
  }
  return {
    point,
    radius: FAIRMONT_ARCADE_PIER_RADIUS,
    edge: q.edge,
    along,
    canopyVertex: i + 1,
  };
});

export const FAIRMONT_ARCADE_OPEN_POLYGONS: Point[][] =
  FAIRMONT_ARCADE_FRONTAGES.map((section) => [
    section.a,
    section.b,
    section.backB,
    section.backA,
  ]);
/** Rear glazing and terminal returns are solid; the entire street edge is open. */
export const FAIRMONT_ARCADE_CLOSURES = [
  ...FAIRMONT_ARCADE_FRONTAGES.map((section) => ({
    a: section.backA,
    b: section.backB,
    kind: "glazing" as const,
  })),
  {
    a: FAIRMONT_ARCADE_FRONTAGES[0].a,
    b: FAIRMONT_ARCADE_FRONTAGES[0].backA,
    kind: "wall" as const,
  },
  {
    a: FAIRMONT_ARCADE_FRONTAGES.at(-1)!.b,
    b: FAIRMONT_ARCADE_FRONTAGES.at(-1)!.backB,
    kind: "wall" as const,
  },
];
export type FairmontArcadeFloorPanel = {
  section: number;
  left: number;
  right: number;
  /** Counterclockwise x/z: front-left, front-right, back-right, back-left. */
  corners: [Vertex3, Vertex3, Vertex3, Vertex3];
};
function triangleHeight(
  x: number,
  z: number,
  a: Vertex3,
  b: Vertex3,
  c: Vertex3,
) {
  const determinant =
      (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]),
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / determinant,
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / determinant,
    w = 1 - u - v;
  if (Math.min(u, v, w) < -1e-7) return undefined;
  return a[1] * u + b[1] * v + c[1] * w;
}
/** Pure geometry/collision contract. Arcade floor samples are cached 45 mm
 * outside the old hotel wall; canopy samples also cover the public projection.
 * Pass the baseline exterior sampler, never an arcade floor override.
 * Returned Y values are relative to datum (zero for the current hotel). */
export function createFairmontArcadeSite(
  groundHeight: (x: number, z: number) => number,
  datum = 0,
) {
  const floorPanels: FairmontArcadeFloorPanel[] = [];
  const sections = FAIRMONT_ARCADE_FRONTAGES.map((section, index) => {
    const f = facadeFrame(section.a, section.b),
      count = Math.max(1, Math.ceil(f.length / 0.5)),
      heights = Array.from({ length: count + 1 }, (_, i) => {
        const p = f.p((i * f.length) / count, 0, -0.045);
        return (
          Math.max(0, groundHeight(p[0], p[2]) - datum) +
          FAIRMONT_ARCADE_FLOOR_OFFSET
        );
      });
    const heightAt = (t: number) => {
      const u = Math.max(0, Math.min(count, t * count)),
        i = Math.min(count - 1, Math.floor(u));
      return heights[i] + (heights[i + 1] - heights[i]) * (u - i);
    };
    const back = (t: number, y = heightAt(t)): Vertex3 => [
      section.backA[0] + (section.backB[0] - section.backA[0]) * t,
      y,
      section.backA[1] + (section.backB[1] - section.backA[1]) * t,
    ];
    for (let i = 0; i < count; i++) {
      const left = i / count,
        right = (i + 1) / count;
      floorPanels.push({
        section: index,
        left,
        right,
        corners: [
          f.p(left * f.length, heights[i]),
          f.p(right * f.length, heights[i + 1]),
          back(right),
          back(left),
        ],
      });
    }
    const ceilingAt = (t: number, atBack = false) => {
      const p = atBack ? back(t, 0) : f.p(t * f.length, 0);
      return canopyTopAt(p[0], p[2]) - 0.64;
    };
    return { ...section, count, heightAt, ceilingAt, back };
  });
  const floorAt = (x: number, z: number) => {
    if (x < 459 || x > 470 || z < -491 || z > -450) return undefined;
    for (const panel of floorPanels) {
      const [a, b, c, d] = panel.corners;
      // Same diagonal as the upward-facing quad emitted by the mesh builder.
      const height =
        triangleHeight(x, z, a, d, c) ?? triangleHeight(x, z, a, c, b);
      if (height !== undefined) return height;
    }
    return undefined;
  };
  const ceilingAt = (x: number, z: number) => {
    return floorAt(x, z) === undefined ? undefined : canopyTopAt(x, z) - 0.64;
  };
  const referenceTopAt = (x: number, z: number) => {
    const floor = floorAt(x, z);
    if (floor !== undefined)
      return (
        floor - FAIRMONT_ARCADE_FLOOR_OFFSET + FAIRMONT_WATERFRONT_CANOPY_TOP
      );
    // Ignore the hidden hotel's zero ground mask at its attachment vertices.
    let nearest = { d: Infinity, height: 0 };
    for (const section of sections) {
      const q = segmentPoint(x, z, ...section.a, ...section.b);
      if (q.d < nearest.d)
        nearest = {
          d: q.d,
          height: section.heightAt(q.t) - FAIRMONT_ARCADE_FLOOR_OFFSET,
        };
    }
    if (nearest.d < 0.05 || pointInPoly(x, z, ring.flat()))
      return nearest.height + FAIRMONT_WATERFRONT_CANOPY_TOP;
    return (
      Math.max(0, groundHeight(x, z) - datum) + FAIRMONT_WATERFRONT_CANOPY_TOP
    );
  };

  // Structural roof: least-squares slope along the source plan's long axis.
  // The mean retains the City 6.43 m rise above sampled apron reference heights;
  // individual paving irregularities must never bend a spanning roof member.
  const axisVector: Point = [
      (canopy[7][0] + canopy[8][0] - canopy[0][0] - canopy[1][0]) / 2,
      (canopy[7][1] + canopy[8][1] - canopy[0][1] - canopy[1][1]) / 2,
    ],
    length = Math.hypot(...axisVector),
    axis: Point = [axisVector[0] / length, axisVector[1] / length],
    samples: { point: Point; referenceTop: number }[] = [];
  for (
    let x = Math.floor(Math.min(...roofPlan.map((p) => p[0]))) + 0.5;
    x < Math.max(...roofPlan.map((p) => p[0]));
    x++
  )
    for (
      let z = Math.floor(Math.min(...roofPlan.map((p) => p[1]))) + 0.5;
      z < Math.max(...roofPlan.map((p) => p[1]));
      z++
    )
      if (pointInPoly(x, z, roofPlan.flat()))
        samples.push({ point: [x, z], referenceTop: referenceTopAt(x, z) });
  const origin: Point = [
      samples.reduce((sum, p) => sum + p.point[0], 0) / samples.length,
      samples.reduce((sum, p) => sum + p.point[1], 0) / samples.length,
    ],
    height =
      samples.reduce((sum, p) => sum + p.referenceTop, 0) / samples.length,
    station = (x: number, z: number) =>
      (x - origin[0]) * axis[0] + (z - origin[1]) * axis[1],
    variance = samples.reduce((sum, p) => sum + station(...p.point) ** 2, 0),
    slope =
      samples.reduce(
        (sum, p) => sum + station(...p.point) * (p.referenceTop - height),
        0,
      ) / variance,
    canopyTopAt = (x: number, z: number) => height + slope * station(x, z),
    canopyPlane = {
      origin,
      axis,
      height,
      slope,
      samples,
      rmsError: Math.sqrt(
        samples.reduce(
          (sum, p) => sum + (canopyTopAt(...p.point) - p.referenceTop) ** 2,
          0,
        ) / samples.length,
      ),
    };
  return {
    sections,
    floorPanels,
    floorAt,
    ceilingAt,
    canopyTopAt,
    canopyPlane,
    openPolygons: FAIRMONT_ARCADE_OPEN_POLYGONS,
    closures: FAIRMONT_ARCADE_CLOSURES,
    piers: FAIRMONT_ARCADE_PIERS,
    ceiling: FAIRMONT_ARCADE_CEILING,
  };
}
export type FairmontArcadeSite = ReturnType<typeof createFairmontArcadeSite>;
