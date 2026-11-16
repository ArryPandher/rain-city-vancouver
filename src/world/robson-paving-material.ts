import * as T from "three";
import type { Materials } from "./materials";

/** Rectangular terrace paving visible in TCLF's 2019 Robson photographs.
 * Dimensions/tint are authored estimates, not surveyed paving specifications. */
export const ROBSON_PAVING = {
  slabMetres: [0.8, 0.4] as const,
  jointMetres: 0.004,
  reliefMetres: 0.0008,
  edgeBlendMetres: 0.006,
  jointContrast: 0.18,
  // The reused map is normalized near linear .825; this tint preserves the
  // old substrate's mean luminance while removing its strong brown cast.
  color: 0x5c5750,
  grainRepeatMetres: 2,
  sourceUvMetres: 4,
} as const;

/** robson-square's terrain UV is [worldX/4,worldZ/4], before texture repeat.
 * Match gridUV's garden axes without depending on later chunk transforms. */
export function robsonPavingCoordinates(u: number, v: number) {
  const k = ROBSON_PAVING.sourceUvMetres / Math.SQRT2;
  return [(u - v) * k, (u + v) * k] as const;
}

/** One opaque material for the main Robson garden substrate only. Do not use
 * on box/default UVs, mound circulation, retaining walls or other city paths.
 * Dispose the material to release its three owned sampler wrappers; the
 * library's source textures and other materials remain caller-owned. */
export function createRobsonPavingMaterial(
  library: Pick<Materials, "texture">,
) {
  const q = ROBSON_PAVING;
  const map = (kind: string, color: boolean) => {
    const texture = library
      .texture(`canada-place-paving/${kind}.webp`, color)
      .clone();
    texture.name = `Robson paving ${kind}`;
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.setScalar(q.sourceUvMetres / q.grainRepeatMetres);
    texture.updateMatrix();
    return texture;
  };
  const maps = [
    map("color", true),
    map("normal", false),
    map("roughness", false),
  ];
  const material = new T.MeshStandardMaterial({
    name: "Robson Square — mineral paving",
    color: q.color,
    map: maps[0],
    normalMap: maps[1],
    roughnessMap: maps[2],
    normalScale: new T.Vector2(0.2, 0.2),
    roughness: 1,
    metalness: 0,
  });
  let disposed = false;
  material.addEventListener("dispose", () => {
    if (disposed) return;
    disposed = true;
    maps.forEach((texture) => texture.dispose());
  });
  material.userData.robsonPaving = { ...q };
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vRobsonPaving;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vRobsonPaving=vec2(uv.x-uv.y,uv.x+uv.y)*${q.sourceUvMetres / Math.SQRT2};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vRobsonPaving;
vec2 robsonJointEdge(vec2 p){
 vec2 fraction=fract(p/vec2(${q.slabMetres.join(",")}));
 return min(fraction,1.0-fraction)*vec2(${q.slabMetres.join(",")});
}
float robsonJoint(vec2 p){
 vec2 edge=robsonJointEdge(p);
 float footprint=max(length(fwidth(p)),.0001);
 return (1.0-smoothstep(${q.jointMetres / 2},${q.jointMetres / 2}+footprint*.5,min(edge.x,edge.y)))*min(1.0,${q.jointMetres}/footprint);
}
// Analytic slope: never differentiate the fwidth-filtered colour seam.
vec2 robsonJointSlope(vec2 p){
 vec2 edge=robsonJointEdge(p);
 vec2 direction=sign(.5-fract(p/vec2(${q.slabMetres.join(",")})));
 float t=clamp((min(edge.x,edge.y)-${q.jointMetres / 2})/${q.edgeBlendMetres},0.0,1.0);
 float slope=${q.reliefMetres}*6.0*t*(1.0-t)/${q.edgeBlendMetres};
 return slope*(edge.x<edge.y?vec2(direction.x,0.0):vec2(0.0,direction.y));
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
diffuseColor.rgb*=1.0-robsonJoint(vRobsonPaving)*${q.jointContrast};`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 robsonDx=dFdx(-vViewPosition),robsonDy=dFdy(-vViewPosition);
vec3 robsonR1=cross(robsonDy,normal),robsonR2=cross(normal,robsonDx);
float robsonDet=dot(robsonDx,robsonR1);
vec2 robsonSlope=robsonJointSlope(vRobsonPaving);
float robsonFilter=min(1.0,${q.jointMetres + 2 * q.edgeBlendMetres}/max(length(fwidth(vRobsonPaving)),.0001));
vec3 robsonGradient=sign(robsonDet)*robsonFilter*(dot(robsonSlope,dFdx(vRobsonPaving))*robsonR1+dot(robsonSlope,dFdy(vRobsonPaving))*robsonR2);
if(abs(robsonDet)>1e-8)normal=normalize(abs(robsonDet)*normal-robsonGradient);`,
      );
  };
  material.customProgramCacheKey = () => "robson-mineral-paving-v1";
  return material;
}
