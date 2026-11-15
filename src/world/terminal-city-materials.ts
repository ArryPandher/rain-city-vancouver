import * as T from "three";
import type { Materials } from "./materials";

export type TerminalCityMaterials = {
  glass: T.MeshPhysicalMaterial;
  spandrel: T.MeshStandardMaterial;
  metal: T.MeshStandardMaterial;
  stone: T.MeshStandardMaterial;
  dark: T.MeshStandardMaterial;
  roof: T.MeshStandardMaterial;
};
/** Generic fine mineral fallback, NOT a scan of Tyndall limestone.
 * Geometry supplies metre UVs on mineral surfaces, including box faces.
 * No pane pattern is baked into these textures: mullions/reveals are geometry. */
export const TERMINAL_CITY_MINERAL_REPEAT_METRES = 1.5;
export function createTerminalCityMaterials(
  library: Pick<Materials, "texture">,
): TerminalCityMaterials {
  const texture = (name: string, color: boolean) => {
    // Own sampler state; never retile a texture belonging to another landmark.
    const map = library
      .texture(`canada-place-plinth/${name}.webp`, color)
      .clone();
    map.name = `Terminal City — mineral ${name}`;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(1 / TERMINAL_CITY_MINERAL_REPEAT_METRES);
    map.updateMatrix();
    return map;
  };
  return {
    // Opaque coated-glass proxy: keeps a closed exterior and one standard pass.
    // Metalness approximates the coating's strong colored environment response;
    // this is not a measured optical stack or an interior transmission model.
    glass: new T.MeshPhysicalMaterial({
      name: "Terminal City — blue green coated glass",
      color: 0x719991,
      metalness: 0.65,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      envMapIntensity: 0.9,
    }),
    spandrel: new T.MeshStandardMaterial({
      name: "Terminal City — blue spandrel",
      color: 0x3e5956,
      metalness: 0.5,
      roughness: 0.24,
      envMapIntensity: 0.85,
    }),
    metal: new T.MeshStandardMaterial({
      name: "Terminal City — silver mullions",
      color: 0xc8ceca,
      metalness: 0.78,
      roughness: 0.28,
      envMapIntensity: 0.9,
    }),
    stone: new T.MeshStandardMaterial({
      name: "Terminal City — warm mineral cladding approximation",
      color: 0xd9ceb5,
      map: texture("color", true),
      normalMap: texture("normal", false),
      roughnessMap: texture("roughness", false),
      roughness: 0.92,
      normalScale: new T.Vector2(0.2, 0.2),
      metalness: 0,
    }),
    dark: new T.MeshStandardMaterial({
      name: "Terminal City — closed recess backing",
      color: 0x202a30,
      metalness: 0.05,
      roughness: 0.65,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Terminal City — roof",
      color: 0x707778,
      roughness: 0.88,
    }),
  };
}
