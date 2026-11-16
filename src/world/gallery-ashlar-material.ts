import * as T from "three";

/** Authored linear-light range, not a measured reflectance range. The existing
 * 1.2 × .55m ashlar cells provide the scale; no second joint grid is introduced. */
export const GALLERY_ASHLAR_FINISH = {
  albedoRange: [0.94, 1.06] as const,
  roughnessVariation: 0.04,
};

/** Rear wall finish only. Columns, cornice, source stone and shared map samplers
 * retain their existing materials. Disposing this clone does not dispose maps. */
export function createGalleryAshlarMaterial(source: T.MeshStandardMaterial) {
  if (
    source.userData.landmarkId !== "vancouver-art-gallery" ||
    source.userData.landmarkSurface !== "mineral" ||
    !source.userData.landmarkJoints
  )
    return source;

  const material = source.clone();
  material.name = "Gallery rear ashlar wall";
  material.userData.galleryAshlar = GALLERY_ASHLAR_FINISH;
  // Material.clone does not copy onBeforeCompile. Keep the existing metric
  // joints, footprint filtering and relief before changing the cell response.
  const compile = source.onBeforeCompile;
  const sourceKey = source.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    const original =
      "diffuseColor.rgb*=mix(.98,1.02,blockDetail.y)*(1.0-blockDetail.x*.22);";
    if (!shader.fragmentShader.includes(original))
      throw new Error(
        "Gallery ashlar requires the existing landmark stone cells",
      );
    shader.uniforms.galleryAshlarRange = {
      value: new T.Vector2(...GALLERY_ASHLAR_FINISH.albedoRange),
    };
    shader.uniforms.galleryAshlarRoughness = {
      value: GALLERY_ASHLAR_FINISH.roughnessVariation,
    };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec2 galleryAshlarRange;\nuniform float galleryAshlarRoughness;",
      )
      .replace(
        original,
        "diffuseColor.rgb*=mix(galleryAshlarRange.x,galleryAshlarRange.y,blockDetail.y)*(1.0-blockDetail.x*.22);",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
// Rougher pale blocks and denser darker blocks share the existing ashlar cells.
roughnessFactor=clamp(roughnessFactor+(blockDetail.y-.5)*2.0*galleryAshlarRoughness,.5,1.0);`,
      );
  };
  material.customProgramCacheKey = () => `${sourceKey}:gallery-ashlar-v1`;
  return material;
}
