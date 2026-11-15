import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";
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
    lobbyGlass: createExteriorLobbyGlass(
      "Fairmont Waterfront recessed lobby glazing",
      0.86,
    ),
    lobbyRear: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront charcoal rear cavity fields",
      color: 0x505957,
      metalness: 0,
      roughness: 0.88,
    }),
    lobbyLining: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront neutral lobby cavity lining",
      color: 0xc2bfb4,
      metalness: 0,
      roughness: 0.84,
    }),
    panel: new T.MeshStandardMaterial({
      name: "Fairmont Waterfront pale panel grid",
      color: 0xd4d8d4,
      map: mineral("color", true),
      normalMap: mineral("normal", false),
      normalScale: new T.Vector2(0.06, 0.06),
      roughness: 0.64,
      metalness: 0,
    }),
    glass: new T.MeshPhysicalMaterial({
      name: "Fairmont Waterfront blue reflective glazing",
      // Opaque dark-room and reflective coating approximation. Effective IOR
      // gives one ~12.6% normal reflection lobe, not bulk uncoated glass.
      color: 0x24485f,
      metalness: 0,
      roughness: 0.09,
      clearcoat: 0,
      ior: 2.1,
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
