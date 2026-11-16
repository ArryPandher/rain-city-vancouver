import * as T from "three";
import type { Materials } from "./materials";
import {
  createCanadaPlaceHotelGlazingPair,
  createCanadaPlaceHotelGlazingMesh,
} from "./canada-place-hotel-glass";

/** Authored daylight estimates from Handford20/16/18, not measured optics.
 * Photo-supported facade zones, thin frames, cavity depth and terrace breaks
 * belong to geometry; these materials contain no painted facade grid. */
export const PAN_PACIFIC_TOWER_FINISH = {
  mineralRepeatMetres: 2,
  concrete: 0xd7d3c7,
  frame: 0xb9bbaa,
  backing: 0x253339,
  roof: 0x414947,
  normalStrength: 0.08,
  glassThroughput: [0.55, 0.74, 0.8] as const,
  glassIor: 1.5,
  glassRoughness: 0.12,
  probeIntensity: 0.85,
} as const;

/** Independent tower materials, leaving podium/west calibration unchanged.
 * Four shared opaque roles and a shared two-draw dielectric glass pair.
 * Geometry supplies metre UVs and closed opaque cavities behind every pane.
 * Probe assignment belongs to the coordinator; no capture/light is created.
 */
export function createPanPacificTowerMaterials(
  library: Pick<Materials, "texture">,
) {
  const q = PAN_PACIFIC_TOWER_FINISH;
  const mineral = (kind: string, color: boolean) => {
    const map = library
      .texture(`canada-place-plinth/${kind}.webp`, color)
      .clone();
    map.name = `Pan Pacific tower mineral ${kind}`;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(1 / q.mineralRepeatMetres);
    map.updateMatrix();
    return map;
  };
  const concrete = new T.MeshStandardMaterial({
    name: "pan-pacific-tower-concrete",
    color: q.concrete,
    map: mineral("color", true),
    normalMap: mineral("normal", false),
    roughnessMap: mineral("roughness", false),
    normalScale: new T.Vector2(q.normalStrength, q.normalStrength),
    roughness: 1,
    metalness: 0,
  });
  const frame = new T.MeshStandardMaterial({
    name: "pan-pacific-tower-frame",
    color: q.frame,
    roughness: 0.34,
    metalness: 0.28,
    envMapIntensity: 0.8,
  });
  const backing = new T.MeshStandardMaterial({
    name: "pan-pacific-tower-backing",
    color: q.backing,
    roughness: 0.93,
    metalness: 0,
  });
  const roof = new T.MeshStandardMaterial({
    name: "pan-pacific-tower-roof",
    color: q.roof,
    roughness: 0.86,
    metalness: 0,
  });
  const glassPair = createCanadaPlaceHotelGlazingPair();
  glassPair.attenuation.name = "pan-pacific-tower-glass-attenuation";
  glassPair.attenuation.uniforms.sheetThroughput.value.set(
    ...q.glassThroughput,
  );
  glassPair.attenuation.uniforms.sheetIor.value = q.glassIor;
  glassPair.reflection.name = "pan-pacific-tower-glass";
  glassPair.reflection.ior = q.glassIor;
  glassPair.reflection.roughness = q.glassRoughness;
  glassPair.reflection.envMapIntensity = q.probeIntensity;
  return { concrete, frame, backing, roof, glassPair };
}

export type PanPacificTowerMaterials = ReturnType<
  typeof createPanPacificTowerMaterials
>;

/** Share materials across coherent face meshes, not per pane. Each indexed
 * face buffer becomes two ordered groups on one mesh; this keeps extinction
 * and reflection adjacent through existing transparent sorting/batching.
 * Input geometry remains caller-owned. Outward normals and closed backing
 * are required; do not add a second coincident glass layer at corner joins.
 */
export function createPanPacificTowerGlazingMesh(
  geometry: T.BufferGeometry,
  pair: PanPacificTowerMaterials["glassPair"],
) {
  const mesh = createCanadaPlaceHotelGlazingMesh(geometry, pair);
  mesh.name = "pan-pacific-tower-glass";
  return mesh;
}
