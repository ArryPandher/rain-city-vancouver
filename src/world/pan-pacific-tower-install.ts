import * as T from "three";
import type { Materials } from "./materials";
import { createPanPacificTowerGeometry } from "./pan-pacific-tower";
import {
  createPanPacificTowerMaterials,
  createPanPacificTowerGlazingMesh,
} from "./pan-pacific-tower-materials";

/** Install only alongside the atomic removal of all original tower surfaces. */
export function createPanPacificTower(library: Pick<Materials, "texture">) {
  const geometry = createPanPacificTowerGeometry();
  const materials = createPanPacificTowerMaterials(library);
  const group = new T.Group();
  group.name = "Pan Pacific registered hotel tower";
  group.userData.sourceTower = geometry.stats;
  for (const role of ["concrete", "frame", "backing", "roof"] as const) {
    const mesh = new T.Mesh(geometry[role], materials[role]);
    mesh.name = `pan-pacific-tower-${role}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glass = createPanPacificTowerGlazingMesh(
    geometry.glass,
    materials.glassPair,
  );
  geometry.glass.dispose();
  group.add(glass);
  return { group, glass: materials.glassPair.reflection };
}
