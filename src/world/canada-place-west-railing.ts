import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Source west edge: top rail vertices 0..23; 70 post boxes at24..1703.
 * Gate repair5592..5663 and mast repair5856+ are deliberately independent. */
export const CANADA_PLACE_WEST_RAIL_SOURCE = {
  positions: 6096,
  westVertices: 1704,
  westIndices: 2556,
  fingerprint: 1660285489,
};
export function canadaPlaceWestRailFingerprint(g: T.BufferGeometry) {
  const p = g.getAttribute("position"),
    ix = g.getIndex();
  if (!p || p.count !== 6096 || !ix || ix.count < 2556) return 0;
  let hash = 2166136261;
  for (let i = 0; i < 1704; i++)
    for (const v of [p.getX(i), p.getY(i), p.getZ(i)])
      hash = Math.imul(hash ^ Math.round(v * 1000), 16777619) >>> 0;
  for (let i = 0; i < 2556; i++)
    hash = Math.imul(hash ^ ix.getX(i), 16777619) >>> 0;
  return hash;
}
/** Reviewed west railing only. Retains all original source vertices.
 * Only the original 12 top-bar triangles are removed.
 * Render the returned batch without wire-grid shadows;
 * original posts retain their existing shadows and collision plane. */
export function refineCanadaPlaceWestRailing(
  g: T.BufferGeometry,
  materialName: string,
): T.BufferGeometry | null {
  if (
    materialName !== "steel" ||
    canadaPlaceWestRailFingerprint(g) !==
      CANADA_PLACE_WEST_RAIL_SOURCE.fingerprint ||
    g.userData.westRailRefined
  )
    return null;
  const p = g.getAttribute("position"),
    posts: T.Vector3[] = [];
  for (let start = 24; start < 1704; start += 24) {
    const box = new T.Box3();
    for (let i = start; i < start + 24; i++)
      box.expandByPoint(new T.Vector3().fromBufferAttribute(p, i));
    if (
      Math.abs(box.min.y - 7.6964) > 0.025 ||
      Math.abs(box.max.y - 8.7982) > 0.025 ||
      box.max.x - box.min.x > 0.12 ||
      box.max.z - box.min.z > 0.12
    )
      return null;
    const center = box.getCenter(new T.Vector3());
    center.y = 7.8;
    posts.push(center);
  }
  const pieces: T.BufferGeometry[] = [],
    up = new T.Vector3(0, 1, 0);
  const bar = (a: T.Vector3, b: T.Vector3, width: number, depth = width) => {
    const delta = b.clone().sub(a),
      shape = new T.BoxGeometry(width, delta.length(), depth);
    shape.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(up, delta.normalize()),
    );
    shape.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    pieces.push(shape);
  };
  const axis = posts.at(-1)!.clone().sub(posts[0]).normalize(),
    inside = new T.Vector3(-axis.z, 0, axis.x);
  const at = (p: T.Vector3, y: number, inset = 0) =>
    p.clone().addScaledVector(inside, inset).setY(y);
  // Replace only the oversized source top bar with a 100 mm diameter rail.
  const rail = new T.CylinderGeometry(
    0.05,
    0.05,
    posts[0].distanceTo(posts.at(-1)!),
    12,
  );
  rail.applyQuaternion(new T.Quaternion().setFromUnitVectors(up, axis));
  const mid = posts[0].clone().add(posts.at(-1)!).multiplyScalar(0.5);
  rail.translate(mid.x, 8.802, mid.z);
  pieces.push(rail);
  for (const post of posts) {
    bar(at(post, 7.8), at(post, 7.85), 0.22, 0.22);
    bar(at(post, 7.85), at(post, 8.8), 0.12, 0.12);
  }
  for (let i = 1; i < posts.length; i++) {
    const a = posts[i - 1].clone().addScaledVector(axis, 0.085),
      b = posts[i].clone().addScaledVector(axis, -0.085);
    bar(at(a, 7.94), at(b, 7.94), 0.1, 0.055);
    bar(at(a, 8.12), at(b, 8.12), 0.04, 0.04);
    bar(at(a, 8.61), at(b, 8.61), 0.04, 0.04);
    // Recessed wire panel, fine enough to remain visibly open against water.
    const length = a.distanceTo(b),
      n = Math.ceil(length / 0.16);
    for (let j = 1; j < n; j++) {
      const p = a.clone().lerp(b, j / n);
      bar(at(p, 8.14, 0.018), at(p, 8.59, 0.018), 0.006, 0.006);
    }
    for (let j = 1; j < 6; j++) {
      const y = 8.12 + j * (0.49 / 6);
      bar(at(a, y, 0.018), at(b, y, 0.018), 0.006, 0.006);
    }
  }
  const result = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  if (!result) return null;
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.sourcePostCenters = posts.map((p) => p.toArray());
  result.userData.noWireShadows = true;
  const ix = g.getIndex()!,
    kept: number[] = [];
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (ids.every((id) => id < 24)) continue;
    kept.push(...ids);
  }
  g.setIndex(kept);
  g.userData.westRailRefined = true;
  return result;
}
