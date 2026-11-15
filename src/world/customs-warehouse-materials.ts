import * as T from "three";
import type { Materials } from "./materials";

/** The source brick image contains approximately six lengths and 21 courses.
 * These photo-fit modules are not surveyed dimensions of the Customs building.
 * Geometry supplies continuous facade-along / elevation metre UV coordinates. */
export const CUSTOMS_BRICK_REPEAT_METRES = [1.35, 1.575] as const;
export const CUSTOMS_MINERAL_REPEAT_METRES = [0.72, 0.72] as const;

/** Existing CC0 material scans only. Red Brick is by Rob Tuytel; the joint-free
 * granite crop is Charlotte Baglioni's Granite Tile; patina derives from Rob
 * Tuytel's Green Metal Rust. Attribution and processing are recorded in
 * public/textures/landmarks/SOURCES.json. They are generic material references,
 * not scans of the warehouse. Ashlar joints/rustication are actual geometry;
 * no unrelated masonry photograph is overlaid on those blocks. */
export function createCustomsWarehouseMaterials(
  library: Pick<Materials, "texture">,
) {
  const texture = (
    surface: "brick" | "mineral" | "patina",
    channel: "color" | "normal" | "roughness",
    metres: readonly [number, number],
  ) => {
    // Clone sampler state; changing this building must not rescale other users.
    const map = library
      .texture(`landmarks/${surface}-${channel}.webp`, channel === "color")
      .clone();
    map.name = `Customs Warehouse ${surface} ${channel}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = channel === "color" ? T.SRGBColorSpace : T.NoColorSpace;
    map.repeat.set(1 / metres[0], 1 / metres[1]);
    map.updateMatrix();
    return map;
  };
  const maps = (
    surface: "brick" | "mineral" | "patina",
    metres: readonly [number, number],
  ) => ({
    map: texture(surface, "color", metres),
    normalMap: texture(surface, "normal", metres),
    roughnessMap: texture(surface, "roughness", metres),
  });
  const mineral = maps("mineral", CUSTOMS_MINERAL_REPEAT_METRES);
  const patina = maps("patina", [1.8, 1.8]);
  return {
    brick: new T.MeshStandardMaterial({
      name: "Customs Warehouse weathered red clay brick",
      ...maps("brick", CUSTOMS_BRICK_REPEAT_METRES),
      // The photographed wall is muted red/brown; retain photographed mortar
      // and individual brick variation rather than applying a saturated tint.
      color: 0xded1d2,
      normalScale: new T.Vector2(0.5, 0.5),
      metalness: 0,
      roughness: 0.94,
    }),
    stone: new T.MeshStandardMaterial({
      name: "Customs Warehouse rusticated granite ashlar",
      ...mineral,
      // Native daylight calibration: the first pale fit read as new white tile.
      color: 0x918d83,
      normalScale: new T.Vector2(0.5, 0.5),
      metalness: 0,
      roughness: 0.96,
    }),
    trim: new T.MeshStandardMaterial({
      name: "Customs Warehouse sandstone sills and arch mouldings",
      ...mineral,
      color: 0x969082,
      normalScale: new T.Vector2(0.12, 0.12),
      metalness: 0,
      roughness: 0.92,
    }),
    // Closed-window proxy behind modeled reveals/mullions. It is neither an
    // emissive room nor clear transmission into a nonexistent interior. The
    // modest coating response may receive the existing street reflection map.
    glass: new T.MeshPhysicalMaterial({
      name: "Customs Warehouse recessed closed window glazing",
      color: 0x566462,
      metalness: 0.16,
      roughness: 0.1,
      clearcoat: 0.18,
      clearcoatRoughness: 0.18,
      ior: 1.5,
      envMapIntensity: 0.9,
    }),
    frame: new T.MeshStandardMaterial({
      name: "Customs Warehouse weathered green-grey window frames",
      ...patina,
      color: 0x66706a,
      normalScale: new T.Vector2(0.08, 0.08),
      metalness: 0.12,
      roughness: 0.7,
    }),
    cornice: new T.MeshStandardMaterial({
      name: "Customs Warehouse dark weathered metal cornice",
      ...patina,
      color: 0x535f58,
      normalScale: new T.Vector2(0.14, 0.14),
      metalness: 0.3,
      roughness: 0.77,
    }),
    // The City 2022 aerial distinguishes a pale weathered metal roof surround
    // from the dark street cornice. Its colour is a visual fit, not a measured
    // copper/patina spectrum; the existing neutralised metal scan adds relief.
    roof: new T.MeshStandardMaterial({
      name: "Customs Warehouse pale green-grey metal roof surround",
      ...patina,
      color: 0x9aa996,
      normalScale: new T.Vector2(0.12, 0.12),
      metalness: 0.22,
      roughness: 0.81,
    }),
    gravel: new T.MeshStandardMaterial({
      name: "Customs Warehouse neutral mineral flat roof centre",
      ...mineral,
      color: 0x8d897d,
      normalScale: new T.Vector2(0.65, 0.65),
      metalness: 0,
      roughness: 1,
    }),
  };
}

export type CustomsWarehouseMaterials = ReturnType<
  typeof createCustomsWarehouseMaterials
>;
