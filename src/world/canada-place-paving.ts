import * as T from "three";
import { BASE } from "./materials";
export type CanadaPlacePavingMaps = {
  color: T.Texture;
  normal: T.Texture;
  roughness: T.Texture;
};
let pavingMaps: CanadaPlacePavingMaps | undefined;
function loadPavingMaps(): CanadaPlacePavingMaps {
  if (pavingMaps) return pavingMaps;
  const loader = new T.TextureLoader(),
    load = (kind: string) => {
      const t = loader.load(`${BASE}textures/canada-place-paving/${kind}.webp`);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8;
      if (kind === "color") t.colorSpace = T.SRGBColorSpace;
      return t;
    };
  return (pavingMaps = {
    color: load("color"),
    normal: load("normal"),
    roughness: load("roughness"),
  });
}

/** Reviewed, baked source-local concrete primitive, committed GLB SHA-256:
 * 1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe.
 * Millimetre fingerprint tolerates float baking roundoff, not source changes. */
export const CANADA_PLACE_PAVING_SOURCE = {
  positions: 8368,
  indices: 11154,
  fingerprint: 377744293,
  topOffsets: [
    96, 99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 132, 135, 138, 141,
    144, 147, 150, 153, 156, 159, 162, 165, 168, 171, 174, 177, 180, 183, 186,
    189,
  ],
} as const;
export function canadaPlacePavingFingerprint(g: T.BufferGeometry) {
  const p = g.getAttribute("position"),
    ix = g.getIndex();
  let hash = 2166136261;
  if (!p || !ix) return 0;
  for (let i = 0; i < p.count; i++)
    for (const v of [p.getX(i), p.getY(i), p.getZ(i)])
      hash = Math.imul(hash ^ Math.round(v * 1000), 16777619) >>> 0;
  for (let i = 0; i < ix.count; i++)
    hash = Math.imul(hash ^ ix.getX(i), 16777619) >>> 0;
  return hash;
}
/** Separate only the reviewed upward PIER top. Exact original triangle positions
 * preserve the walking plane; no coplanar overlay and no altered wall vertices.
 * Call on baked local geometry BEFORE other surface edits. */
export function extractCanadaPlacePaving(
  g: T.BufferGeometry,
  materialName: string,
): T.BufferGeometry | null {
  const source = CANADA_PLACE_PAVING_SOURCE,
    p = g.getAttribute("position"),
    ix = g.getIndex();
  if (
    materialName !== "concrete" ||
    p?.count !== source.positions ||
    ix?.count !== source.indices ||
    canadaPlacePavingFingerprint(g) !== source.fingerprint
  )
    return null;
  const selected = new Set<number>(source.topOffsets),
    position: number[] = [],
    normal: number[] = [],
    uv: number[] = [],
    kept: number[] = [];
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  for (const offset of selected) {
    a.fromBufferAttribute(p, ix.getX(offset));
    b.fromBufferAttribute(p, ix.getX(offset + 1));
    c.fromBufferAttribute(p, ix.getX(offset + 2));
    if (
      [a, b, c].some((v) => Math.abs(v.y - 7.8) > 0.02) ||
      b.clone().sub(a).cross(c.clone().sub(a)).y <= 0
    )
      return null;
  }
  for (let i = 0; i < ix.count; i += 3) {
    if (!selected.has(i)) {
      kept.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
      continue;
    }
    for (let j = 0; j < 3; j++) {
      const k = ix.getX(i + j),
        x = p.getX(k),
        y = p.getY(k),
        z = p.getZ(k);
      position.push(x, y, z);
      normal.push(0, 1, 0);
      uv.push(x, -z);
    }
  }
  const top = new T.BufferGeometry();
  top.setAttribute("position", new T.Float32BufferAttribute(position, 3));
  top.setAttribute("normal", new T.Float32BufferAttribute(normal, 3));
  top.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  top.computeBoundingBox();
  top.computeBoundingSphere();
  g.setIndex(kept);
  return top;
}

