import * as T from "three";
import { BASE } from "./materials";
import { CANADA_PLACE_GROUND_STAYS } from "./canada-place-ground-stays-data";
import {
  canadaPlaceFixtureContactUniforms,
  CANADA_PLACE_FIXTURE_CONTACT_GLSL,
} from "./canada-place-fixture-contact";
/** Dry-photo-supported composition; dimensions and reflectance ratios are estimates. */
export const CANADA_PLACE_PAVING_LAYOUT = {
  dividerInward: 6.5,
  dividerWidth: 0.24,
  crossPeriod: 6,
  crossWidth: 0.16,
  fieldTint: 0.68,
  serviceTint: 0.53,
  aggregateTint: 1.08,
};
/** Linear decoded map mean; contrast changes grain, not its mean or UV scale. */
export const CANADA_PLACE_PAVING_GRAIN = { mean: 0.8253, contrast: 0.65 };
const pavingOrigin = new T.Vector2(-223.69801349034887, 62.32778289488352);
const pavingAlong = new T.Vector2(
  270.78430702398645,
  -146.9751236943621,
).normalize();
/** Input is original baked source UV, independent of later world transforms. */
export function canadaPlacePavingCoordinates(
  u: number,
  v: number,
): [number, number] {
  const x = u - pavingOrigin.x,
    z = -v - pavingOrigin.y;
  return [
    x * pavingAlong.x + z * pavingAlong.y,
    -x * pavingAlong.y + z * pavingAlong.x,
  ];
}
/** Sharp interior-zone sample for composition/joins, before pixel filtering. */
export function canadaPlacePavingTint(along: number, inward: number) {
  const p = CANADA_PLACE_PAVING_LAYOUT;
  const cross =
    Math.abs(
      ((((along + p.crossPeriod / 2) % p.crossPeriod) + p.crossPeriod) %
        p.crossPeriod) -
        p.crossPeriod / 2,
    ) <=
    p.crossWidth / 2;
  const divider = Math.abs(inward - p.dividerInward) <= p.dividerWidth / 2;
  return cross || divider
    ? p.aggregateTint
    : inward > p.dividerInward
      ? p.serviceTint
      : p.fieldTint;
}
/** Course exclusion in the interior west strip; 8mm feather is an estimated
 * construction transition, not a new displacement or dark perimeter joint. */
