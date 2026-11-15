import * as T from "three";
import type { Materials } from "./materials";

export type WaterfrontCentreMaterials = {
  glass: T.MeshPhysicalMaterial;
  spandrel: T.MeshStandardMaterial;
  metal: T.MeshStandardMaterial;
  stone: T.MeshStandardMaterial;
  dark: T.MeshStandardMaterial;
  roof: T.MeshStandardMaterial;
  soil: T.MeshStandardMaterial;
  foliage: T.MeshStandardMaterial;
};
/** Geometry supplies metre UVs on mineral surfaces, including box faces.
 * No pane pattern is baked into these textures: mullions/reveals are geometry. */
export const WATERFRONT_MINERAL_REPEAT_METRES = 2;
export function createWaterfrontCentreMaterials(
  library: Pick<Materials, "texture">,
): WaterfrontCentreMaterials {
  const texture = (name: string, color: boolean) => {
    // Own sampler state; never retile a texture belonging to another landmark.
    const map = library
      .texture(`canada-place-plinth/${name}.webp`, color)
      .clone();
    map.name = `Waterfront Centre — mineral ${name}`;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(1 / WATERFRONT_MINERAL_REPEAT_METRES);
    map.updateMatrix();
    return map;
  };
  return {
    // Opaque coated-glass proxy: keeps a closed exterior and one standard pass.
    // Metalness approximates the coating's strong colored environment response;
    // this is not a measured optical stack or an interior transmission model.
    glass: new T.MeshPhysicalMaterial({
      name: "Waterfront Centre — blue silver coated glass",
      color: 0x7894a7,
      metalness: 0.65,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      envMapIntensity: 0.9,
    }),
    spandrel: new T.MeshStandardMaterial({
      name: "Waterfront Centre — blue spandrel",
      color: 0x425767,
      metalness: 0.5,
      roughness: 0.24,
      envMapIntensity: 0.85,
    }),
    metal: new T.MeshStandardMaterial({
      name: "Waterfront Centre — silver mullions",
      color: 0xc8cdd0,
      metalness: 0.78,
      roughness: 0.28,
      envMapIntensity: 0.9,
    }),
    stone: new T.MeshStandardMaterial({
      name: "Waterfront Centre — pale mineral panels",
      color: 0xd6d5ca,
      map: texture("color", true),
      normalMap: texture("normal", false),
      roughnessMap: texture("roughness", false),
      roughness: 1,
      normalScale: new T.Vector2(0.22, 0.22),
      metalness: 0,
    }),
    dark: new T.MeshStandardMaterial({
      name: "Waterfront Centre — closed recess backing",
      color: 0x202a30,
      metalness: 0.05,
      roughness: 0.65,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Waterfront Centre — roof",
      color: 0x707778,
      roughness: 0.88,
    }),
    soil: new T.MeshStandardMaterial({
      name: "Waterfront Centre — planted ledge soil",
      color: 0x302d24,
      roughness: 1,
    }),
    foliage: new T.MeshStandardMaterial({
      name: "Waterfront Centre — planted ledges",
      color: 0x4b6040,
      roughness: 0.95,
    }),
  };
}
