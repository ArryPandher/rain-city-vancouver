import * as T from "three";

/** Photo-mask correction only. This remains the existing approximate plane,
 * photographed from Canada Place, not terrain registered to Ironworkers. */
export const NORTH_SHORE_PHOTO_HORIZON = {
  texture: "textures/vancouver/north-shore-ridge.webp?v=ridge-20261116",
  width: 24000,
  height: 1977,
  position: [400, 480, -7000] as const,
};

/** Caller owns loading and this texture wrapper. Do not pass a shared sampler.
 * No additional pass, lighting, geometry detail, terrain or collision changes. */
export function createNorthShorePhotoHorizon(photo: T.Texture) {
  photo.colorSpace = T.SRGBColorSpace;
  photo.name = "North Shore Selmo panorama — source-guided ridge mask";
  photo.anisotropy = 8;
  const material = new T.MeshBasicMaterial({
    name: "North Shore photographic horizon",
    map: photo,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  // Preserve the existing shader's additional lateral fade exactly. The new
  // image retains the original bottom and160pixel image-edge fade formulas.
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\ndiffuseColor.a *= smoothstep(0.0,0.13,vMapUv.x)*(1.0-smoothstep(0.87,1.0,vMapUv.x));",
    );
  };
  const mesh = new T.Mesh(
    new T.PlaneGeometry(
      NORTH_SHORE_PHOTO_HORIZON.width,
      NORTH_SHORE_PHOTO_HORIZON.height,
    ),
    material,
  );
  mesh.position.set(...NORTH_SHORE_PHOTO_HORIZON.position);
  mesh.renderOrder = -1;
  mesh.name = "Photographic North Shore mountain horizon";
  mesh.userData.photoRidgeRefinement = true;
  return mesh;
}
