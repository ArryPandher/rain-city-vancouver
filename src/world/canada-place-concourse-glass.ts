import * as T from "three";

/** Historical alpha comparison over closed architectural lining.
 * The existing harbour probe supplies reflections; no refraction capture is
 * requested. Do not apply to unbacked end caps or duplicate pane layers.
 */
export function createCanadaPlaceConcourseGlass() {
  const glass = new T.MeshPhysicalMaterial({
    name: "canada-west-glass",
    color: 0x78998b,
    metalness: 0,
    roughness: 0.21,
    ior: 1.5,
    specularIntensity: 1,
    specularColor: 0xffffff,
    clearcoat: 0,
    transmission: 0,
    envMapIntensity: 0.8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: T.FrontSide,
  });
  glass.userData.castShadow = false;
  glass.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `// Alpha compositing approximates reduced visibility at grazing angles.
// MeshPhysicalMaterial separately supplies dielectric specular Fresnel.
float concourseFacing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
float concourseGrazing=pow(1.0-concourseFacing,5.0);
diffuseColor.a=mix(opacity,0.96,concourseGrazing);
#include <opaque_fragment>`,
    );
  };
  glass.customProgramCacheKey = () => "canada-place-concourse-thin-sheet-v1";
  return glass;
}

/** Controlled candidate, not the default: reflection plus neutral extinction.
 * 0.88 is an authored normal-path transmittance estimate, not a measurement.
 * Requires linear HDR compositing before OutputPass, as used by main.ts.
 */
export function createCanadaPlaceConcourseReflectionCandidate() {
  const glass = createCanadaPlaceConcourseGlass();
  glass.blending = T.CustomBlending;
  glass.blendEquation = T.AddEquation;
  glass.blendSrc = T.OneFactor;
  glass.blendDst = T.OneMinusSrcAlphaFactor;
  glass.blendEquationAlpha = T.AddEquation;
  glass.blendSrcAlpha = T.OneFactor;
  glass.blendDstAlpha = T.OneMinusSrcAlphaFactor;
  // RGB already contains reflected radiance; do not premultiply it by coverage.
  glass.premultipliedAlpha = false;
  glass.opacity = 1;
  glass.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `// Standard physical BRDF supplies reflection, without diffuse paint.
float sheetFacing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
float sheetF0=pow((ior-1.0)/(ior+1.0),2.0);
float sheetF=sheetF0+(1.0-sheetF0)*pow(1.0-sheetFacing,5.0);
float sheetTransmittance=0.88*(1.0-sheetF);
outgoingLight=totalSpecular;
diffuseColor.a=1.0-sheetTransmittance;
#include <opaque_fragment>`,
    );
  };
  glass.customProgramCacheKey = () =>
    "canada-place-concourse-reflection-candidate-v1";
  return glass;
}

/** Linear channel throughput estimate, excluding Fresnel reflection. */
export const CANADA_PLACE_LINEAR_THROUGHPUT = [0.62, 0.88, 0.76] as const;

export function createCanadaPlaceConcourseExtinctionPair() {
  const attenuation = new T.ShaderMaterial({
    name: "canada-west-glass-attenuation",
    uniforms: {
      sheetThroughput: {
        value: new T.Vector3(...CANADA_PLACE_LINEAR_THROUGHPUT),
      },
      sheetIor: { value: 1.5 },
    },
    vertexShader: `varying vec3 sheetNormal;
varying vec3 sheetView;
void main(){
 vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
 sheetNormal=normalMatrix*normal;
 sheetView=-viewPosition.xyz;
 gl_Position=projectionMatrix*viewPosition;
}`,
    fragmentShader: `uniform vec3 sheetThroughput;
uniform float sheetIor;
varying vec3 sheetNormal;
varying vec3 sheetView;
void main(){
 float facing=clamp(dot(normalize(sheetNormal),normalize(sheetView)),0.0,1.0);
 float f0=pow((sheetIor-1.0)/(sheetIor+1.0),2.0);
 float fresnel=f0+(1.0-f0)*pow(1.0-facing,5.0);
 gl_FragColor=vec4(sheetThroughput*(1.0-fresnel),0.0);
}`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: T.FrontSide,
    fog: false,
    toneMapped: false,
    blending: T.CustomBlending,
    blendEquation: T.AddEquation,
    blendSrc: T.ZeroFactor,
    blendDst: T.SrcColorFactor,
    blendEquationAlpha: T.AddEquation,
    blendSrcAlpha: T.ZeroFactor,
    blendDstAlpha: T.OneFactor,
  });
  attenuation.userData.castShadow = false;
  const reflection = createCanadaPlaceConcourseReflectionCandidate();
  reflection.name = "canada-west-glass";
  reflection.roughness = 0.12;
  reflection.blendSrc = T.OneFactor;
  reflection.blendDst = T.OneFactor;
  reflection.blendSrcAlpha = T.ZeroFactor;
  reflection.blendDstAlpha = T.OneFactor;
  // Standard fog mixes in fogColour: additive reflection must not add that
  // colour over a destination that already contains atmospheric scattering.
  reflection.fog = false;
  reflection.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "outgoingLight=totalSpecular;\ndiffuseColor.a=0.0;\n#include <opaque_fragment>",
    );
  };
  reflection.customProgramCacheKey = () =>
    "canada-place-concourse-rgb-reflection-v1";
  return { attenuation, reflection };
}

/** One indexed tier, two ordered draws. Geometry is cloned so the caller's
 * original groups remain untouched. Share the pair across tiers, not geometry.
 * Do not flatten these groups through a material-based static batcher.
 */
export function createCanadaPlaceConcourseExtinctionMesh(
  geometry: T.BufferGeometry,
  pair: ReturnType<typeof createCanadaPlaceConcourseExtinctionPair>,
) {
  if (!geometry.index)
    throw new Error("Concourse extinction requires indexed geometry");
  const grouped = geometry.clone();
  grouped.clearGroups();
  grouped.addGroup(0, geometry.index.count, 0);
  grouped.addGroup(0, geometry.index.count, 1);
  const mesh = new T.Mesh(grouped, [pair.attenuation, pair.reflection]);
  mesh.name = "canada-west-glass";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.allowShadow = false;
  return mesh;
}

/** Integration convenience: owns a fresh material pair for one glass tier. */
export function createCanadaPlaceConcourseRgbMesh(geometry: T.BufferGeometry) {
  return createCanadaPlaceConcourseExtinctionMesh(
    geometry,
    createCanadaPlaceConcourseExtinctionPair(),
  );
}
