import * as T from "three";

/** Owner daylight corner photograph: aligned cut-stone panels, not staggered
 * brickwork. Dimensions/reflectance are bounded visual estimates, not a survey. */
export const CATHEDRAL_STONE_PANELS = {
  width: 1.1,
  height: 0.95,
  seam: 0.006,
  relief: 0.002,
  jointDarkening: 0.18,
  albedoRange: [0.94, 1.04] as const,
  roughnessVariation: 0.025,
} as const;

/** Uses the facade's original metric UVs. Batcher applies grade to positions;
 * UVs remain in authored metres, so no model/batchingMatrix is applied a second
 * time. Horizontal caps and soffits keep their mineral finish. */
export function addCathedralStonePanels(material: T.MeshStandardMaterial) {
  if (material.name !== "Cathedral Place pale limestone") return material;
  if (material.userData.cathedralStonePanels) return material;
  const q = CATHEDRAL_STONE_PANELS,
    previous = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.userData.cathedralStonePanels = q;
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.cathedralPanelSize = {
      value: new T.Vector4(q.width, q.height, q.seam, q.relief),
    };
    shader.uniforms.cathedralPanelAlbedo = {
      value: new T.Vector2(...q.albedoRange),
    };
    shader.uniforms.cathedralPanelRoughness = { value: q.roughnessVariation };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vCathedralPanelMetres;
varying float vCathedralPanelVertical;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
// Raw authored metric UVs: independent of the mineral map's repeat matrix.
vCathedralPanelMetres=uv;
vCathedralPanelVertical=1.0-abs(inverseTransformDirection(transformedNormal,viewMatrix).y);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vCathedralPanelMetres;
varying float vCathedralPanelVertical;
uniform vec4 cathedralPanelSize;
uniform vec2 cathedralPanelAlbedo;
uniform float cathedralPanelRoughness;
float cathedralPanelValue(vec2 id){return fract(sin(dot(id,vec2(127.1,311.7)))*43758.5453123);}
float cathedralJointCoverage(vec2 metres){
  vec2 cell=metres/cathedralPanelSize.xy;
  vec2 edge=min(fract(cell),1.0-fract(cell))*cathedralPanelSize.xy;
  vec2 pixel=max(fwidth(metres),vec2(.0001));
  // Integrate narrow joints into their pixel footprint instead of widening
  // the authored six-millimetre seam when the building becomes distant.
  vec2 seam=(1.0-smoothstep(vec2(cathedralPanelSize.z*.5),vec2(cathedralPanelSize.z*.5)+pixel*.5,edge))*min(vec2(1.0),cathedralPanelSize.z/pixel);
  return max(seam.x,seam.y);
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
float cathedralVertical=smoothstep(.85,.97,vCathedralPanelVertical);
vec2 cathedralCell=vCathedralPanelMetres/cathedralPanelSize.xy;
vec2 cathedralFootprint=fwidth(cathedralCell);
float cathedralReadable=1.0-smoothstep(.55,1.5,max(cathedralFootprint.x,cathedralFootprint.y));
float cathedralBlock=cathedralPanelValue(floor(cathedralCell));
float cathedralJoint=cathedralJointCoverage(vCathedralPanelMetres)*cathedralVertical;
float cathedralRelief=-cathedralJoint*cathedralPanelSize.w;
float cathedralTone=mix(cathedralPanelAlbedo.x,cathedralPanelAlbedo.y,cathedralBlock);
diffuseColor.rgb*=mix(1.0,cathedralTone,cathedralVertical*cathedralReadable)*(1.0-cathedralJoint*${q.jointDarkening.toFixed(3)});`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+(cathedralBlock-.5)*2.0*cathedralPanelRoughness*cathedralVertical*cathedralReadable,0.0,1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
// Shallow joint relief perturbs the existing mineral normal, not the mesh,
// silhouette, depth buffer or walking/camera contact.
vec3 cathedralDx=dFdx(-vViewPosition),cathedralDy=dFdy(-vViewPosition);
vec3 cathedralR1=cross(cathedralDy,normal),cathedralR2=cross(normal,cathedralDx);
float cathedralDet=dot(cathedralDx,cathedralR1);
vec3 cathedralGradient=sign(cathedralDet)*(dFdx(cathedralRelief)*cathedralR1+dFdy(cathedralRelief)*cathedralR2);
if(abs(cathedralDet)>1e-8)normal=normalize(abs(cathedralDet)*normal-cathedralGradient);`,
      );
  };
  material.customProgramCacheKey = () => `${key}:cathedral-cut-stone-v1`;
  return material;
}
