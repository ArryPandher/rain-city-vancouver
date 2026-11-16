import * as T from "three";
import type { ArchitecturalMesh } from "./architectural-mesh";
import {
  GALLERY_REAR_STEPS as S,
  GALLERY_STAIR_SURFACES,
  GALLERY_STAIR_CAP_EDGE,
  galleryStairBackV,
} from "./gallery-entry-stairs-data";

/** One closed staircase shell, no buried boxes or coplanar landing overlays. */
export function addGalleryEntryStairs(
  mesh: ArchitecturalMesh,
  material: T.Material,
) {
  const profile: [number, number][] = [
    [S.startV, -S.datum],
    [S.startV, S.top],
  ];
  for (const [i, s] of GALLERY_STAIR_SURFACES.entries()) {
    profile.push([s.maxV, s.y]);
    const next = GALLERY_STAIR_SURFACES[i + 1]?.y ?? -S.datum;
    if (Math.abs(s.y - next) > 1e-9) profile.push([s.maxV, next]);
  }
  // Extrude a stair-shaped v/y section along u. THREE triangulates the
  // concave side cheeks and emits capped ends with consistent outward faces.
  const shape = new T.Shape(profile.map(([v, y]) => new T.Vector2(v, y)));
  const seam = GALLERY_STAIR_CAP_EDGE[1][0];
  for (const [minU, maxU] of [
    [S.minU, seam],
    [seam, S.maxU],
  ]) {
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: maxU - minU,
      bevelEnabled: false,
      steps: 1,
    });
    // (profile v, profile y, extrusion u) -> source-local(u,y,v), reflection
    // followed by explicit triangle reversal to retain outward winding.
    const p = geometry.getAttribute("position"),
      n = geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      let v = p.getX(i);
      const u = minU + p.getZ(i);
      if (Math.abs(v - S.startV) < 1e-5) v = galleryStairBackV(u);
      p.setXYZ(i, u, p.getY(i), v);
      const nx = n.getX(i),
        nz = n.getZ(i);
      n.setXYZ(i, nz, n.getY(i), nx);
    }
    const attributes = Object.values(geometry.attributes);
    for (let i = 0; i < p.count; i += 3)
      for (const a of attributes)
        for (let k = 0; k < a.itemSize; k++) {
          const j = (i + 1) * a.itemSize + k,
            l = (i + 2) * a.itemSize + k;
          const x = a.array[j];
          a.array[j] = a.array[l];
          a.array[l] = x;
        }
    const kept: number[] = [];
    for (let i = 0; i < p.count; i += 3)
      if (![i, i + 1, i + 2].every((j) => Math.abs(p.getX(j) - seam) < 1e-5))
        kept.push(i, i + 1, i + 2);
    geometry.setIndex(kept);
    geometry.clearGroups();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.add(geometry, material);
  }
}

/** Only the authored original stair solid: foundation vertices3819..4062.
 * Call alongside the existing source-count-guarded gallery replacement. */
export function removeOriginalGalleryStairs(g: T.BufferGeometry, name: string) {
  if (name !== "foundation" || g.getAttribute("position").count !== 4063)
    return 0;
  const ix = g.index;
  if (!ix) return 0;
  const kept: number[] = [];
  let removed = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (ids.every((id) => id >= 3819 && id <= 4062)) removed++;
    else kept.push(...ids);
  }
  if (removed) g.setIndex(kept);
  return removed;
}
