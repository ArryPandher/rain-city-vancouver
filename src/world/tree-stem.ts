import * as T from "three";
/** Narrow the lower stem independently of the canopy; use the same deformation for sunlight shadows. */
export function calibrateStem(material: T.Material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float treeStemScale;
float stemBlend(float y) { return smoothstep(0.15, 0.5, y); }
float stemFactor(float y) { return mix(treeStemScale, 1.0, stemBlend(y)); }`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
float stemT = clamp((position.y - 0.15) / 0.35, 0.0, 1.0);
float stemDerivative = (1.0 - treeStemScale) * 6.0 * stemT * (1.0 - stemT) / 0.35;
objectNormal.xz /= stemFactor(position.y);
objectNormal.y -= stemDerivative * dot(position.xz, objectNormal.xz);`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
transformed.xz *= stemFactor(position.y);`,
      );
  };
  material.customProgramCacheKey = () => "rain-city-tree-stem-v1";
}
