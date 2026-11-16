import * as T from "three";
import { ungeo } from "./data";
import data from "./north-shore-imagery-data.json";
export const NORTH_SHORE_IMAGERY = data;

/** Reprojected north-up geographic crop, with image north at texture v=1. */
export function northShoreImageryUv(x: number, z: number): [number, number] {
  const [lat, lon] = ungeo(x, z);
  return [
    (lon - data.bounds.west) / (data.bounds.east - data.bounds.west),
    (lat - data.bounds.south) / (data.bounds.north - data.bounds.south),
  ];
}

/** Image alpha is coverage confidence, not terrain transparency. */
export function applyNorthShoreImageryShader(shader: {
  fragmentShader: string;
}) {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <map_fragment>",
      T.ShaderChunk.map_fragment.replace(
        "diffuseColor *= sampledDiffuseColor;",
        "// Applied with neutral fallback below.",
      ),
    )
    .replace(
      "#include <color_fragment>",
      `
#ifdef USE_MAP
  diffuseColor.rgb *= mix(vColor.rgb, sampledDiffuseColor.rgb, sampledDiffuseColor.a);
#else
  ${T.ShaderChunk.color_fragment}
#endif
`,
    );
}

/** Local diagnostic colour only. Preserve the neutral material on load failure. */
export function loadNorthShoreImagery(
  material: T.MeshStandardMaterial,
  group: T.Group,
) {
  group.userData.imageryStatus = "loading";
  const base = import.meta.env?.BASE_URL ?? "/";
  new T.TextureLoader().load(
    `${base}textures/north-shore-dem/sentinel-2024.webp`,
    (texture) => {
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = true;
      material.map = texture;
      material.needsUpdate = true;
      group.userData.imageryStatus = "ready";
    },
    undefined,
    () => {
      group.userData.imageryStatus = "fallback";
    },
  );
}
