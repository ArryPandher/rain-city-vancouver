import * as T from "three";
import type { Materials } from "./materials";

export type LandmarkSurface = "brick" | "mineral" | "patina";
export interface SurfaceProfile {
  surface: LandmarkSurface;
  metres: [number, number];
  roughness: number;
  normalStrength: number;
  metalness: number;
  color?: number;
  joints?: [number, number, number, number, number?];
}

/** Interpret named model materials using the documented material of each site. */
export function landmarkSurfaceProfile(
  id: string,
  name: string,
): SurfaceProfile | undefined {
  name = name.toLowerCase();
  if (name === "brick")
    return {
      surface: "brick",
      metres: [1.4, 1.4],
      roughness: 0.94,
      normalStrength: 0.65,
      metalness: 0,
      color:
        id === "waterfront-station-vancouver"
          ? 0xeeb7a7
          : id === "marine-building"
            ? 0xddd0b7
            : 0xeeeeee,
    };
  if (name === "copper")
    return {
      surface: "patina",
      metres: [2, 2],
      roughness: 0.88,
      normalStrength: 0.17,
      metalness: 0.15,
    };
  const terracotta =
    (id === "waterfront-station-vancouver" && name === "stone") ||
    (id === "marine-building" && ["stone", "green"].includes(name));
  const precast =
    name === "concrete" ||
    (id === "vancouver-public-library" && name === "stone") ||
    (id === "harbour-centre" && ["heritage", "sill"].includes(name));
  const stone =
    ["stone", "foundation", "trim", "granite"].includes(name) ||
    (id === "waterfront-station-vancouver" && name === "base");
  if (terracotta || precast || stone)
    return {
      surface: "mineral",
      metres: [1, 1],
      roughness: terracotta ? 0.67 : 0.92,
      normalStrength: terracotta
        ? 0.08
        : name === "foundation"
          ? 0.34
          : precast
            ? 0.19
            : 0.15,
      metalness: 0,
      color:
        id === "waterfront-station-vancouver" && name === "stone"
          ? 0xc3b9a3
          : undefined,
      joints:
        id === "vancouver-art-gallery"
          ? name === "foundation"
            ? [1.15, 0.52, 0.008, 0.008]
            : [1.2, 0.55, 0.004, 0.003]
          : id === "fairmont-hotel-vancouver"
            ? [1.15, 0.5, 0.006, 0.004]
            : id === "waterfront-station-vancouver"
              ? [0.9, 0.48, 0.004, 0.002]
              : id === "marine-building"
                ? [0.65, 0.45, 0.004, 0.002]
                : id === "canada-place"
                  ? [1.15, 1.4, 0.006, 0.002, 0]
                  : id === "vancouver-public-library"
                    ? [3, 3.6, 0.008, 0.003, 0]
                    : undefined,
    };
  return undefined;
}

/** Metric tangent-plane coordinates keep horizontal brick courses on rotated
 * façades without the old dominant-axis compression. Sloping faces retain scale. */
export function landmarkSurfaceUV(
  geometry: T.BufferGeometry,
  metres: [number, number],
) {
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal");
  const uv = new Float32Array(position.count * 2);
  const n = new T.Vector3(),
    tangent = new T.Vector3(),
    bitangent = new T.Vector3(),
    p = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    n.fromBufferAttribute(normal, i).normalize();
    if (Math.abs(n.y) < 0.999) tangent.set(n.z, 0, -n.x).normalize();
    else tangent.set(1, 0, 0);
    bitangent.crossVectors(n, tangent).normalize();
    p.fromBufferAttribute(position, i);
    uv[i * 2] = p.dot(tangent) / metres[0];
    uv[i * 2 + 1] = p.dot(bitangent) / metres[1];
  }
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
  // Fresh metric UVs need a matching derivative tangent basis.
  geometry.deleteAttribute("tangent");
}

