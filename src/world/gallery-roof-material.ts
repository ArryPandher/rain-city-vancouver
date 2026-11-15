import * as T from "three";

/** The cross-wing sheets are visibly greener/lighter than the central cupola
 * in the documented Robson exterior. Reuse the existing CC0 patina maps;
 * this palette is an appearance interpretation, not a measured copper sample. */
export function galleryWingCopperMaterial(source: T.MeshStandardMaterial) {
  const material = source.clone();
  material.name = "Gallery — patinated cross-wing copper";
  material.color.setHex(0x739a88);
  material.roughness = 0.82;
  material.metalness = 0.12;
  material.normalScale.set(0.12, 0.12);
  material.envMapIntensity = 0.7;
  return material;
}
