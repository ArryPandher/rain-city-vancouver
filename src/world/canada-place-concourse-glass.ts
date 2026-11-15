import * as T from "three";

/** Thin-sheet alpha approximation over CLOSED shallow architectural backing.
 * The existing harbour probe supplies reflections; no refraction capture is
 * requested. Do not apply to unbacked end caps or duplicate pane layers.
 */
export function createCanadaPlaceConcourseGlass() {
  const glass = new T.MeshPhysicalMaterial({
    name: "canada-west-glass",
    color: 0x78998b,
    metalness: 0,
    roughness: 0.21,
    ior: 1.5,
    specularIntensity: 1,
    specularColor: 0xffffff,
    clearcoat: 0,
    transmission: 0,
    envMapIntensity: 0.8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: T.FrontSide,
  });
  glass.userData.castShadow = false;
  glass.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `// Alpha compositing approximates reduced visibility at grazing angles.
// MeshPhysicalMaterial separately supplies dielectric specular Fresnel.
float concourseFacing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
float concourseGrazing=pow(1.0-concourseFacing,5.0);
diffuseColor.a=mix(opacity,0.96,concourseGrazing);
#include <opaque_fragment>`,
    );
  };
  glass.customProgramCacheKey = () => "canada-place-concourse-thin-sheet-v1";
  return glass;
}
