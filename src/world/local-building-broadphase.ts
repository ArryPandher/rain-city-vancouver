import type { Building, Point } from "./data";

/** Conservative broadphase only: retain source objects/order and every polygon
 * whose envelope touches the subject. Polygon clipping still decides actual
 * overlap, including concave footprints and buildings enclosing the subject.
 * No cache: callers may replace/mutate source footprints between scene builds. */
export function buildingsOverlappingPolygon(
  buildings: readonly Building[],
  subject: readonly Point[],
): Building[] {
  if (!subject.length) return [];
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [x, z] of subject) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return [...buildings];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  // Keep sub-micrometre gaps for the boolean library's coordinate rounding.
  const epsilon = Math.max(
    1e-6,
    Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minZ), Math.abs(maxZ)) *
      Number.EPSILON *
      16,
  );
  return buildings.filter(({ pts }) => {
    let left = Infinity,
      right = -Infinity,
      bottom = Infinity,
      top = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i],
        z = pts[i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = Math.min(bottom, z);
      top = Math.max(top, z);
    }
    return (
      right >= minX - epsilon &&
      left <= maxX + epsilon &&
      top >= minZ - epsilon &&
      bottom <= maxZ + epsilon
    );
  });
}
