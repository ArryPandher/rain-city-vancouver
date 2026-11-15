import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

/** Existing CC0 mineral maps; source photography is never used as a texture. */
export function createPwcPlaceMaterials(library: Pick<Materials, "texture">) {
  const mineral = (name: string, color: boolean) => {
    const t = library
      .texture(`canada-place-plinth/${name}.webp`, color)
      .clone();
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.setScalar(0.5);
    t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    t.updateMatrix();
    return t;
  };
  return {
    stone: new T.MeshStandardMaterial({
      name: "PwC Place pale stone lobby structure",
      color: 0xc9c6b6,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      normalScale: new T.Vector2(0.035, 0.035),
      roughness: 0.58,
    }),
    glass: new T.MeshPhysicalMaterial({
      name: "PwC Place green vision glazing",
      color: 0x95b8b2,
      metalness: 0.42,
      roughness: 0.1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.85,
    }),
    spandrel: new T.MeshPhysicalMaterial({
      name: "PwC Place muted green spandrel glazing",
      color: 0x748f89,
      metalness: 0.44,
      roughness: 0.25,
      clearcoat: 0.65,
      envMapIntensity: 0.8,
    }),
    lobbyGlass: createExteriorLobbyGlass("PwC Place recessed lobby glazing"),
    lobbyLining: new T.MeshStandardMaterial({
      name: "PwC Place neutral mineral lobby lining",
      color: 0xb6b5ac,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      normalScale: new T.Vector2(0.025, 0.025),
      metalness: 0,
      roughness: 0.46,
    }),
    lobbyRear: new T.MeshStandardMaterial({
      name: "PwC Place subdued neutral lobby rear",
      color: 0x555b58,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      normalScale: new T.Vector2(0.018, 0.018),
      metalness: 0,
      roughness: 0.76,
    }),
    metal: new T.MeshStandardMaterial({
      name: "PwC Place silver curtain wall frames",
      color: 0xc7ceca,
      metalness: 0.76,
      roughness: 0.25,
    }),
    backing: new T.MeshStandardMaterial({
      name: "PwC Place closed facade recess",
      color: 0x1c302d,
      roughness: 0.87,
    }),
    roof: new T.MeshStandardMaterial({
      name: "PwC Place roof membrane",
      color: 0x6c7270,
      roughness: 0.92,
    }),
  };
}
export type PwcPlaceMaterials = ReturnType<typeof createPwcPlaceMaterials>;
