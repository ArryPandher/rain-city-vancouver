import * as T from "three";
import type { Materials } from "./materials";
import {
  createCanadaPlaceConcourseExtinctionPair,
  createCanadaPlaceConcourseExtinctionMesh,
} from "./canada-place-concourse-glass";
import { createRobsonRinkExteriorGeometry } from "./robson-rink-exterior";

export function createRobsonRinkMaterials(library: Pick<Materials, "texture">) {
  const own = (name: string, color = false) => {
    const texture = library.texture(`cast-concrete/${name}.jpg`, color).clone();
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.setScalar(0.5);
    texture.updateMatrix();
    return texture;
  };
  const map = own("color", true),
    normalMap = own("normal");
  const concrete = new T.MeshStandardMaterial({
    name: "Robson rink — concrete edge and well",
    map,
    normalMap,
    normalScale: new T.Vector2(0.16, 0.16),
    color: 0xaaa79d,
    roughness: 0.94,
  });
  let disposed = false;
  concrete.addEventListener("dispose", () => {
    if (!disposed) {
      map.dispose();
      normalMap.dispose();
      disposed = true;
    }
  });
  const steel = new T.MeshStandardMaterial({
    name: "Robson rink — stainless ribs and guards",
    color: 0xb8c0c0,
    metalness: 0.82,
    roughness: 0.32,
    envMapIntensity: 0.8,
  });
  const glassPair = createCanadaPlaceConcourseExtinctionPair();
  glassPair.attenuation.name = "Robson rink — glass attenuation";
  glassPair.attenuation.uniforms.sheetThroughput.value.set(0.88, 0.93, 0.94);
  glassPair.attenuation.uniforms.sheetIor.value = 1.5;
  glassPair.reflection.name = "Robson rink — glass reflection";
  glassPair.reflection.ior = 1.5;
  glassPair.reflection.roughness = 0.09;
  glassPair.reflection.envMapIntensity = 0.85;
  return { concrete, steel, glassPair };
}

/** Uses the scene environment; no capture, emission or refraction render pass.
 * Keep glass groups on their single mesh, outside static material batching. */
export function createRobsonRinkExteriorMeshes(
  library: Pick<Materials, "texture">,
): T.Mesh[] {
  const geometry = createRobsonRinkExteriorGeometry(),
    materials = createRobsonRinkMaterials(library);
  const concrete = new T.Mesh(geometry.concrete, materials.concrete),
    steel = new T.Mesh(geometry.steel, materials.steel);
  concrete.name = "robson-rink-concrete";
  steel.name = "robson-rink-steel";
  concrete.castShadow =
    concrete.receiveShadow =
    steel.castShadow =
    steel.receiveShadow =
      true;
  geometry.glass.setIndex(
    Array.from(
      { length: geometry.glass.getAttribute("position").count },
      (_, i) => i,
    ),
  );
  const glass = createCanadaPlaceConcourseExtinctionMesh(
    geometry.glass,
    materials.glassPair,
  );
  glass.name = "robson-rink-glass";
  geometry.glass.dispose();
  concrete.userData.robsonRink = geometry.stats;
  return [concrete, steel, glass];
}
