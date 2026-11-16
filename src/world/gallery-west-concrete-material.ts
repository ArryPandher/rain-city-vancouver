import * as T from "three";
import type { Materials } from "./materials";
import provenance from "../../public/textures/gallery-west-concrete/SOURCES.json";

/** Modern terrace concrete only; never inherited ashlar joints or heritage stone.
 * The source crop preserves photographic grain while mean compensation keeps the
 * former mineral-map × foundation-color mean, rather than darkening the scene. */
export function createGalleryWestConcreteMaterial(
  foundation: T.MeshStandardMaterial,
  library: Pick<Materials, "texture">,
) {
  const material = new T.MeshStandardMaterial({
    name: "Gallery west cast-concrete terrace",
    color: foundation.color
      .clone()
      .multiply(
        new T.Color().setRGB(
          ...(provenance.meanCompensation as [number, number, number]),
        ),
      ),
    roughness: 1,
    metalness: 0,
    normalScale: new T.Vector2(0.4, 0.4),
    side: foundation.side,
  });
  const owned: T.Texture[] = [];
  for (const [key, file] of [
    ["map", "color"],
    ["normalMap", "normal"],
    ["roughnessMap", "roughness"],
  ] as const) {
    const map = library.texture(
      `gallery-west-concrete/${file}.webp`,
      key === "map",
    );
    map.name = `Gallery west concrete ${file}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(1 / provenance.repeatMetres);
    map.offset.set(0, 0);
    map.center.set(0, 0);
    map.rotation = 0;
    map.colorSpace = key === "map" ? T.SRGBColorSpace : T.NoColorSpace;
    map.updateMatrix();
    material[key] = map;
    owned.push(map);
  }
  material.userData.galleryWestConcrete = true;
  let disposed = false;
  material.addEventListener("dispose", () => {
    if (disposed) return;
    disposed = true;
    owned.forEach((map) => map.dispose());
  });
  return material;
}
