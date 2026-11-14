import * as T from "three";
import type { TreeInstance } from "./detailed-trees";
export const STREET_TREE_REVISION = "source-leaves-20261114";
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
export function selectStreetTrees(
  samples: TreeInstance[],
  x: number,
  z: number,
  y: number,
  budget: number,
  previousNear: ReadonlySet<TreeInstance>,
  frustum?: T.Frustum,
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
    near: p.distance < (previousNear.has(p.tree) ? 34 : 27) && nearBudget-- > 0,
  }));
}
