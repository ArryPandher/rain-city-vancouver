import * as T from "three";
import type { Materials } from "./materials";

export type HoweStationPavingLayout = {
  /** Broad square-grid spacing, not the width of an individual small paver. */
  moduleMetres: number;
  bandMetres: number;
};

/** Box-filtered periodic stripe. The integral remains stable beyond one module
 * per pixel; using smoothstep alone makes distant broad grids flicker/disappear.
 * Kept scalar so tests can evaluate this exact arithmetic independently of WebGL.
 */
export const HOWE_STATION_PAVING_COVERAGE_GLSL = `
float howeStripeIntegral(float position, float period, float width) {
  float shifted=position+width*.5;
  float cell=floor(shifted/period);
  return cell*width+min(shifted-cell*period,width);
}
float howeStripeCoverage(float position, float period, float width, float footprint) {
  float span=max(footprint,.00001);
  return clamp((howeStripeIntegral(position+span*.5,period,width)-howeStripeIntegral(position-span*.5,period,width))/span,0.0,1.0);
}`;

function replaceOnce(source: string, anchor: string, replacement: string) {
  if (source.split(anchor).length !== 2)
    throw new Error(`Howe station paving shader anchor changed: ${anchor}`);
  return source.replace(anchor, replacement);
}

/** Geometry supplies continuous metre UVs along the photographed broad grid.
 * Mineral photography is the existing Charlotte Baglioni / Poly Haven Granite
 * Tile crop (CC0), not aerial imagery or a new asset. The atlas has no old joints.
 * Colours, dry finish and millimetre relief are interpretations, not a survey.
 */
