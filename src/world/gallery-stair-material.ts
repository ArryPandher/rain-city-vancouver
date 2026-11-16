import * as T from "three";

/** Authored exterior mineral finish, informed by the official rear photograph.
 * Neither the hue nor grain repeat is a measured Gallery material property. */
export const GALLERY_STAIR_FINISH = {
  color: 0x60615b,
  grainRepeatMetres: 0.75,
  roughness: 0.96,
  normalStrength: 0.22,
} as const;

/** Flight, landing and closed stair shell only. Input is the loaded Gallery
 * foundation mineral; metric tangent-plane UVs are supplied by gallery-facade.
 * Keep the licensed joint-free mineral Sources, not the wall-course shader.
 * Owned sampler wrappers are disposed with this material, shared Sources stay. */
export function createGalleryStairMaterial(source: T.MeshStandardMaterial) {
  const q = GALLERY_STAIR_FINISH;
  const material = new T.MeshStandardMaterial({
    name: "Gallery mineral stair flight",
    color: q.color,
    roughness: q.roughness,
    metalness: 0,
    normalScale: new T.Vector2(q.normalStrength, q.normalStrength),
    side: source.side,
  });
  const samplers: T.Texture[] = [];
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    const original = source[key];
    if (!original) continue;
    const map = original.clone();
    map.name = `Gallery stair ${key}`;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.offset.set(0, 0);
    map.center.set(0, 0);
    map.rotation = 0;
    map.repeat.setScalar(1 / q.grainRepeatMetres);
    map.colorSpace = key === "map" ? T.SRGBColorSpace : T.NoColorSpace;
    map.updateMatrix();
    material[key] = map;
    samplers.push(map);
  }
  material.userData.galleryStairFinish = q;
  let disposed = false;
  material.addEventListener("dispose", () => {
    if (disposed) return;
    disposed = true;
    samplers.forEach((map) => map.dispose());
  });
  return material;
}
