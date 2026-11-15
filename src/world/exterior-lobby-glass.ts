import * as T from "three";

/** A thin dielectric sheet over real, closed lobby scenery. One linear-HDR
 * pass adds the physical BRDF reflection and attenuates the visible geometry
 * behind it. There is no diffuse paint layer or extra refraction render. */
export function createExteriorLobbyGlass(
  name: string,
  throughput = 0.82,
  interfaces: 1 | 2 = 1,
) {
  const glass = new T.MeshPhysicalMaterial({
    name,
    color: 0xffffff,
    metalness: 0,
    roughness: 0.12,
    ior: 1.5,
    specularIntensity: 1,
    clearcoat: 0,
    transmission: 0,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: T.FrontSide,
    envMapIntensity: 1,
    fog: false,
    blending: T.CustomBlending,
    blendEquation: T.AddEquation,
    blendSrc: T.OneFactor,
    blendDst: T.OneMinusSrcAlphaFactor,
    blendEquationAlpha: T.AddEquation,
    blendSrcAlpha: T.ZeroFactor,
    blendDstAlpha: T.OneFactor,
  });
  glass.userData.castShadow = false;
  glass.onBeforeCompile = (shader) => {
    shader.uniforms.lobbyThroughput = { value: throughput };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float lobbyThroughput;",
      )
      .replace(
        "#include <opaque_fragment>",
        `float lobbyFacing=clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);
float lobbyF0=pow((ior-1.0)/(ior+1.0),2.0);
float lobbyF=lobbyF0+(1.0-lobbyF0)*pow(1.0-lobbyFacing,5.0);
${
  interfaces === 2
    ? `// Incoherent thin slab: sum the internally reflected paths analytically.
// One-pass survival includes absorption. Schlick/view-angle compensation of
// the native rough BRDF is an approximation; no second alpha/refraction pass.
float lobbySurvival=clamp(lobbyThroughput,0.0,1.0);
float lobbyDenom=max(1.0-pow(lobbyF*lobbySurvival,2.0),0.00001);
float lobbyReflectionGain=1.0+pow((1.0-lobbyF)*lobbySurvival,2.0)/lobbyDenom;
float lobbyTransmission=pow(1.0-lobbyF,2.0)*lobbySurvival/lobbyDenom;
outgoingLight=totalSpecular*lobbyReflectionGain;
diffuseColor.a=1.0-lobbyTransmission;`
    : `outgoingLight=totalSpecular;
diffuseColor.a=1.0-lobbyThroughput*(1.0-lobbyF);`
}
#include <opaque_fragment>`,
      );
  };
  glass.customProgramCacheKey = () =>
    interfaces === 2
      ? "exterior-lobby-dielectric-slab-v1"
      : "exterior-lobby-dielectric-v1";
  return glass;
}
