import * as T from "three";
import { addGalleryBistroPlatform } from "./gallery-bistro";
import { galleryStairBackV } from "./gallery-entry-stairs-data";
import type { ArchitecturalMesh } from "./architectural-mesh";
import {
  GALLERY_STAIR_FRAMING as D,
  galleryStairRails,
} from "./gallery-stair-framing-data";

/** Uses existing gallery stone/frame batches in its source-local coordinate
 * system. Every wall, top, return and rail cylinder is physically closed. */
export function addGalleryStairFraming(
  mesh: ArchitecturalMesh,
  stone: T.Material,
  rail: T.Material,
) {
  addGalleryBistroPlatform(mesh, stone);
  for (const t of D.terraces.slice(0, 1)) {
    const midU = (t.minU + t.maxU) / 2,
      midV = (D.minV + D.maxV) / 2;
    // Broad cast-stone side wall and restrained projecting coping. Neither
    // intrudes into the retained tread width or below the common ground datum.
    mesh.box(
      [midU, (D.top - 0.12 + D.bottom) / 2, midV],
      t.maxU - t.minU - 0.06,
      D.top - 0.12 - D.bottom,
      D.maxV - D.minV - 0.03,
      stone,
    );
    const cap = new T.BoxGeometry(t.maxU - t.minU, 0.12, D.maxV - D.minV);
    cap.translate(midU, D.top - 0.06, midV);
    const p = cap.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      if (Math.abs(p.getZ(i) - D.minV) < 1e-5)
        p.setZ(i, galleryStairBackV(p.getX(i)));
    cap.computeVertexNormals();
    mesh.add(cap, stone);
  }
  for (const { a, b } of galleryStairRails())
    mesh.beam(a, b, D.railRadius, rail, 8);
}
