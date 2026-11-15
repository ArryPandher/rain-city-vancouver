import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

/** Existing CC0 mineral maps, with independent samplers. Reference photographs
 * are research only. Optional environment is borrowed, never captured/disposed. */
export function createHoweStationPavilionMaterials(
  library: Pick<Materials, "texture">,
  environment?: T.Texture,
) {
  const mineral = (name: string, color: boolean) => {
    const texture = library
      .texture(`canada-place-plinth/${name}.webp`, color)
      .clone();
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.setScalar(0.6);
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.updateMatrix();
    return texture;
  };
  const glass = createExteriorLobbyGlass(
    "Howe station clear barrel-vault glazing",
    0.97,
    2,
  );
  glass.roughness = 0.065;
  glass.envMap = environment ?? null;
  const metal = new T.MeshStandardMaterial({
    name: "Howe station satin silver framing",
    color: 0xc7cbc9,
    metalness: 0.42,
    roughness: 0.34,
    envMap: environment ?? null,
  });
  return {
    stone: new T.MeshStandardMaterial({
      name: "Howe station pale mineral base and stair treads",
      color: 0xb9b8ae,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      roughnessMap: mineral("roughness", false),
      normalScale: new T.Vector2(0.16, 0.16),
      roughness: 0.92,
    }),
    lining: new T.MeshStandardMaterial({
      name: "Howe station closed stairwell lining",
      color: 0x535d59,
      roughness: 0.82,
      metalness: 0,
    }),
    metal,
    gasket: new T.MeshStandardMaterial({
      name: "Howe station dark resilient glazing seals",
      color: 0x303735,
      metalness: 0,
      roughness: 0.88,
    }),
    glass,
    signBlue: new T.MeshStandardMaterial({
      name: "Howe station blue transit blades",
      color: 0x12528a,
      roughness: 0.48,
      metalness: 0.05,
    }),
    signWhite: new T.MeshStandardMaterial({
      name: "Howe station white transit T",
      color: 0xe8eef0,
      roughness: 0.58,
    }),
  };
}
export type HoweStationPavilionMaterials = ReturnType<
  typeof createHoweStationPavilionMaterials
>;
