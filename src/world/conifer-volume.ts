import { CONIFER_ASSET_REVISION } from "./conifer-foliage";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BASE } from "./materials";
import foliageCuts from "./conifer-volume-cuts.json";

/** Eight depth slices in each of two perpendicular views retain bough depth.
 * A pixel chooses one view, avoiding doubled opacity where the views overlap. */
export function coniferVolumeGeometry(bounds: T.Box3, variant = 0) {
  const height = bounds.max.y - bounds.min.y,
    parts: T.BufferGeometry[] = [],
    cuts = variant === 1 ? foliageCuts.b : foliageCuts.c;
  for (const [row, axis] of (["z", "x"] as const).entries())
    for (let i = 0; i < 8; i++) {
      const centre =
        (bounds.min[axis] +
          ((bounds.max[axis] - bounds.min[axis]) * (i + 0.5)) / 8) /
        height;
      // Each strip bounds photographed branch coverage, with a filter margin.
      // Empty sky and the bare lower trunk do not need alpha-tested fragments.
      for (const [left, top, right, bottom] of cuts[row * 8 + i]) {
        const geometry = new T.PlaneGeometry(
            (right - left) / 1024,
            (bottom - top) / 1024,
          ),
          uv = geometry.getAttribute("uv");
        for (let j = 0; j < uv.count; j++)
          uv.setXY(
            j,
            (i + (left + (right - left) * uv.getX(j)) / 512) / 8,
            (2 - row - bottom / 1024 + ((bottom - top) * uv.getY(j)) / 1024) /
              2,
          );
        geometry.translate(
          ((left + right) / 1024 - 0.5) * 0.5,
          1 - (top + bottom) / 2048,
          0,
        );
        if (axis === "x") geometry.rotateY(Math.PI / 2);
        geometry.translate(
          axis === "x" ? centre : 0,
          0,
          axis === "z" ? centre : 0,
        );
        geometry.setAttribute(
          "sliceAxis",
          new T.Float32BufferAttribute(new Float32Array(4).fill(row), 1),
        );
        parts.push(geometry);
      }
    }
  const geometry = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function volumeShader(material: T.Material, normals?: T.Texture) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float sliceAxis;
varying float vSliceAxis;
varying float vSliceZWeight;
varying vec3 vSliceNormalX;
varying vec3 vSliceNormalY;
varying vec3 vSliceNormalZ;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
mat4 treeWorld=modelMatrix*instanceMatrix;
vec3 treeView=normalize(cameraPosition-(treeWorld*vec4(0.0,.5,0.0,1.0)).xyz);
float xWeight=pow(abs(dot(treeView,normalize(treeWorld[0].xyz))),6.0);
float zWeight=pow(abs(dot(treeView,normalize(treeWorld[2].xyz))),6.0);
vSliceZWeight=zWeight/max(.0001,xWeight+zWeight);
vSliceAxis=sliceAxis;
mat3 treeInstance=mat3(instanceMatrix);
vSliceNormalX=normalMatrix*treeInstance[0]/dot(treeInstance[0],treeInstance[0]);
vSliceNormalY=normalMatrix*treeInstance[1]/dot(treeInstance[1],treeInstance[1]);
vSliceNormalZ=normalMatrix*treeInstance[2]/dot(treeInstance[2],treeInstance[2]);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vSliceAxis;
varying float vSliceZWeight;
varying vec3 vSliceNormalX;
varying vec3 vSliceNormalY;
varying vec3 vSliceNormalZ;
uniform sampler2D coniferVolumeNormal;`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
float viewDither=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));
if((vSliceAxis<.5 && viewDither>=vSliceZWeight)||(vSliceAxis>.5 && viewDither<vSliceZWeight)) discard;`,
      );
    if (normals) {
      shader.uniforms.coniferVolumeNormal = { value: normals };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 sliceNormal=texture2D(coniferVolumeNormal,vMapUv).xyz*2.0-1.0;
normal=normalize(vSliceNormalX*sliceNormal.x+vSliceNormalY*sliceNormal.y+vSliceNormalZ*sliceNormal.z)*faceDirection;`,
      );
    }
  };
  material.customProgramCacheKey = () =>
    `conifer-volume-v1-${Boolean(normals)}`;
}
export async function loadConiferVolumeMaterials() {
  const loader = new T.TextureLoader(),
    variants = ["c", "b"],
    loaded = await Promise.allSettled(
      variants.flatMap((variant) =>
        ["color", "normal"].map((kind) =>
          loader.loadAsync(
            `${BASE}textures/forest/volume/${variant}-${kind}.webp?v=${CONIFER_ASSET_REVISION}`,
          ),
        ),
      ),
    );
  const failure = loaded.find((result) => result.status === "rejected");
  if (failure) {
    // All requests have settled, so no later completion can leak a texture
    // when the caller retains the geometric foliage fallback.
    for (const result of loaded)
      if (result.status === "fulfilled") result.value.dispose();
    throw failure.reason;
  }
  const textures = loaded.map(
    (result) => (result as PromiseFulfilledResult<T.Texture>).value,
  );
  return variants.map((variant, i) => {
    const [map, normals] = textures.slice(i * 2, i * 2 + 2);
    map.colorSpace = T.SRGBColorSpace;
    normals.colorSpace = T.NoColorSpace;
    for (const texture of [map, normals]) {
      texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
      texture.anisotropy = 8;
    }
    const material = new T.MeshStandardMaterial({
      name: `Stanley conifer ${variant} — layered boughs`,
      map,
      alphaTest: 0.18,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 0.96,
      envMapIntensity: 0.5,
    });
    const depth = new T.MeshDepthMaterial({
      map,
      depthPacking: T.RGBADepthPacking,
      alphaTest: 0.18,
      side: T.DoubleSide,
    });
    volumeShader(material, normals);
    volumeShader(depth);
    return { material, depth };
  });
}
