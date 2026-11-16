import * as T from "three";
import type { Materials } from "./materials";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

/** Approximate 225 × 75 mm brick modules, not surveyed building dimensions.
 * All geometry uses continuous facade-along / height coordinates in metres. */
export const PACIFIC_COAST_BRICK_REPEAT_METRES = [1.35, 1.575] as const;
export const PACIFIC_COAST_MINERAL_REPEAT_METRES = [0.85, 0.85] as const;

/** 325 Howe's present-day light piers and buff Howe-face panels are informed by
 * the owner photograph and the modern half of the 2013 corner comparison in
 * docs/sources/howe-325-howe-audit.md. Those photographs are reference only.
 * The narrow Cordova end uses stone spandrels, not the orange brick material.
 * Existing generic CC0 maps: Rob Tuytel's Red Brick and Charlotte Baglioni's
 * Granite Tile crop, credited in public/textures/landmarks/SOURCES.json and
 * public/textures/pacific-coast/SOURCES.json. The facade-only albedo preserves
 * restrained original grain; the shared roof maps retain their previous look.
 * Fine joint-free mineral maps supplement the geometry's reveals and joints;
 * they do not establish the actual building's stone species or measured finish.
 */
export function createPacificCoastMaterials(
  library: Pick<Materials, "texture">,
) {
  const texture = (
    surface: "brick" | "mineral",
    channel: "color" | "normal" | "roughness",
    metres: readonly [number, number],
  ) => {
    const map = library
      .texture(`landmarks/${surface}-${channel}.webp`, channel === "color")
      .clone();
    map.name = `325 Howe ${surface} ${channel}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = channel === "color" ? T.SRGBColorSpace : T.NoColorSpace;
    map.repeat.set(1 / metres[0], 1 / metres[1]);
    map.updateMatrix();
    return map;
  };
  const maps = (
    surface: "brick" | "mineral",
    metres: readonly [number, number],
  ) => ({
    map: texture(surface, "color", metres),
    normalMap: texture(surface, "normal", metres),
    roughnessMap: texture(surface, "roughness", metres),
  });
  const mineral = maps("mineral", PACIFIC_COAST_MINERAL_REPEAT_METRES);
  const facadeColor = library
    .texture("pacific-coast/mineral-color.webp", true)
    .clone();
  facadeColor.name = "325 Howe source-grain mineral albedo";
  facadeColor.wrapS = facadeColor.wrapT = T.RepeatWrapping;
  facadeColor.colorSpace = T.SRGBColorSpace;
  facadeColor.repeat.copy(mineral.map.repeat);
  facadeColor.updateMatrix();
  // The original granite roughness averages ~0.54 before multiplication,
  // producing a much smoother facade than the scalar alone suggests. These
  // dry-mineral finish candidates keep the existing normal/weathering detail.
  const facadeMineral = { map: facadeColor, normalMap: mineral.normalMap };
  // A dielectric sheet over closed window recesses. The lining supplies actual
  // visible depth; reflected radiance is no longer mixed with opaque paint.
  const glass = createExteriorLobbyGlass(
    "325 Howe recessed paired window glazing",
    0.8,
    2,
  );
  // Effective Fresnel fit for the reflective glazing seen in the reference,
  // not a measurement of its coating/index. The slab uses the same IOR for
  // reflected BRDF and transmitted energy, retaining a closed recess behind it.
  glass.ior = 2.3;
  glass.roughness = 0.045;
  return {
    stone: new T.MeshStandardMaterial({
      name: "325 Howe pale warm mineral piers and Cordova spandrels",
      ...facadeMineral,
      // Kept below white to retain shading in the existing bright HDR daylight.
      color: 0xb0ad9f,
      normalScale: new T.Vector2(0.14, 0.14),
      metalness: 0,
      roughness: 0.8,
    }),
    base: new T.MeshStandardMaterial({
      name: "325 Howe grey stone street base",
      ...facadeMineral,
      color: 0x727870,
      normalScale: new T.Vector2(0.21, 0.21),
      metalness: 0,
      roughness: 0.84,
    }),
    brick: new T.MeshStandardMaterial({
      name: "325 Howe warm buff-orange Howe spandrel brick",
      ...maps("brick", PACIFIC_COAST_BRICK_REPEAT_METRES),
      // A slight cool multiplier tempers the generic red scan toward the
      // photographed buff panels while retaining mortar and brick variation.
      color: 0xd8e4d0,
      normalScale: new T.Vector2(0.4, 0.4),
      metalness: 0,
      roughness: 0.93,
    }),
    trim: new T.MeshStandardMaterial({
      name: "325 Howe mineral sills and narrow projecting bands",
      ...facadeMineral,
      color: 0xa4a293,
      normalScale: new T.Vector2(0.12, 0.12),
      metalness: 0,
      roughness: 0.76,
    }),
    glass,
    lining: new T.MeshStandardMaterial({
      name: "325 Howe closed window recess lining",
      color: 0x333936,
      metalness: 0,
      roughness: 0.98,
    }),
    blind: new T.MeshStandardMaterial({
      name: "325 Howe off-white window blinds",
      color: 0x959b8e,
      metalness: 0,
      roughness: 0.91,
    }),
    frame: new T.MeshStandardMaterial({
      name: "325 Howe pale grey painted window frames",
      color: 0x9da399,
      metalness: 0.08,
      roughness: 0.48,
    }),
    roof: new T.MeshStandardMaterial({
      name: "325 Howe subdued mineral roof surface",
      ...mineral,
      color: 0x73796e,
      normalScale: new T.Vector2(0.25, 0.25),
      metalness: 0,
      roughness: 0.96,
    }),
  };
}

export type PacificCoastMaterials = ReturnType<
  typeof createPacificCoastMaterials
>;
