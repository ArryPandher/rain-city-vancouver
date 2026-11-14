import * as T from "three";
import type { Materials } from "./materials";

/** Natural terrain shares one rock layer across land-use boundaries. Project
 * it in three world planes so nearly vertical cliffs keep their metre scale.
 */
export function cliffMaterials(m: Materials) {
  const color = m.texture("cliffs/rock_face_03-color.webp", true),
    normal = m.texture("cliffs/rock_face_03-normal.webp"),
    roughness = m.texture("cliffs/rock_face_03-roughness.webp"),
    cache = new Map<T.Material, T.Material>();
  return (base: T.Material) => {
    const cached = cache.get(base);
    if (cached) return cached;
    const mat = base.clone();
    mat.onBeforeCompile = (shader, renderer) => {
      base.onBeforeCompile(shader, renderer);
      Object.assign(shader.uniforms, {
        cliffColor: { value: color },
        cliffNormal: { value: normal },
        cliffRoughness: { value: roughness },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vCliffPosition;
varying vec3 vCliffNormal;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vCliffPosition = (modelMatrix * vec4(position, 1.0)).xyz;
vCliffNormal = normalize(mat3(modelMatrix) * normal);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D cliffColor;
uniform sampler2D cliffNormal;
uniform sampler2D cliffRoughness;
varying vec3 vCliffPosition;
varying vec3 vCliffNormal;`,
        )
        .replace(
          "#include <color_fragment>",
          `
vec3 cliffN = normalize(vCliffNormal);
vec3 cliffSigns = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), cliffN));
vec3 cliffWeights = pow(abs(cliffN), vec3(6.0));
cliffWeights /= max(dot(cliffWeights, vec3(1.0)), 0.0001);
float cliffNoise = sin(vCliffPosition.x * 0.17 + sin(vCliffPosition.z * 0.13)) * 0.035;
float cliffAmount = smoothstep(0.12, 0.27, 1.0 - abs(cliffN.y) + cliffNoise);
vec3 cliffP = vCliffPosition / 2.7;
vec2 cliffUvX = vec2(-cliffSigns.x * cliffP.z, cliffP.y);
vec2 cliffUvY = vec2(cliffP.x, -cliffSigns.y * cliffP.z);
vec2 cliffUvZ = vec2(cliffSigns.z * cliffP.x, cliffP.y);
if (cliffAmount > 0.001) {
  vec3 rockColor = texture2D(cliffColor, cliffUvX).rgb * cliffWeights.x
    + texture2D(cliffColor, cliffUvY).rgb * cliffWeights.y
    + texture2D(cliffColor, cliffUvZ).rgb * cliffWeights.z;
  float rockShade = 0.88 + 0.12 * sin(vCliffPosition.y * 0.18 + sin(vCliffPosition.x * 0.041) + sin(vCliffPosition.z * 0.047));
  diffuseColor.rgb = mix(diffuseColor.rgb, rockColor * rockShade, cliffAmount);
}
#include <color_fragment>`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
if (cliffAmount > 0.001) {
  float rockRoughness = texture2D(cliffRoughness, cliffUvX).g * cliffWeights.x
    + texture2D(cliffRoughness, cliffUvY).g * cliffWeights.y
    + texture2D(cliffRoughness, cliffUvZ).g * cliffWeights.z;
  roughnessFactor = mix(roughnessFactor, max(0.72, rockRoughness), cliffAmount);
}`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
if (cliffAmount > 0.001) {
  vec2 rockX = texture2D(cliffNormal, cliffUvX).xy * 2.0 - 1.0;
  vec2 rockY = texture2D(cliffNormal, cliffUvY).xy * 2.0 - 1.0;
  vec2 rockZ = texture2D(cliffNormal, cliffUvZ).xy * 2.0 - 1.0;
  vec3 rockPerturbation = vec3(0.0, rockX.y, -cliffSigns.x * rockX.x) * cliffWeights.x
    + vec3(rockY.x, 0.0, -cliffSigns.y * rockY.y) * cliffWeights.y
    + vec3(cliffSigns.z * rockZ.x, rockZ.y, 0.0) * cliffWeights.z;
  rockPerturbation -= cliffN * dot(rockPerturbation, cliffN);
  vec3 rockNormal = normalize(mat3(viewMatrix) * normalize(cliffN + rockPerturbation * 0.85));
  normal = normalize(mix(normal, rockNormal, cliffAmount));
}`,
        );
    };
    mat.customProgramCacheKey = () =>
      `${base.customProgramCacheKey()}-stanley-cliff-v1`;
    cache.set(base, mat);
    return mat;
  };
}
