import * as T from "three";
import type { Materials } from "./materials";
import { createPanPacificNearPodiumGeometry } from "./pan-pacific-near-podium";
import {
  createPanPacificNearPodiumMaterials,
  createPanPacificNearPodiumGlazingMesh,
} from "./pan-pacific-near-podium-materials";

export function createPanPacificNearPodium(
  library: Pick<Materials, "texture">,
) {
  const geometry = createPanPacificNearPodiumGeometry();
  const materials = createPanPacificNearPodiumMaterials(library);
  const group = new T.Group();
  group.name = "Pan Pacific near arrival frontage";
  group.userData.sourceNearPodium = geometry.stats;
  for (const role of ["concrete", "frame", "backing", "soffit"] as const) {
    const mesh = new T.Mesh(geometry[role], materials[role]);
    mesh.name = `pan-pacific-near-podium-${role}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glass = createPanPacificNearPodiumGlazingMesh(
    geometry.glass,
    materials.glassPair,
  );
  geometry.glass.dispose();
  group.add(glass);
  return { group, glass: materials.glassPair.reflection };
}
