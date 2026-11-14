import * as T from "three";
import { BASE } from "./materials";

/** A room box behind each pane supplies parallax without opening the collision shell. */
export function shopInteriorMaterials() {
  return ["comfy_cafe", "decor_shop", "phone_shop"].map((id, index) => {
    const panorama = new T.TextureLoader().load(
      `${BASE}textures/interiors/${id}.webp`,
    );
    panorama.colorSpace = T.SRGBColorSpace;
    panorama.wrapS = T.RepeatWrapping;
    panorama.anisotropy = 8;
    const material = new T.MeshPhysicalMaterial({
      name: `Photographed shop interior: ${id}`,
      color: 0x101719,
      roughness: 0.2,
      metalness: 0,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.45,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.roomPanorama = { value: panorama };
      // Orient the retail panorama toward its shelves rather than its street exit.
      shader.uniforms.roomRotation = { value: [0.12, 0.05, 0.25][index] };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute vec3 roomSize;
          varying vec2 vRoomUV;
          varying vec3 vRoomSize;
          varying vec3 vRoomWorld;
          varying vec3 vRoomNormal;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vRoomUV = uv;
          vRoomSize = roomSize;
          vRoomWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          vRoomNormal = normalize(mat3(modelMatrix) * normal);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform sampler2D roomPanorama;
          uniform float roomRotation;
          varying vec2 vRoomUV;
          varying vec3 vRoomSize;
          varying vec3 vRoomWorld;
          varying vec3 vRoomNormal;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          vec3 outward = normalize(vRoomNormal);
          vec3 right = vec3(outward.z, 0.0, -outward.x);
          vec3 viewRay = vRoomWorld - cameraPosition;
          vec3 direction = vec3(dot(viewRay, right), viewRay.y, -dot(viewRay, outward));
          direction /= vRoomSize * 0.5;
          // Parallel rays use a finite reciprocal; this also avoids NaNs at pane centres.
          vec3 safeDirection = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), direction)) * max(abs(direction), vec3(0.00001));
          vec3 origin = vec3(vRoomUV * 2.0 - 1.0, -1.0);
          vec3 exitDistance = (sign(safeDirection) - origin) / safeDirection;
          float travel = min(min(exitDistance.x, exitDistance.y), exitDistance.z);
          vec3 hit = origin + direction * max(travel, 0.0);
          vec3 lookup = normalize(hit);
          vec2 panoramaUV = vec2(atan(lookup.x, lookup.z) / (2.0 * PI) + 0.5 + roomRotation, asin(clamp(lookup.y, -1.0, 1.0)) / PI + 0.5);
          vec3 interior = texture2D(roomPanorama, panoramaUV).rgb;
          float facing = clamp(dot(normalize(cameraPosition - vRoomWorld), outward), 0.0, 1.0);
          float glassTransmission = 0.58 * (1.0 - 0.65 * pow(1.0 - facing, 5.0));
          totalEmissiveRadiance += interior * glassTransmission;`,
        );
    };
    material.customProgramCacheKey = () => "rain-city-interior-box-v1";
    return material;
  });
}

export function shopWindow(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  angle: number,
  depth = 6,
) {
  const geometry = new T.PlaneGeometry(width, height);
  geometry.rotateY(angle);
  geometry.translate(x, y, z);
  geometry.setAttribute(
    "roomSize",
    new T.Float32BufferAttribute(
      Array.from({ length: 4 }, () => [width, height, depth]).flat(),
      3,
    ),
  );
  return geometry;
}