/** One material with dedicated source-calibrated CC0 mineral maps. Archival west-trail
 * reference supports grey orthogonal paving, not the newer North Point pattern.
 * Dimensions/banding are explicit estimates; relief only changes shading. */
export function canadaPlacePavingMaterial(
  mineral: T.MeshStandardMaterial,
  maps = loadPavingMaps(),
) {
  const material = mineral.clone();
  material.name = "Canada Place promenade paving";
  material.color.setHex(0x666c66);
  material.map = maps.color;
  material.normalMap = maps.normal;
  material.roughnessMap = maps.roughness;
  material.roughness = 1;
  material.metalness = 0;
  material.normalScale.set(0.45, 0.45);
  material.envMapIntensity = 0.65;
  material.userData.canadaPlacePaving = {
    slabMetres: [1.5, 0.75],
    jointMetres: 0.008,
    reliefMetres: 0.002,
    bandPeriodMetres: 6,
    bandWidthMetres: 0.16,
  };
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vPavingMetres;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
// Longitudinal axis of mapped west pier; all values remain local metres.
vPavingMetres=vec2(dot(position.xz,vec2(.878,-.478)),dot(position.xz,vec2(.478,.878)));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor,.75,.85);",
      )
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vPavingMetres;
vec3 pavingDetail(vec2 metres){
 vec2 cell=metres/vec2(1.5,.75);
 vec2 edge=min(fract(cell),1.0-fract(cell))*vec2(1.5,.75);
 float footprint=max(length(fwidth(metres)),.0001);
 float seam=(1.0-smoothstep(.004,.004+footprint*.5,min(edge.x,edge.y)))*min(1.0,.008/footprint);
 float variation=fract(sin(dot(floor(cell),vec2(127.1,311.7)))*43758.5453);
 float bandDistance=abs(mod(metres.x+3.0,6.0)-3.0);
 float band=1.0-smoothstep(.08,.08+footprint,bandDistance);
 return vec3(seam,mix(.94,1.06,variation)*mix(1.0,1.22,band),-seam*.002);
}
// Analytic gradient of the 2mm joint recess. Do not differentiate the
// fwidth-filtered colour seam: higher-order GLSL derivatives are undefined.
vec2 pavingReliefGradient(vec2 metres){
 vec2 fraction=fract(metres/vec2(1.5,.75));
 vec2 edge=min(fraction,1.0-fraction)*vec2(1.5,.75);
 float distanceToJoint=min(edge.x,edge.y);
 float t=clamp((distanceToJoint-.004)/.008,0.0,1.0);
 float slope=.002*6.0*t*(1.0-t)/.008;
 vec2 direction=sign(vec2(.5)-fraction);
 vec2 gradient=edge.x<edge.y?vec2(direction.x,0.0):vec2(0.0,direction.y);
 return gradient*slope;
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec3 paving=pavingDetail(vPavingMetres);
diffuseColor.rgb*=paving.y*(1.0-paving.x*.28);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 pavingDx=dFdx(-vViewPosition),pavingDy=dFdy(-vViewPosition);
vec3 pavingR1=cross(pavingDy,normal),pavingR2=cross(normal,pavingDx);
float pavingDet=dot(pavingDx,pavingR1);
vec2 pavingSlope=pavingReliefGradient(vPavingMetres);
float pavingFilter=min(1.0,.016/max(length(fwidth(vPavingMetres)),.0001));
vec3 pavingGradient=sign(pavingDet)*pavingFilter*(dot(pavingSlope,dFdx(vPavingMetres))*pavingR1+dot(pavingSlope,dFdy(vPavingMetres))*pavingR2);
if(abs(pavingDet)>1e-8)normal=normalize(abs(pavingDet)*normal-pavingGradient);`,
      );
  };
  material.customProgramCacheKey = () => "canada-place-paving-v2";
  return material;
}
