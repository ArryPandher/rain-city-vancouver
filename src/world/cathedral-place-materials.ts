import { addCathedralStonePanels } from "./cathedral-place-stone";
import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

/** Owner photographs establish pale warm stone, bluegreen coated glazing and
 * a bluegreen metal crown. These are daylight estimates, not sampled textures. */
export function createCathedralPlaceMaterials(
  library: Pick<Materials, "texture">,
) {
  const mineral = (kind: string, color: boolean) => {
    const map = library
      .texture(`canada-place-plinth/${kind}.webp`, color)
      .clone();
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(0.5);
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.updateMatrix();
    return map;
  };
  const glass = createExteriorLobbyGlass(
    "Cathedral Place bluegreen glazing",
    0.79,
    2,
  );
  glass.ior = 1.65;
  glass.roughness = 0.15;
  glass.envMapIntensity = 0.85;
  return {
    stone: addCathedralStonePanels(
      new T.MeshStandardMaterial({
        name: "Cathedral Place pale limestone",
        color: 0xd2cdc1,
        map: mineral("color", true),
        normalMap: mineral("normal", false),
        roughnessMap: mineral("roughness", false),
        normalScale: new T.Vector2(0.08, 0.08),
        roughness: 0.94,
      }),
    ),
    frame: new T.MeshStandardMaterial({
      name: "Cathedral Place bluegreen metal frames",
      color: 0x63858b,
      metalness: 0.5,
      roughness: 0.36,
    }),
    backing: new T.MeshStandardMaterial({
      name: "Cathedral Place closed bluegreen cavities",
      color: 0x344d54,
      roughness: 0.9,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Cathedral Place bluegreen crown",
      color: 0x54898b,
      metalness: 0.45,
      roughness: 0.5,
    }),
    glass,
  };
}
export type CathedralPlaceMaterials = ReturnType<
  typeof createCathedralPlaceMaterials
>;
