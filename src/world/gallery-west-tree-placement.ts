import { galleryStairLocal } from "./gallery-stair-framing-data";
import {
  GALLERY_WEST_TERRACE as D,
  galleryWestAssemblyPoint,
} from "./gallery-west-terrace-data";
import type { TreeProfile } from "./tree-profile";

/** Exclude ground-rooted mapped stems intersecting the new overhead terrace.
 * This is a placement ownership mask, not a pedestrian collision volume. Apply
 * before fallback instancing and detailed-tree samples are populated. Existing
 * mapped tree coordinates remain unchanged; adjacent crowns are not masked. */
export function galleryWestTreeExcluded(
  tree: Pick<TreeProfile, "x" | "z" | "diameter">,
) {
  const [u, v] = galleryWestAssemblyPoint(...galleryStairLocal(tree.x, tree.z));
  // Matches the fallback CylinderGeometry(.35,.55,1) scaled by source DBH.
  const radius = Math.max(0, tree.diameter) * 0.55;
  const du = Math.max(D.minU - u, 0, u - D.maxU),
    dv = Math.max(D.rearV - v, 0, v - D.frontV);
  return Math.hypot(du, dv) <= radius;
}
