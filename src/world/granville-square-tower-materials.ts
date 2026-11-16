import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

/** Mineral finish and coated-window approximation, not sampled photo textures.
 * The substantial facade structure belongs to geometry, not a painted grid. */
export function createGranvilleSquareTowerMaterials(
  library: Pick<Materials, "texture">,
) {
  const mineral = (kind: string, color: boolean) => {
    const t = library
      .texture(`canada-place-plinth/${kind}.webp`, color)
      .clone();
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.setScalar(0.5);
    t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    t.updateMatrix();
    return t;
  };
  return {
    concrete: new T.MeshStandardMaterial({
      name: "Granville Square pale precast",
      color: 0xd1c9b6,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      roughnessMap: mineral("roughness", false),
      normalScale: new T.Vector2(0.09, 0.09),
      roughness: 1,
      metalness: 0,
    }),
    frame: new T.MeshStandardMaterial({
      name: "Granville Square muted bronze frames and louvers",
      color: 0x625f51,
      metalness: 0.3,
      roughness: 0.48,
    }),
    glass: new T.MeshPhysicalMaterial({
      name: "Granville Square recessed coated office glass",
      color: 0x263c3d,
      metalness: 0,
      roughness: 0.13,
      ior: 1.8,
      clearcoat: 0,
      envMapIntensity: 0.8,
    }),
    lobbyGlass: createExteriorLobbyGlass(
      "Granville Square closed base glazing",
      0.84,
    ),
    backing: new T.MeshStandardMaterial({
      name: "Granville Square cavity lining",
      color: 0x434a46,
      metalness: 0,
      roughness: 0.91,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Granville Square roof membrane",
      color: 0x77776c,
      metalness: 0,
      roughness: 0.92,
    }),
  };
}
export type GranvilleSquareTowerMaterials = ReturnType<
  typeof createGranvilleSquareTowerMaterials
>;
