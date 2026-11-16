import * as T from "three";
import type { Materials } from "./materials";
import { addNearPodiumPanelJoints } from "./pan-pacific-near-podium-joints";
import {
  createCanadaPlaceHotelGlazingPair,
  createCanadaPlaceHotelGlazingMesh,
} from "./canada-place-hotel-glass";

/** Handford20 lower spine/arrival frontage: pale mineral surrounds, fine
 * warm metal frames and dark reflective glazing. Values are authored, not
 * measured material specifications. Geometry supplies the apertures/depth. */
export const PAN_PACIFIC_NEAR_PODIUM_FINISH = {
  mineralRepeatMetres: 2,
  concrete: 0xd7d3c7,
  soffit: 0xbab9b0,
  frame: 0xbab7a4,
  backing: 0x253339,
  normalStrength: 0.08,
  glassThroughput: [0.55, 0.74, 0.8] as const,
  // Effective sheet Fresnel: about 8.16% normal reflection approximates
  // multiple glazing interfaces. This is not a measured bulk glass IOR.
  glassIor: 1.8,
  glassRoughness: 0.12,
  probeIntensity: 0.85,
} as const;

/** Four opaque batches plus one ordered two-draw glass batch. Samplers and
 * optics are independent of the accepted tower and Howe long podium. The
 * factory creates no captures/lights and uses no photographic facade grids.
 */
export function createPanPacificNearPodiumMaterials(
  library: Pick<Materials, "texture">,
) {
  const q = PAN_PACIFIC_NEAR_PODIUM_FINISH;
  const mineral = (kind: string, color: boolean) => {
    const map = library
      .texture(`canada-place-plinth/${kind}.webp`, color)
      .clone();
    map.name = `Pan Pacific near podium mineral ${kind}`;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(1 / q.mineralRepeatMetres);
    map.updateMatrix();
    return map;
  };
  const concrete = new T.MeshStandardMaterial({
    name: "pan-pacific-near-podium-concrete",
    color: q.concrete,
    map: mineral("color", true),
    normalMap: mineral("normal", false),
    roughnessMap: mineral("roughness", false),
    normalScale: new T.Vector2(q.normalStrength, q.normalStrength),
    roughness: 1,
    metalness: 0,
  });
  const soffit = concrete.clone();
  soffit.name = "pan-pacific-near-podium-soffit";
  soffit.color.setHex(q.soffit);
  addNearPodiumPanelJoints(concrete);
  const frame = new T.MeshStandardMaterial({
    name: "pan-pacific-near-podium-frame",
    color: q.frame,
    roughness: 0.35,
    metalness: 0.3,
    envMapIntensity: 0.8,
  });
  const backing = new T.MeshStandardMaterial({
    name: "pan-pacific-near-podium-backing",
    color: q.backing,
    roughness: 0.93,
    metalness: 0,
  });
  const glassPair = createCanadaPlaceHotelGlazingPair();
  glassPair.attenuation.name = "pan-pacific-near-podium-glass-attenuation";
  glassPair.attenuation.uniforms.sheetThroughput.value.set(
    ...q.glassThroughput,
  );
  glassPair.attenuation.uniforms.sheetIor.value = q.glassIor;
  glassPair.reflection.name = "pan-pacific-near-podium-glass";
  glassPair.reflection.ior = q.glassIor;
  glassPair.reflection.roughness = q.glassRoughness;
  glassPair.reflection.envMapIntensity = q.probeIntensity;
  return { concrete, frame, backing, soffit, glassPair };
}

export type PanPacificNearPodiumMaterials = ReturnType<
  typeof createPanPacificNearPodiumMaterials
>;

/** Input is caller-owned and cloned. Merge coherent indexed panes before
 * wrapping, then preserve the two ordered groups through static integration.
 * Closed opaque backing and outward normals are mandatory at every return.
 */
export function createPanPacificNearPodiumGlazingMesh(
  geometry: T.BufferGeometry,
  pair: PanPacificNearPodiumMaterials["glassPair"],
) {
  const mesh = createCanadaPlaceHotelGlazingMesh(geometry, pair);
  mesh.name = "pan-pacific-near-podium-glass";
  return mesh;
}
