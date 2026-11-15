import { pointInPoly, roadWidth, segmentPoint, type Road } from "./data";
import { gridUV } from "./robson-site";

/** Existing mapped woodland at Robson/Hornby, registered against aerial imagery.
 * The outline is source geometry. This legacy normalized contour is not a
 * survey: CSLA/TCLF height descriptions do not resolve our runtime ground datum.
 * robson-mound-circulation rescales and recontours it for actual soil/contact.
 * See docs/sources/robson-mound-circulation.md. */
export const ROBSON_MOUND_OUTLINE = [
  -142.951401, 81.87, -142.951401, 76.87, -134.951401, 69.37, -135.951401,
  59.37, -131.451401, 54.37, -123.451401, 55.37, -109.451401, 73.37,
  -110.951401, 85.87, -121.951401, 101.37, -132.951401, 101.87, -130.451401,
  94.37, -133.951401, 87.87,
];
export const ROBSON_MOUND_CREST = 7.62;
export const ROBSON_MOUND_BOUNDS = {
  minX: -142.951401,
  maxX: -109.451401,
  minZ: 54.37,
  maxZ: 101.87,
};

export function robsonMoundEdgeDistance(x: number, z: number) {
  let distance = Infinity;
  const p = ROBSON_MOUND_OUTLINE;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    distance = Math.min(
      distance,
      segmentPoint(x, z, p[i], p[i + 1], p[j], p[j + 1]).d,
    );
  }
  return distance;
}

/** Normalized base field for the shared circulation/soil reconstruction.
 * The smoothstep has zero slope at the perimeter and normalized maximum. */
export function robsonMoundHeight(x: number, z: number) {
  const b = ROBSON_MOUND_BOUNDS;
  if (
    x < b.minX ||
    x > b.maxX ||
    z < b.minZ ||
    z > b.maxZ ||
    !pointInPoly(x, z, ROBSON_MOUND_OUTLINE)
  )
    return undefined;
  // A hard minimum inherits the polygon's straight medial ridges. The inverse
  // sixth-power blend rounds those switches over roughly 1–2 m in the interior
  // while still reaching exactly zero at every original boundary segment.
  let inverseSixth = 0;
  const p = ROBSON_MOUND_OUTLINE;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    const d = segmentPoint(x, z, p[i], p[i + 1], p[j], p[j + 1]).d;
    if (d < 1e-6) return 0;
    const cube = d * d * d;
    inverseSixth += 1 / (cube * cube);
  }
  // The registered ring's maximum blended distance is about 10.12 m. This
  // shoulder preserves a small source-height crest instead of lowering it.
  const t = Math.min(1, inverseSixth ** (-1 / 6) / 10);
  return ROBSON_MOUND_CREST * t * t * (3 - 2 * t);
}

/** Conservative road bounds also catch segments crossing the mound with both
 * endpoints outside it. These short local paths require edge-following samples. */
export function robsonMoundIntersects(points: number[]) {
  if (points.length < 4) return false;
  const b = ROBSON_MOUND_BOUNDS;
  for (let i = 0; i < points.length - 2; i += 2)
    if (
      Math.max(points[i], points[i + 2]) >= b.minX - 3 &&
      Math.min(points[i], points[i + 2]) <= b.maxX + 3 &&
      Math.max(points[i + 1], points[i + 3]) >= b.minZ - 3 &&
      Math.min(points[i + 1], points[i + 3]) <= b.maxZ + 3
    )
      return true;
  return false;
}

export function robsonMoundPathClear(
  x: number,
  z: number,
  roads: Road[],
  clearance: number,
) {
  for (const road of roads) {
    const radius = roadWidth(road) / 2 + clearance;
    for (let i = 0; i < road.pts.length - 2; i += 2)
      if (
        segmentPoint(
          x,
          z,
          road.pts[i],
          road.pts[i + 1],
          road.pts[i + 2],
          road.pts[i + 3],
        ).d < radius
      )
        return false;
  }
  return true;
}

/** Lawn remains open in the middle. Border masses interpret the aerial/photo
 * planting pattern; individual shrubs and species are not inventory claims. */
export function robsonMoundPlanting(x: number, z: number) {
  const height = robsonMoundHeight(x, z);
  if (height === undefined || robsonMoundEdgeDistance(x, z) < 1.1) return 0;
  const [u, v] = gridUV(x, z);
  const border = Math.max(
    Math.exp(-(((u + 157) / 6.5) ** 2 + ((v + 30) / 5.8) ** 2)),
    Math.exp(-(((u + 137) / 7.8) ** 2 + ((v + 44) / 7) ** 2)),
    Math.exp(-(((u + 144) / 9) ** 2 + ((v + 23) / 5.5) ** 2)),
    Math.exp(-(((u + 151) / 7) ** 2 + ((v + 43) / 4.8) ** 2)),
  );
  return border > 0.28 ? border : 0;
}