export function canadaPlacePavingFieldWeight(along: number, inward: number) {
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const d = Math.min(
    Math.abs(((((along + 3) % 6) + 6) % 6) - 3) - 0.08,
    Math.abs(inward - 6.5) - 0.12,
  );
  const west =
    smooth(0, 3, along) *
    (1 - smooth(305, 308, along)) *
    smooth(-0.1, 0.25, inward) *
    (1 - smooth(10, 10.5, inward));
  return 1 - west * (1 - smooth(0, 0.008, d));
}
export const CANADA_PLACE_CONTACT_WIDTH = 0.14;
export const CANADA_PLACE_CONTACT_STRENGTH = 0.38;
/** Distance to the exact chamfered perimeter; beneath the opaque body is hidden. */
export function canadaPlaceAnchorContact(x: number, z: number) {
  let distance = Infinity;
  for (const anchor of CANADA_PLACE_GROUND_STAYS) {
    if (Math.hypot(x - anchor.center[0], z - anchor.center[1]) > 1.8) continue;
    const p = anchor.localFootprint;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length,
        dx = p[j] - p[i],
        dz = p[j + 1] - p[i + 1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - p[i]) * dx + (z - p[i + 1]) * dz) / (dx * dx + dz * dz),
        ),
      );
      distance = Math.min(
        distance,
        Math.hypot(x - p[i] - t * dx, z - p[i + 1] - t * dz),
      );
    }
  }
  const t = Math.min(1, distance / CANADA_PLACE_CONTACT_WIDTH);
  return CANADA_PLACE_CONTACT_STRENGTH * (1 - t * t * (3 - 2 * t));
}
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
  options: { fixturesPresent?: boolean } = {},
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
    layout: CANADA_PLACE_PAVING_LAYOUT,
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(
      shader.uniforms,
      canadaPlaceFixtureContactUniforms(options.fixturesPresent === true),
    );
    shader.uniforms.anchorContactCenters = {
      value: CANADA_PLACE_GROUND_STAYS.map((a) => new T.Vector2(...a.center)),
    };
    shader.uniforms.anchorContactVertices = {
      value: CANADA_PLACE_GROUND_STAYS.flatMap((a) =>
        Array.from(
          { length: 8 },
          (_, i) =>
            new T.Vector2(a.localFootprint[i * 2], a.localFootprint[i * 2 + 1]),
        ),
      ),
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vPavingMetres;\nvarying vec2 vAnchorPavingPoint;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
// Raw baked UV survives later world-position batching and texture repeats.
vAnchorPavingPoint=vec2(uv.x,-uv.y);
// Longitudinal axis of mapped west pier; all values remain local metres.
vec2 pavingLocal=vAnchorPavingPoint-vec2(${pavingOrigin.x},${pavingOrigin.y});
vPavingMetres=vec2(dot(pavingLocal,vec2(${pavingAlong.x},${pavingAlong.y})),dot(pavingLocal,vec2(${-pavingAlong.y},${pavingAlong.x})));`,
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
varying vec2 vAnchorPavingPoint;
uniform vec2 anchorContactCenters[5];
uniform vec2 anchorContactVertices[40];
${CANADA_PLACE_FIXTURE_CONTACT_GLSL}
float anchorContact(vec2 p){
 float distanceToBase=1.0;
 for(int a=0;a<5;a++){
  vec2 delta=p-anchorContactCenters[a];
  // Most promenade pixels skip all edge work; no additional draw or texture.
  if(dot(delta,delta)<3.24){
   for(int e=0;e<8;e++){
    vec2 start=anchorContactVertices[a*8+e];
    vec2 end=anchorContactVertices[a*8+(e+1)%8];
    vec2 edge=end-start;
    float t=clamp(dot(p-start,edge)/dot(edge,edge),0.0,1.0);
    distanceToBase=min(distanceToBase,length(p-start-t*edge));
   }
  }
 }
 return 1.0-${CANADA_PLACE_CONTACT_STRENGTH.toFixed(2)}*(1.0-smoothstep(0.0,${CANADA_PLACE_CONTACT_WIDTH.toFixed(2)},distanceToBase));
}
// Value and analytic derivative of smoothstep; no derivative of filtered data.
vec2 pavingRamp(float a,float b,float x){
 float t=clamp((x-a)/(b-a),0.0,1.0);
 return vec2(t*t*(3.0-2.0*t),6.0*t*(1.0-t)/(b-a));
}
// x = field weight, yz = exact metre-space gradient of that weight.
vec3 pavingFieldWeight(vec2 p){
 float signedCross=mod(p.x+3.0,6.0)-3.0;
 float crossDistance=abs(signedCross)-.08;
 float dividerDistance=abs(p.y-6.5)-.12;
 vec2 course=pavingRamp(0.0,.008,min(crossDistance,dividerDistance));
 vec2 direction=crossDistance<dividerDistance?vec2(sign(signedCross),0.0):vec2(0.0,sign(p.y-6.5));
 vec2 a=pavingRamp(0.0,3.0,p.x),b=pavingRamp(305.0,308.0,p.x);
 vec2 c=pavingRamp(-.1,.25,p.y),d=pavingRamp(10.0,10.5,p.y);
 float west=a.x*(1.0-b.x)*c.x*(1.0-d.x);
 vec2 westGradient=vec2((a.y*(1.0-b.x)-a.x*b.y)*c.x*(1.0-d.x),a.x*(1.0-b.x)*(c.y*(1.0-d.x)-c.x*d.y));
 return vec3(1.0-west*(1.0-course.x),west*course.y*direction-westGradient*(1.0-course.x));
}
vec3 pavingDetail(vec2 metres){
 vec2 cell=metres/vec2(1.5,.75);
 vec2 edge=min(fract(cell),1.0-fract(cell))*vec2(1.5,.75);
 float footprint=max(length(fwidth(metres)),.0001);
 float seam=(1.0-smoothstep(.004,.004+footprint*.5,min(edge.x,edge.y)))*min(1.0,.008/footprint);
 float variation=fract(sin(dot(floor(cell),vec2(127.1,311.7)))*43758.5453);
 float bandDistance=abs(mod(metres.x+3.0,6.0)-3.0);
 float crossBand=(1.0-smoothstep(.08,.08+footprint,bandDistance))*min(1.0,.16/footprint);
 float dividerDistance=abs(metres.y-${CANADA_PLACE_PAVING_LAYOUT.dividerInward});
 float divider=(1.0-smoothstep(.12,.12+footprint,dividerDistance))*min(1.0,.24/footprint);
 // A continuous darker service strip, not random dark/grunge patches.
 float service=smoothstep(6.5,6.5+footprint,metres.y);
 float field=mix(${CANADA_PLACE_PAVING_LAYOUT.fieldTint},${CANADA_PLACE_PAVING_LAYOUT.serviceTint},service);
 float composition=mix(field,${CANADA_PLACE_PAVING_LAYOUT.aggregateTint},max(crossBand,divider));
 // Restrict this observed west-trail treatment to the source edge corridor.
 float west=smoothstep(0.0,3.0,metres.x)*(1.0-smoothstep(305.0,308.0,metres.x));
 west*=smoothstep(-.1,.25,metres.y)*(1.0-smoothstep(10.0,10.5,metres.y));
 // Pixel-sized four-point quadrature filters the course/field exclusion using
 // only first derivatives of metre coordinates (never derivatives of fwidth).
 vec2 dx=dFdx(metres)*.25,dy=dFdy(metres)*.25;
 float fieldWeight=.25*(pavingFieldWeight(metres+dx+dy).x+pavingFieldWeight(metres+dx-dy).x+pavingFieldWeight(metres-dx+dy).x+pavingFieldWeight(metres-dx-dy).x);
 seam*=fieldWeight;
 return vec3(seam,mix(1.0,mix(.97,1.03,variation),fieldWeight)*mix(1.0,composition,west),-seam*.002);
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
 vec3 field=pavingFieldWeight(metres);
 float height=-.002*(1.0-t*t*(3.0-2.0*t));
 // Product rule keeps the terminating joint continuous at course boundaries.
 return gradient*slope*field.x+height*field.yz;
}`,
      )
      .replace(
        "#include <map_fragment>",
        `// Preserve material tint and any vertex colour already applied before the map.
vec3 pavingDiffuseBase=diffuseColor.rgb;
#include <map_fragment>
diffuseColor.rgb=mix(pavingDiffuseBase*${CANADA_PLACE_PAVING_GRAIN.mean},diffuseColor.rgb,${CANADA_PLACE_PAVING_GRAIN.contrast});
vec3 paving=pavingDetail(vPavingMetres);
diffuseColor.rgb*=paving.y*(1.0-paving.x*.28);`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
// Local indirect-light occlusion only: retain direct sun, albedo and all geometry.
float anchorIndirect=anchorContact(vAnchorPavingPoint);
reflectedLight.indirectDiffuse*=anchorIndirect;
reflectedLight.indirectSpecular*=anchorIndirect;
float fixtureIndirect=canadaFixtureContact(vAnchorPavingPoint);
reflectedLight.indirectDiffuse*=fixtureIndirect;
reflectedLight.indirectSpecular*=fixtureIndirect;`,
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
  material.customProgramCacheKey = () =>
    "canada-place-paving-v7-course-fixture-contact";
  return material;
}
