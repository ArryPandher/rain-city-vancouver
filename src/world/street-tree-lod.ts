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
 * This selects individual patches versus the retained source-depth canopy. */
export function projectedCrownHeight(
  tree: TreeInstance,
  distance: number,
  projectionScale: number,
) {
  return (tree.height * 0.7 * projectionScale) / (2 * Math.max(0.1, distance));
}
const ORDINARY_PROJECTION_SCALE = 1 / Math.tan((62 * Math.PI) / 360);
export function nearStreetTree(
  _tree: TreeInstance,
  distance: number,
  previous: boolean,
  projectionScale?: number,
) {
  // Resolve individual leaf curvature only close to the camera. A large crown
  // alone must not promote hundreds of thousands of curved leaf triangles.
  // Narrow FOV extends the range by magnification; wide/unknown FOV preserves
  // the same arm's-length detail. Extreme zoom retains the existing hard caps.
  const zoom =
    projectionScale !== undefined &&
    Number.isFinite(projectionScale) &&
    projectionScale > 0
      ? Math.max(1, projectionScale / ORDINARY_PROJECTION_SCALE)
      : 1;
  return distance < Math.min(previous ? 34 : 27, (previous ? 6 : 4) * zoom);
}
/** Use the existing source-depth canopy when individual leaf cards are no
 * longer resolvable. The tree, calibrated trunk and source silhouette remain;
 * this only controls the costly all-leaf detail slots. */
export function individualStreetLeaves(
  tree: TreeInstance,
  distance: number,
  previous: boolean,
  projectionScale?: number,
) {
  if (projectionScale === undefined) return true;
  return (
    distance < (previous ? 34 : 30) ||
    projectedCrownHeight(tree, distance, projectionScale) >
      (previous ? 0.1 : 0.12)
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
  previousDetailed: ReadonlySet<TreeInstance> = previousNear,
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
    .filter(
      (p) =>
        p.distance < 140 &&
        individualStreetLeaves(
          p.tree,
          p.distance,
          previousDetailed.has(p.tree),
          projectionScale,
        ),
    )
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
