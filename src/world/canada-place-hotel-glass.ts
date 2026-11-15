import * as T from "three";
import {
  createCanadaPlaceConcourseExtinctionPair,
  createCanadaPlaceConcourseExtinctionMesh,
} from "./canada-place-concourse-glass";

/** Independent hotel calibration, not measured optical data. Rabich's June
 * 2022 upper-window photograph shows green/blue rectangular glazing and pale
 * framing, not opaque blue cladding. Start with the accepted hall's daylight
 * response; subsequent hotel calibration must not change hall or canopy materials.
 * Reference: cached rabich-west-2022.jpg (Dietmar Rabich, CC BY-SA 4.0).
 */
export const CANADA_PLACE_HOTEL_OPTICS = {
  linearThroughput: [0.72, 0.88, 0.82] as const,
  roughness: 0.12,
  ior: 1.5,
  probeIntensity: 0.8,
} as const;

/** Ordered raw RGB extinction + dielectric reflection, using the existing
 * linear HDR pipeline. No capture, refraction or emission. Closed architectural
 * backing is required. Preserve both groups through static-world integration.
 */
export function createCanadaPlaceHotelGlazingPair() {
  const pair = createCanadaPlaceConcourseExtinctionPair();
  pair.attenuation.name = "canada-hotel-glass-attenuation";
  pair.attenuation.uniforms.sheetThroughput.value = new T.Vector3(
    ...CANADA_PLACE_HOTEL_OPTICS.linearThroughput,
  );
  pair.attenuation.uniforms.sheetIor.value = CANADA_PLACE_HOTEL_OPTICS.ior;
  pair.reflection.name = "canada-hotel-glass";
  pair.reflection.roughness = CANADA_PLACE_HOTEL_OPTICS.roughness;
  pair.reflection.ior = CANADA_PLACE_HOTEL_OPTICS.ior;
  pair.reflection.envMapIntensity = CANADA_PLACE_HOTEL_OPTICS.probeIntensity;
  return pair;
}

/** Clones geometry; caller retains/disposes the input. A pair may be shared
 * across coherent hotel panes. Same-object group sorting preserves the
 * multiply/add pair; different section depths still require native overlap QA.
 * Use separate outward-facing end geometry where needed, not DoubleSide
 * duplicate optical layers. Both materials disable fog (near-building
 * approximation) and preserve framebuffer alpha. No global renderOrder hack.
 */
export function createCanadaPlaceHotelGlazingMesh(
  geometry: T.BufferGeometry,
  pair: ReturnType<typeof createCanadaPlaceHotelGlazingPair>,
) {
  const mesh = createCanadaPlaceConcourseExtinctionMesh(geometry, pair);
  mesh.name = "canada-hotel-glass";
  return mesh;
}
