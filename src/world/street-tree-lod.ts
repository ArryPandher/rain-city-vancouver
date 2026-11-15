import * as T from "three";
import type { TreeInstance } from "./detailed-trees";
export const STREET_TREE_REVISION = "masked-leaves-20261114";
/** Distance to the vertical canopy extent, including elevated photo cameras. */
export function streetTreeDistance(
  t: TreeInstance,
  x: number,
  z: number,
  y: number,
) {
  const bottom = (t.y ?? 0) + t.height * 0.3,
    top = (t.y ?? 0) + t.height;
  return Math.hypot(t.x - x, t.z - z, Math.max(bottom - y, 0, y - top));
}
/** Fraction of vertical view occupied by the source crown (upper70% of tree).
 * This governs leaf curvature detail, not whether the tree itself is present. */
export function projectedCrownHeight(
  tree: TreeInstance,
  distance: number,
  projectionScale: number,
) {
  return (tree.height * 0.7 * projectionScale) / (2 * Math.max(0.1, distance));
}
export function nearStreetTree(
  tree: TreeInstance,
  distance: number,
  previous: boolean,
  projectionScale?: number,
) {
  if (distance >= (previous ? 34 : 27)) return false;
  if (projectionScale === undefined) return true;
  // Preserve full3D leaf curvature at arm's-length/close walking distances.
  // Large crowns still retain it farther away; smaller crowns use all-patch
  // source-derived leaf cards with unchanged original woody geometry.
  return (
    distance < (previous ? 12 : 10) ||
    projectedCrownHeight(tree, distance, projectionScale) >
      (previous ? 0.38 : 0.45)
  );
}
export function selectStreetTrees(
  samples: TreeInstance[],
  x: number,
  z: number,
  y: number,
  budget: number,
  previousNear: ReadonlySet<TreeInstance>,
  frustum?: T.Frustum,
  projectionScale?: number,
) {
  const sphere = new T.Sphere();
  const candidates = samples
    .map((tree) => ({
      tree,
      distance: streetTreeDistance(tree, x, z, y),
      visible:
        !frustum ||
        frustum.intersectsSphere(
          sphere.set(
            new T.Vector3(tree.x, (tree.y ?? 0) + tree.height * 0.55, tree.z),
            Math.max(tree.height * 0.55, tree.width * 0.8),
          ),
        ),
    }))
    .filter((p) => p.distance < 140)
    .sort(
      (a, b) =>
        Number(b.visible) - Number(a.visible) || a.distance - b.distance,
    )
    .slice(0, Math.max(0, Math.min(96, budget)));
  let nearBudget = Math.ceil(budget / 3);
  return candidates.map((p) => ({
    ...p,
    near:
      nearStreetTree(
        p.tree,
        p.distance,
        previousNear.has(p.tree),
        projectionScale,
      ) && nearBudget-- > 0,
  }));
}
