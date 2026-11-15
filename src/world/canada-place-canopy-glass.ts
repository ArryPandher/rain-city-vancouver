import * as T from "three";
import {
  createCanadaPlaceConcourseExtinctionPair,
  createCanadaPlaceConcourseExtinctionMesh,
} from "./canada-place-concourse-glass";

/** Independent canopy calibration, not measured optical data. Rabich's June
 * 2022 southern-end photograph shows green transmitted structure and pale
 * framing, not opaque blue cladding. Start with the accepted hall's daylight
 * response; subsequent canopy calibration must not change hall materials.
 * Reference: cached rabich-west-2022.jpg (Dietmar Rabich, CC BY-SA 4.0).
 */
export const CANADA_PLACE_CANOPY_OPTICS = {
  linearThroughput: [0.45, 0.85, 0.65] as const,
  roughness: 0.12,
  ior: 1.5,
  probeIntensity: 0.8,
} as const;

/** Ordered raw RGB extinction + dielectric reflection, using the existing
 * linear HDR pipeline. No capture, refraction or emission. Closed architectural
 * backing is required. Preserve both groups through static-world integration.
 */
export function createCanadaPlaceCanopyGlazingPair() {
  const pair = createCanadaPlaceConcourseExtinctionPair();
  pair.attenuation.name = "canada-canopy-glass-attenuation";
  pair.attenuation.uniforms.sheetThroughput.value = new T.Vector3(
    ...CANADA_PLACE_CANOPY_OPTICS.linearThroughput,
  );
  pair.attenuation.uniforms.sheetIor.value = CANADA_PLACE_CANOPY_OPTICS.ior;
  pair.reflection.name = "canada-canopy-glass";
  pair.reflection.roughness = CANADA_PLACE_CANOPY_OPTICS.roughness;
  pair.reflection.ior = CANADA_PLACE_CANOPY_OPTICS.ior;
  pair.reflection.envMapIntensity = CANADA_PLACE_CANOPY_OPTICS.probeIntensity;
  // The conservatory is visible through its end panes. Rays leaving that
  // volume cross the inside of the curved sheet as well; culling it removes a
  // real optical layer and leaves unfiltered sky between the structural ribs.
  // Render each thin sheet once, from either side. Three's default transparent
  // DoubleSide path draws twice, so forceSinglePass is essential for both the
  // multiply and additive portions of this pair.
  for (const material of [pair.attenuation, pair.reflection]) {
    material.side = T.DoubleSide;
    material.forceSinglePass = true;
  }
  pair.attenuation.fragmentShader = pair.attenuation.fragmentShader.replace(
    "clamp(dot(normalize(sheetNormal),normalize(sheetView)),0.0,1.0)",
    "clamp(abs(dot(normalize(sheetNormal),normalize(sheetView))),0.0,1.0)",
  );
  return pair;
}

/** Clones geometry; caller retains/disposes the input. A pair may be shared
 * across coherent canopy sections. Same-object group sorting preserves the
 * multiply/add pair; different section depths still require native overlap QA.
 * Use one surface per physical sheet, including the ends. Two-sided materials
 * use forceSinglePass; do not duplicate reverse-wound faces. Both disable fog (near-building
 * approximation) and preserve framebuffer alpha. No global renderOrder hack.
 */
export function createCanadaPlaceCanopyGlazingMesh(
  geometry: T.BufferGeometry,
  pair: ReturnType<typeof createCanadaPlaceCanopyGlazingPair>,
) {
  const mesh = createCanadaPlaceConcourseExtinctionMesh(geometry, pair);
  mesh.name = "canada-canopy-glass";
  return mesh;
}
