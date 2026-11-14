import * as T from "three";
import type { Materials } from "./materials";
import type { CityData } from "./data";
import { pointInPoly, segmentPoint, roadWidth } from "./data";
import type { CollisionWorld } from "./collision";
import { PROSPECT_PLANTING } from "./prospect-bank";
import { coastalGrowth, coastalSlope } from "./prospect-geology";
export function coastalCoverMask(data: CityData, collision: CollisionWorld) {
  const minX = -1700,
    minZ = -3432,
    width = 240,
    height = 172,
    pixels = new Uint8Array(width * height * 4);
  for (let iz = 0; iz < height; iz++)
    for (let ix = 0; ix < width; ix++) {
      const x = minX + ix + 0.5,
        z = minZ + iz + 0.5,
        y = collision.groundHeight(x, z),
        offset = (iz * width + ix) * 4;
      pixels[offset + 3] = 255;
      if (
        !data.terrain ||
        !pointInPoly(x, z, PROSPECT_PLANTING) ||
        y < 2 ||
        collision.water(x, z, y) ||
        collision.blocked(x, z, 0.2, y)
      )
        continue;
      let edge = Infinity;
      for (let j = 0; j < PROSPECT_PLANTING.length; j += 2) {
        const k = (j + 2) % PROSPECT_PLANTING.length;
        edge = Math.min(
          edge,
          segmentPoint(
            x,
            z,
            PROSPECT_PLANTING[j],
            PROSPECT_PLANTING[j + 1],
            PROSPECT_PLANTING[k],
            PROSPECT_PLANTING[k + 1],
          ).d,
        );
      }
      let route = Infinity;
      for (const road of collision.roads.query(x, z, 26))
        for (let j = 0; j < road.pts.length - 2; j += 2)
          route = Math.min(
            route,
            segmentPoint(
              x,
              z,
              road.pts[j],
              road.pts[j + 1],
              road.pts[j + 2],
              road.pts[j + 3],
            ).d -
              roadWidth(road) / 2,
          );
      const fade = (v: number, a: number, b: number) => {
        const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      pixels[offset] = Math.round(
        255 *
          fade(edge, 0, 6) *
          fade(route, 0.75, 2.5) *
          fade(y, 2, 3) *
          coastalGrowth(x, y, z, coastalSlope(data.terrain, x, z)),
      );
    }
  const texture = new T.DataTexture(pixels, width, height, T.RGBAFormat);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return { texture, minX, minZ, width, height };
}
/** Photographic surface continuity under the separately shaded 3D leaf clusters. */
export function coastalCoverMaterials(
  m: Materials,
  data: CityData,
  collision: CollisionWorld,
) {
  const mask = coastalCoverMask(data, collision),
    color = m.texture("coastal/leaf-cover-color.webp", true),
    normal = m.texture("coastal/leaf-cover-normal.webp"),
    cache = new Map<T.Material, T.Material>();
  return (base: T.Material) => {
    const old = cache.get(base);
    if (old) return old;
    const mat = base.clone();
    mat.onBeforeCompile = (shader, renderer) => {
      base.onBeforeCompile(shader, renderer);
      Object.assign(shader.uniforms, {
        coastalCoverMask: { value: mask.texture },
        coastalCoverColor: { value: color },
        coastalCoverNormal: { value: normal },
      });
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D coastalCoverMask;
uniform sampler2D coastalCoverColor;
uniform sampler2D coastalCoverNormal;`,
        )
        .replace(
          "#include <color_fragment>",
          `
vec2 coverMaskUv=(vCliffPosition.xz-vec2(-1700.0,-3432.0))/vec2(240.0,172.0);
float coverInside=step(0.0,coverMaskUv.x)*step(0.0,coverMaskUv.y)*step(coverMaskUv.x,1.0)*step(coverMaskUv.y,1.0);
float coverAmount=texture2D(coastalCoverMask,clamp(coverMaskUv,0.0,1.0)).r*coverInside;
vec2 coverUvX=cliffUvX*1.35,coverUvY=cliffUvY*1.35,coverUvZ=cliffUvZ*1.35;
if(coverAmount>.001){
 vec3 cover=texture2D(coastalCoverColor,coverUvX).rgb*cliffWeights.x+texture2D(coastalCoverColor,coverUvY).rgb*cliffWeights.y+texture2D(coastalCoverColor,coverUvZ).rgb*cliffWeights.z;
 diffuseColor.rgb=mix(diffuseColor.rgb,cover*vec3(.82,.94,.72),coverAmount);
}
#include <color_fragment>`,
        )
        .replace(
          "#include <clearcoat_normal_fragment_begin>",
          `
if(coverAmount>.001){
 vec2 cx=texture2D(coastalCoverNormal,coverUvX).xy*2.0-1.0,cy=texture2D(coastalCoverNormal,coverUvY).xy*2.0-1.0,cz=texture2D(coastalCoverNormal,coverUvZ).xy*2.0-1.0;
 vec3 perturb=vec3(0.0,cx.y,-cliffSigns.x*cx.x)*cliffWeights.x+vec3(cy.x,0.0,-cliffSigns.y*cy.y)*cliffWeights.y+vec3(cliffSigns.z*cz.x,cz.y,0.0)*cliffWeights.z;
 perturb-=cliffN*dot(perturb,cliffN);
 vec3 coverN=normalize(mat3(viewMatrix)*normalize(cliffN+perturb*.5));
 normal=normalize(mix(normal,coverN,coverAmount));roughnessFactor=mix(roughnessFactor,.95,coverAmount);
}
#include <clearcoat_normal_fragment_begin>`,
        );
    };
    mat.customProgramCacheKey = () =>
      `${base.customProgramCacheKey()}-coastal-cover-v1`;
    cache.set(base, mat);
    return mat;
  };
}
