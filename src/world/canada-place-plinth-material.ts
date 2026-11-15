import * as T from "three";
import type { Materials } from "./materials";

/** Painted mineral body, with source grain but no facade courses or form ties. */
export function canadaPlacePlinthMaterial(materials: Materials) {
  const material = new T.MeshStandardMaterial({
    name: "Canada Place protective anchor concrete",
    color: 0xd7dad3,
    map: materials.texture("canada-place-plinth/color.webp", true),
    normalMap: materials.texture("canada-place-plinth/normal.webp"),
    roughnessMap: materials.texture("canada-place-plinth/roughness.webp"),
    normalScale: new T.Vector2(0.18, 0.18),
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vAnchorWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvAnchorWorld=(modelMatrix*vec4(position,1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vAnchorWorld;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
// Quiet ground exposure, not an emissive outline or baked directional shadow.
float anchorBase=1.0-smoothstep(7.88,8.30,vAnchorWorld.y);
float anchorVariation=.82+.18*sin(vAnchorWorld.x*7.1+sin(vAnchorWorld.z*2.3))*sin(vAnchorWorld.z*5.2);
diffuseColor.rgb*=1.0-.18*anchorBase*anchorVariation;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor,.74,.88);",
      );
  };
  material.customProgramCacheKey = () => "canada-place-anchor-mineral-v1";
  return material;
}
