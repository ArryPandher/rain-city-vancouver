import * as T from "three";
import type { Materials } from "./materials";
import {
  createPanPacificHowePodiumGeometry,
  panPacificHowePodiumPoint,
} from "./pan-pacific-howe-podium";
import {
  createPanPacificHowePodiumMaterials,
  createPanPacificHowePodiumGlazingMesh,
} from "./pan-pacific-howe-podium-materials";

/** Called only after the complete original source passes its scene preflight.
 * Keep the optical pair on one mesh; each opaque role is a merged draw batch. */
export function createPanPacificHowePodium(
  library: Pick<Materials, "texture">,
) {
  const geometry = createPanPacificHowePodiumGeometry();
  const materials = createPanPacificHowePodiumMaterials(library);
  const group = new T.Group();
  group.name = "Pan Pacific Howe podium";
  group.userData.sourcePodium = geometry.stats;
  for (const role of ["concrete", "frame", "backing", "soffit"] as const) {
    const mesh = new T.Mesh(geometry[role], materials[role]);
    mesh.name = `pan-pacific-howe-podium-${role}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glass = createPanPacificHowePodiumGlazingMesh(
    geometry.glass,
    materials.glassPair,
  );
  geometry.glass.dispose();
  group.add(glass);
  // This facade sees Howe/Granville; the west conservatory capture lies behind
  // the hotel. Use one bounded southeast capture for the coherent elevation.
  const capture = panPacificHowePodiumPoint(0.5, 17.2, 3.2);
  return { group, glass: materials.glassPair.reflection, capture };
}
