import * as T from "three";
import type { Materials } from "./materials";
export function createFairmontWaterfrontMaterials(
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
  // One thin, lightly tinted roof sheet; the frame casts the grille shadow.
  const canopyGlass = new T.MeshPhysicalMaterial({
    name: "Fairmont Waterfront transparent canopy roof",
    color: 0xe3eeeb,
    metalness: 0,
    roughness: 0.12,
    ior: 1.5,
    transmission: 0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: T.DoubleSide,
    envMapIntensity: 0.9,
  });
  canopyGlass.forceSinglePass = true;
  canopyGlass.userData.castShadow = false;
  return {
    canopyGlass,
    panel: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront pale panel grid",
      color: 0xd4d8d4,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      normalScale: new T.Vector2(0.06, 0.06),
      roughness: 0.64,
      metalness: 0.12,
    }),
    glass: new T.MeshPhysicalMaterial({
      name: "Fairmont Waterfront blue reflective glazing",
      color: 0x769caf,
      metalness: 0.52,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.9,
    }),
    metal: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront silver window frames",
      color: 0xb9c5cc,
      metalness: 0.78,
      roughness: 0.26,
    }),
    dark: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront closed window backing",
      color: 0x1d2b35,
      roughness: 0.77,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront roof membrane",
      color: 0x747a79,
      roughness: 0.9,
    }),
    soil: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront terrace soil",
      color: 0x35362b,
      roughness: 1,
    }),
    foliage: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront planted terrace masses",
      color: 0x526b47,
      roughness: 0.96,
    }),
  };
}
export type FairmontWaterfrontMaterials = ReturnType<
  typeof createFairmontWaterfrontMaterials
>;
