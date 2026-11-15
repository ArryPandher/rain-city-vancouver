import * as T from "three";

/** A thin dielectric sheet over real, closed lobby scenery. One linear-HDR
 * pass adds the physical BRDF reflection and attenuates the visible geometry
 * behind it. There is no diffuse paint layer or extra refraction render. */
export function createExteriorLobbyGlass(name: string, throughput = 0.82) {
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
outgoingLight=totalSpecular;
diffuseColor.a=1.0-lobbyThroughput*(1.0-lobbyF);
#include <opaque_fragment>`,
      );
  };
  glass.customProgramCacheKey = () => "exterior-lobby-dielectric-v1";
  return glass;
}
