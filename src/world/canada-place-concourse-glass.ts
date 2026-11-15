import * as T from "three";

/** Opaque-backed dielectric approximation for the upper concourse only.
 * The closed shell has no modelled interior: transmission would expose missing
 * geometry. The existing harbour probe supplies all reflected image content.
 */
export function createCanadaPlaceConcourseGlass() {
  return new T.MeshPhysicalMaterial({
    name: "canada-west-glass",
    color: 0x52766d,
    metalness: 0,
    roughness: 0.21,
    ior: 1.5,
    specularIntensity: 1,
    specularColor: 0xffffff,
    clearcoat: 0,
    transmission: 0,
    envMapIntensity: 0.8,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: T.FrontSide,
  });
}
