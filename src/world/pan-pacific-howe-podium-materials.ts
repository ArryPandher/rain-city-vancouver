import * as T from "three";
import type { Materials } from "./materials";
import {
  createCanadaPlaceHotelGlazingPair,
  createCanadaPlaceHotelGlazingMesh,
} from "./canada-place-hotel-glass";

/** Handford20 is a visual reference, not an albedo/optical measurement.
 * Geometry supplies metre UVs, real slab/column depth and closed window
 * cavities. This factory is only for the Howe-facing podium replacement. */
export const PAN_PACIFIC_HOWE_PODIUM_FINISH = {
  mineralRepeatMetres: 2,
  concrete: 0xd7d3c7,
  soffit: 0xbab9b0,
  frame: 0xc6c8bf,
  backing: 0x303b3b,
  normalStrength: 0.1,
  glassThroughput: [0.6, 0.8, 0.82] as const,
  glassRoughness: 0.14,
  glassIor: 1.5,
  probeIntensity: 0.8,
} as const;

/** Four opaque material batches plus one ordered two-draw glazing batch.
 * Reuses the committed CC0 concrete crop and existing hotel optical stack;
 * no capture, light, room texture, emission, or facade-wide pane pattern.
 * The caller assigns the southeast local environment to glassPair.reflection.
 */
export function createPanPacificHowePodiumMaterials(
  library: Pick<Materials, "texture">,
) {
  const q = PAN_PACIFIC_HOWE_PODIUM_FINISH;
  const mineral = (kind: string, color: boolean) => {
    // Independent sampler wrappers protect other landmarks' texture state.
    const map = library
      .texture(`canada-place-plinth/${kind}.webp`, color)
      .clone();
    map.name = `Pan Pacific Howe podium mineral ${kind}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.repeat.setScalar(1 / q.mineralRepeatMetres);
    map.updateMatrix();
    return map;
  };
  const map = mineral("color", true),
    normalMap = mineral("normal", false),
    roughnessMap = mineral("roughness", false);
  const concrete = new T.MeshStandardMaterial({
    name: "pan-pacific-howe-podium-concrete",
    color: q.concrete,
    map,
    normalMap,
    roughnessMap,
    normalScale: new T.Vector2(q.normalStrength, q.normalStrength),
    // Prepared map is bounded around .74–.86; retain its effective roughness.
    roughness: 1,
    metalness: 0,
  });
  // Same mineral under the overhang: the geometry's occlusion and directional
  // light provide the shadow. This is not an unlit black underside stripe.
  const soffit = concrete.clone();
  soffit.name = "pan-pacific-howe-podium-soffit";
  soffit.color.setHex(q.soffit);
  const frame = new T.MeshStandardMaterial({
    name: "pan-pacific-howe-podium-frame",
    color: q.frame,
    roughness: 0.38,
    metalness: 0.22,
    envMapIntensity: 0.8,
  });
  const backing = new T.MeshStandardMaterial({
    name: "pan-pacific-howe-podium-backing",
    color: q.backing,
    roughness: 0.9,
    metalness: 0,
  });
  const glassPair = createCanadaPlaceHotelGlazingPair();
  glassPair.attenuation.name = "pan-pacific-howe-podium-glass-attenuation";
  glassPair.attenuation.uniforms.sheetThroughput.value.set(
    ...q.glassThroughput,
  );
  glassPair.attenuation.uniforms.sheetIor.value = q.glassIor;
  glassPair.reflection.name = "pan-pacific-howe-podium-glass";
  glassPair.reflection.roughness = q.glassRoughness;
  glassPair.reflection.ior = q.glassIor;
  glassPair.reflection.envMapIntensity = q.probeIntensity;
  return { concrete, frame, backing, soffit, glassPair };
}

export type PanPacificHowePodiumMaterials = ReturnType<
  typeof createPanPacificHowePodiumMaterials
>;

/** Indexed panes share one physical layer and one optical pair. Keep both
 * groups on this mesh through batching. This clones geometry, so the caller
 * retains/disposes its input. All panes need outward normals and opaque
 * closed backing at their actual recessed depth, including the end returns.
 */
export function createPanPacificHowePodiumGlazingMesh(
  geometry: T.BufferGeometry,
  pair: PanPacificHowePodiumMaterials["glassPair"],
) {
  const mesh = createCanadaPlaceHotelGlazingMesh(geometry, pair);
  mesh.name = "pan-pacific-howe-podium-glass";
  return mesh;
}
