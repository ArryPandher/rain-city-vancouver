import * as T from "three";

/** A thin reflective layer over the closed, shallow door wells. This keeps
 * exterior depth without a transmission render pass or navigable interior. */
export function createCanadaPlaceDoorGlass() {
  const glass = new T.MeshStandardMaterial({
    name: "canada-west-door-glass",
    color: 0x82998e,
    metalness: 0.24,
    roughness: 0.13,
    envMapIntensity: 1.15,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: T.FrontSide,
  });
  glass.userData.castShadow = false;
  glass.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vDoorPaneUv;",
      )
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvDoorPaneUv=uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vDoorPaneUv;",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
vec2 paneEdge=min(vDoorPaneUv,vec2(1.0)-vDoorPaneUv);
float paneDirt=1.0-smoothstep(.008,.045,min(paneEdge.x,paneEdge.y));
roughnessFactor=clamp(roughnessFactor+paneDirt*.11,.13,.3);`,
      )
      .replace(
        "#include <opaque_fragment>",
        `// Reflection strengthens toward the grazing angle, while the physical
// well remains visible through the centre of a clean pane.
float paneFacing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
float paneFresnel=pow(1.0-paneFacing,5.0);
diffuseColor.a=clamp(.18+.64*paneFresnel+.065*paneDirt,.18,.9);
#include <opaque_fragment>`,
      );
  };
  glass.customProgramCacheKey = () => "canada-place-door-glass-v1";
  return glass;
}
