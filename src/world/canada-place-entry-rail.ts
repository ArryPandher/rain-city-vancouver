import * as T from "three";
import source from "./canada-place-entry-rail-data.json";
import { CANADA_PLACE_ORIGIN } from "./canada-place-deck";

/** Open only the public entrance where the authored approach backs the pier.
 * Input is baked source-local geometry. Vertex IDs are pinned to the committed
 * GLB; unrelated rails/masts are untouched. Safe before/after mast replacement. */
export function openCanadaPlaceEntryRail(g: T.BufferGeometry) {
  const p = g.getAttribute("position"),
    ix = g.getIndex(),
    normal = g.getAttribute("normal");
  if (
    p.count !== source.positionCount ||
    !ix ||
    !normal ||
    ![source.indexCount, source.indexCount - 360].includes(ix.count)
  )
    return false;
  for (const part of source.components) {
    for (let k = 0; k < 3; k++) {
      let min = Infinity,
        max = -Infinity;
      for (let i = part.range[0]; i <= part.range[1]; i++) {
        const v = k === 0 ? p.getX(i) : k === 1 ? p.getY(i) : p.getZ(i);
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      if (
        Math.abs(min - part.min[k]) > 0.025 ||
        Math.abs(max - part.max[k]) > 0.025
      )
        return false;
    }
  }
  const cut = source.cutWorldX - CANADA_PLACE_ORIGIN[0];
  const rail = source.components[0].range;
  // Slide only the four duplicated endpoint corners along the original bar axis.
  // Existing end-cap triangles close the new cut plane, avoiding an uncapped tube.
  for (let i = rail[0]; i <= rail[1]; i++)
    if (p.getX(i) > cut) {
      const shift = p.getX(i) - cut;
      p.setXYZ(i, cut, p.getY(i), p.getZ(i) - shift * source.railSlope);
    }
  const kept: number[] = [];
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (
      source.components
        .slice(1)
        .some((c) => ids.every((id) => id >= c.range[0] && id <= c.range[1]))
    )
      continue;
    kept.push(...ids);
  }
  g.setIndex(kept);
  p.needsUpdate = true;
  // Only the trimmed rail's normals change. Preserve unrelated encoded normals.
  const copy = g.clone();
  copy.computeVertexNormals();
  const n = copy.getAttribute("normal");
  for (let i = rail[0]; i <= rail[1]; i++)
    normal.setXYZ(i, n.getX(i), n.getY(i), n.getZ(i));
  normal.needsUpdate = true;
  copy.dispose();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return true;
}