export function createHoweStationPavingMaterials(
  library: Pick<Materials, "texture">,
  layout: HoweStationPavingLayout,
) {
  if (
    !(
      Number.isFinite(layout.moduleMetres) &&
      Number.isFinite(layout.bandMetres) &&
      layout.moduleMetres > 0 &&
      layout.bandMetres > 0 &&
      layout.bandMetres < layout.moduleMetres / 2
    )
  )
    throw new Error(
      "Howe station paving requires a positive module and narrower broad band",
    );
  const mineral = (kind: string, color: boolean) => {
    const texture = library
      .texture(`canada-place-paving/${kind}.webp`, color)
      .clone();
    texture.name = `Howe station paving ${kind}`;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.setScalar(1 / 0.72);
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.updateMatrix();
    return texture;
  };
  const map = mineral("color", true),
    normalMap = mineral("normal", false),
    roughnessMap = mineral("roughness", false);
  const infillColor = new T.Color(0x8c756d),
    bandColor = new T.Color(0xb5afa2);
  const options = {
    map,
    normalMap,
    roughnessMap,
    roughness: 1,
    metalness: 0,
    normalScale: new T.Vector2(0.28, 0.28),
  };
  const field = new T.MeshStandardMaterial({
    ...options,
    name: "Howe station warm infill and pale square grid",
  });
  const border = new T.MeshStandardMaterial({
    ...options,
    color: bandColor,
    name: "Howe station source-visible pale paving course",
  });
  field.userData.howeStationPaving = {
    ...layout,
    jointMetres: 0.006,
    reliefMetres: 0.0015,
    mineralRepeatMetres: 0.72,
    infillColor: "#8c756d",
    bandColor: "#b5afa2",
    interpretation:
      "Source-visible warm infill within broad pale square bands. No checkerboard or invented damage.",
  };
  field.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      howePavingModule: { value: layout.moduleMetres },
      howePavingBand: { value: layout.bandMetres },
      howePavingInfillColor: { value: infillColor },
      howePavingBandColor: { value: bandColor },
    });
    shader.vertexShader = replaceOnce(
      shader.vertexShader,
      "#include <common>",
      "#include <common>\nvarying vec2 vHowePavingMetres;",
    );
    shader.vertexShader = replaceOnce(
      shader.vertexShader,
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvHowePavingMetres=uv;",
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <common>",
      `#include <common>
varying vec2 vHowePavingMetres;
uniform float howePavingModule;
uniform float howePavingBand;
uniform vec3 howePavingInfillColor;
uniform vec3 howePavingBandColor;
${HOWE_STATION_PAVING_COVERAGE_GLSL}
// xy = filtered band/joint coverage, z = restrained cell variation in [-.5,.5].
vec3 howePavingFinish(vec2 p) {
  vec2 footprint=max(fwidth(p),vec2(.00001));
  vec2 bands=vec2(howeStripeCoverage(p.x,howePavingModule,howePavingBand,footprint.x),howeStripeCoverage(p.y,howePavingModule,howePavingBand,footprint.y));
  float halfBand=howePavingBand*.5;
  vec2 seams=vec2(
    howeStripeCoverage(p.x-halfBand,howePavingModule,.006,footprint.x)+howeStripeCoverage(p.x+halfBand,howePavingModule,.006,footprint.x),
    howeStripeCoverage(p.y-halfBand,howePavingModule,.006,footprint.y)+howeStripeCoverage(p.y+halfBand,howePavingModule,.006,footprint.y));
  float joint=clamp(seams.x*(1.0-bands.y)+seams.y*(1.0-bands.x),0.0,1.0);
  vec2 cell=floor((p-halfBand)/howePavingModule);
  float variation=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453)-.5;
  // Cell colour disappears into its average before its footprint is subpixel.
  variation*=1.0-smoothstep(howePavingModule*.4,howePavingModule,max(footprint.x,footprint.y));
  return vec3(bands.x+bands.y-bands.x*bands.y,joint,variation);
}
// Analytic millimetre groove gradient at infill/band boundaries. The real mesh
// remains unchanged; do not differentiate fwidth-filtered signals a second time.
vec2 howePavingJointSlope(vec2 p) {
  vec2 centered=mod(p+howePavingModule*.5,howePavingModule)-howePavingModule*.5;
  vec2 edge=abs(centered)-howePavingBand*.5;
  vec2 distanceToJoint=abs(edge);
  if(edge.y<0.0) distanceToJoint.x=1e6;
  if(edge.x<0.0) distanceToJoint.y=1e6;
  float jointDistance=min(distanceToJoint.x,distanceToJoint.y);
  float t=clamp((jointDistance-.003)/.008,0.0,1.0);
  float slope=.0015*6.0*t*(1.0-t)/.008;
  vec2 direction=sign(edge)*sign(centered);
  return distanceToJoint.x<distanceToJoint.y?vec2(direction.x*slope,0.0):vec2(0.0,direction.y*slope);
}`,
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <map_fragment>",
      `#include <map_fragment>
vec3 howeFinish=howePavingFinish(vHowePavingMetres);
vec3 howePigment=mix(howePavingInfillColor*(1.0+howeFinish.z*.05),howePavingBandColor,howeFinish.x);
diffuseColor.rgb*=howePigment*(1.0-howeFinish.y*.16);`,
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+howeFinish.z*.035*(1.0-howeFinish.x)+howeFinish.y*.03,.76,.9);`,
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
vec3 howeDx=dFdx(-vViewPosition),howeDy=dFdy(-vViewPosition);
vec3 howeR1=cross(howeDy,normal),howeR2=cross(normal,howeDx);
float howeDet=dot(howeDx,howeR1);
vec2 howeSlope=howePavingJointSlope(vHowePavingMetres);
float howeFade=min(1.0,.016/max(length(fwidth(vHowePavingMetres)),.0001));
vec3 howeGradient=sign(howeDet)*howeFade*(dot(howeSlope,dFdx(vHowePavingMetres))*howeR1+dot(howeSlope,dFdy(vHowePavingMetres))*howeR2);
if(abs(howeDet)>1e-8)normal=normalize(abs(howeDet)*normal-howeGradient);`,
    );
  };
  // Custom shader remains on this unique field material's single merged chunk.
  // No eligibility override is made for the shared static batching system.
  field.customProgramCacheKey = () => "howe-station-source-square-paving-v1";
  return { field, border };
}
