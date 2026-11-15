import * as T from "three";
import type { Materials } from "./materials";

/** Existing CC0 mineral maps, with metre UVs supplied by every concrete face.
 * This is an exposed-aggregate approximation, not a photographed façade atlas. */
export const GRANVILLE_HOWE_MINERAL_REPEAT_METRES = 1.6;
export function createGranvilleHoweMaterials(
  library: Pick<Materials, "texture">,
  signMap?: T.Texture,
) {
  const texture = (name: string, color: boolean) => {
    const map = library
      .texture(`canada-place-plinth/${name}.webp`, color)
      .clone();
    map.name = `Granville Square Howe mineral ${name}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.repeat.setScalar(1 / GRANVILLE_HOWE_MINERAL_REPEAT_METRES);
    map.updateMatrix();
    return map;
  };
  return {
    concrete: new T.MeshStandardMaterial({
      name: "Granville Square Howe exposed concrete",
      color: 0xb5b1a4,
      map: texture("color", true),
      normalMap: texture("normal", false),
      roughnessMap: texture("roughness", false),
      normalScale: new T.Vector2(0.13, 0.13),
      metalness: 0,
      roughness: 0.91,
    }),
    // Closed coated-window proxy. Actual metre-deep reveals create the recess;
    // no invented interior image, emissive illumination or extra capture pass.
    glass: new T.MeshPhysicalMaterial({
      name: "Granville Square Howe recessed neutral glazing",
      color: 0x62706e,
      metalness: 0.32,
      roughness: 0.16,
      clearcoat: 0.7,
      clearcoatRoughness: 0.13,
      envMapIntensity: 0.9,
    }),
    frame: new T.MeshStandardMaterial({
      name: "Granville Square Howe dark anodized frames and joints",
      color: 0x353b3b,
      metalness: 0.35,
      roughness: 0.48,
    }),
    sign: new T.MeshStandardMaterial({
      name: "Granville Square Howe pale sign panels",
      color: 0xb8c2c5,
      metalness: 0,
      roughness: 0.52,
    }),
    lettering: new T.MeshStandardMaterial({
      name: "Granville Square Howe identification letters",
      color: 0x373f42,
      map: signMap ?? null,
      alphaTest: 0.5,
      roughness: 0.8,
    }),
    roof: new T.MeshStandardMaterial({
      name: "Granville Square Howe roof membrane",
      color: 0x747873,
      metalness: 0,
      roughness: 0.95,
    }),
  };
}
export type GranvilleHoweMaterials = ReturnType<
  typeof createGranvilleHoweMaterials
>;

/** Transparent typographic mask for the name visible in the source photo only.
 * Generated locally; no source photograph or downloaded runtime asset. */
export function createGranvilleHoweSignMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.font = "600 130px Arial, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("Granville", 28, 110);
  context.fillText("Square", 28, 263);
  const map = new T.CanvasTexture(canvas);
  map.name = "Granville Square source-supported name mask";
  map.colorSpace = T.SRGBColorSpace;
  return map;
}