interface SurfaceMaps {
  color: T.Texture;
  normal: T.Texture;
  roughness: T.Texture;
}
export class LandmarkSurfaces {
  private maps = new Map<LandmarkSurface, SurfaceMaps>();
  constructor(private materials: Materials) {}
  material(original: T.MeshStandardMaterial, id: string) {
    const material = original.clone(),
      name = material.name.toLowerCase();
    const profile = landmarkSurfaceProfile(id, name);
    if (profile) {
      let maps = this.maps.get(profile.surface);
      if (!maps) {
        maps = {
          color: this.materials.texture(
            `landmarks/${profile.surface}-color.webp`,
            true,
          ),
          normal: this.materials.texture(
            `landmarks/${profile.surface}-normal.webp`,
          ),
          roughness: this.materials.texture(
            `landmarks/${profile.surface}-roughness.webp`,
          ),
        };
        this.maps.set(profile.surface, maps);
      }
      material.map = maps.color;
      material.normalMap = maps.normal;
      material.roughnessMap = maps.roughness;
      material.normalScale.set(profile.normalStrength, profile.normalStrength);
      material.roughness = profile.roughness;
      material.metalness = profile.metalness;
      if (profile.color !== undefined) material.color.setHex(profile.color);
      else {
        material.color.multiplyScalar(1.16);
        material.color.setRGB(
          Math.min(1, material.color.r),
          Math.min(1, material.color.g),
          Math.min(1, material.color.b),
        );
      }
      material.userData.landmarkSurface = profile.surface;
      if (profile.joints) stoneJoints(material, profile.joints);
    } else if (/glass/.test(name)) {
      material.metalness = 0.58;
      material.roughness = 0.18;
      material.envMapIntensity = 1.25;
    } else if (/steel|bronze|metal/.test(name)) {
      material.metalness = 0.55;
      material.roughness = 0.36;
    } else if (/fabric/.test(name)) {
      material.roughness = 0.78;
      material.side = T.DoubleSide;
    }
    if (/glow/.test(name)) {
      material.emissive.copy(material.color);
      material.emissiveIntensity = 0.18;
    }
    material.userData.landmarkId = id;
    return material;
  }
}

/** Authored block/panel courses over photographed mineral detail. Distances are
 * metres and relief is millimetres; footprint filtering keeps far joints stable. */
function stoneJoints(
  material: T.MeshStandardMaterial,
  joints: [number, number, number, number, number?],
) {
  material.userData.landmarkJoints = joints;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.landmarkJoints = {
      value: new T.Vector4(joints[0], joints[1], joints[2], joints[3]),
    };
    shader.uniforms.landmarkStagger = { value: joints[4] ?? 0.5 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vLandmarkVertical;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvLandmarkVertical=1.0-abs(normal.y);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vLandmarkVertical;
uniform vec4 landmarkJoints;
uniform float landmarkStagger;
vec3 landmarkBlock(vec2 metres){
  float row=floor(metres.y/landmarkJoints.y);
  vec2 cell=vec2(metres.x+mod(row,2.0)*landmarkJoints.x*landmarkStagger,metres.y)/landmarkJoints.xy;
  vec2 edge=min(fract(cell),1.0-fract(cell))*landmarkJoints.xy;
  float footprint=max(length(fwidth(metres)),.0001);
  float seam=(1.0-smoothstep(landmarkJoints.z*.5,landmarkJoints.z*.5+footprint*.5,min(edge.x,edge.y)))*min(1.0,landmarkJoints.z/footprint)*smoothstep(.75,.95,vLandmarkVertical);
  float variation=fract(sin(dot(floor(cell),vec2(127.1,311.7)))*43758.5453);
  return vec3(seam,variation,-seam*landmarkJoints.w);
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec3 blockDetail=landmarkBlock(vMapUv);
diffuseColor.rgb*=mix(.98,1.02,blockDetail.y)*(1.0-blockDetail.x*.22);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 surfaceDx=dFdx(-vViewPosition),surfaceDy=dFdy(-vViewPosition);
vec3 reliefR1=cross(surfaceDy,normal),reliefR2=cross(normal,surfaceDx);
float reliefDet=dot(surfaceDx,reliefR1);
vec3 reliefGradient=sign(reliefDet)*(dFdx(blockDetail.z)*reliefR1+dFdy(blockDetail.z)*reliefR2);
if(abs(reliefDet)>1e-8) normal=normalize(abs(reliefDet)*normal-reliefGradient);`,
      );
  };
  material.customProgramCacheKey = () => "landmark-stone-courses-v1";
}
