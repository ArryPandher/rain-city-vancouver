import * as T from "three";
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
  for (const t of D.terraces) {
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
    mesh.box(
      [midU, D.top - 0.06, midV],
      t.maxU - t.minU,
      0.12,
      D.maxV - D.minV,
      stone,
    );
  }
  for (const { a, b } of galleryStairRails())
    mesh.beam(a, b, D.railRadius, rail, 8);
}
