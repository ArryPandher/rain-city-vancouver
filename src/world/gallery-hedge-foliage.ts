import * as T from "three";
import type { Materials } from "./materials";
import { BASE } from "./materials";

/** Individual CC0 Shrub04 leaves, matching the retained coastal-leaf source.
 * Coordinates are original 1024px atlas pixels, not whole plant silhouettes. */
export const GALLERY_HEDGE_LEAVES = [
  [132, 96, 104, 240],
  [534, 74, 99, 270],
  [436, 395, 127, 252],
  [619, 385, 100, 218],
  [229, 643, 115, 294],
  [373, 713, 133, 244],
  [549, 687, 106, 225],
] as const;
const random = (i: number) => {
  const q = Math.sin(i * 127.1 + 78.23) * 43758.5453;
  return q - Math.floor(q);
};

/** Thin folded leaves replace the visible shell while a recessed core keeps
 * the clipped hedge dense. All vertices remain inside the previous hedge AABB. */
export function galleryHedgeFoliageGeometry(source: T.BufferGeometry) {
  source.computeBoundingBox();
  const bounds = source.boundingBox!.clone(),
    size = bounds.getSize(new T.Vector3()),
    centre = bounds.getCenter(new T.Vector3());
  const backing = source.clone(),
    p = backing.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    p.setXYZ(
      i,
      centre.x + (p.getX(i) - centre.x) * (1 - 0.12 / size.x),
      bounds.min.y + (p.getY(i) - bounds.min.y) * (1 - 0.11 / size.y),
      centre.z + (p.getZ(i) - centre.z) * (1 - 0.16 / size.z),
    );
  backing.computeVertexNormals();
  const positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  let id = 0;
  // Top, two long sides and both ends. No underside foliage or per-leaf objects.
  for (const [axis, sign, a, b] of [
    [1, 1, 0, 2],
    [2, 1, 0, 1],
    [2, -1, 0, 1],
    [0, 1, 2, 1],
    [0, -1, 2, 1],
  ]) {
    const na = Math.ceil(size.getComponent(a) / 0.11),
      nb = Math.ceil(size.getComponent(b) / 0.085);
    for (let i = 0; i < na; i++)
      for (let j = 0; j < nb; j++, id++) {
        const normal = new T.Vector3().setComponent(axis, sign);
        normal.setComponent(a, (random(id + 7) - 0.5) * 0.95);
        normal.setComponent(b, (random(id + 13) - 0.5) * 0.95);
        normal.normalize();
        const q = new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 0, 1),
          normal,
        );
        q.multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(0, 0, 1),
            random(id + 17) * Math.PI * 2,
          ),
        );
        const width = 0.075 + random(id + 23) * 0.03,
          length = 0.145 + random(id + 29) * 0.045;
        const offsets = [
          [-0.5, -0.5, 0],
          [0, -0.5, 0.008],
          [0.5, -0.5, 0],
          [-0.5, 0.5, 0],
          [0, 0.5, 0.018],
          [0.5, 0.5, 0],
        ].map(([x, y, z]) =>
          new T.Vector3(x * width, y * length, z).applyQuaternion(q),
        );
        const local = new T.Box3().setFromPoints(offsets),
          origin = centre.clone();
        origin.setComponent(
          a,
          bounds.min.getComponent(a) +
            ((i + 0.2 + random(id + 31) * 0.6) / na) * size.getComponent(a),
        );
        origin.setComponent(
          b,
          bounds.min.getComponent(b) +
            ((j + 0.2 + random(id + 37) * 0.6) / nb) * size.getComponent(b),
        );
        origin.setComponent(
          axis,
          sign > 0
            ? bounds.max.getComponent(axis) -
                local.max.getComponent(axis) -
                random(id + 41) * 0.035
            : bounds.min.getComponent(axis) -
                local.min.getComponent(axis) +
                random(id + 41) * 0.035,
        );
        // Shift complete leaves inward at corners; never flatten/clamp their vertices.
        for (let k = 0; k < 3; k++)
          origin.setComponent(
            k,
            T.MathUtils.clamp(
              origin.getComponent(k),
              bounds.min.getComponent(k) - local.min.getComponent(k),
              bounds.max.getComponent(k) - local.max.getComponent(k),
            ),
          );
        const start = positions.length / 3,
          cut = GALLERY_HEDGE_LEAVES[id % GALLERY_HEDGE_LEAVES.length];
        for (let k = 0; k < 6; k++) {
          const v = offsets[k].add(origin);
          positions.push(v.x, v.y, v.z);
          uv.push(
            (cut[0] + ((k % 3) / 2) * cut[2]) / 1024,
            (cut[1] + (k < 3 ? 1 : 0) * cut[3]) / 1024,
          );
          const tint = 0.84 + random(id + 53) * 0.16;
          colors.push(tint, tint, tint);
        }
        indices.push(
          start,
          start + 1,
          start + 4,
          start,
          start + 4,
          start + 3,
          start + 1,
          start + 2,
          start + 5,
          start + 1,
          start + 5,
          start + 4,
        );
      }
  }
  const leaves = new T.BufferGeometry()
    .setAttribute("position", new T.Float32BufferAttribute(positions, 3))
    .setAttribute("uv", new T.Float32BufferAttribute(uv, 2))
    .setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  leaves.setIndex(indices);
  leaves.computeVertexNormals();
  leaves.computeBoundingBox();
  return { backing, leaves, bounds };
}
export function createGalleryHedgeMaterial(
  library?: Pick<Materials, "texture">,
) {
  const material = new T.MeshStandardMaterial({
    name: "Gallery west clipped hedge leaves",
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    side: T.DoubleSide,
    alphaTest: 0.4,
    alphaToCoverage: true,
    normalScale: new T.Vector2(0.6, -0.6),
  });
  material.userData.galleryFoliageAtlas = true;
  const loader =
    typeof document !== "undefined" ? new T.TextureLoader() : undefined;
  const owned: T.Texture[] = [];
  for (const [key, file] of [
    ["map", "color"],
    ["normalMap", "normal"],
  ] as const) {
    const map =
      library?.texture(`gallery-hedge/${file}.webp`, key === "map") ??
      loader?.load(`${BASE}textures/gallery-hedge/${file}.webp`);
    if (!map) {
      material.visible = false;
      continue;
    }
    map.flipY = false;
    map.colorSpace = key === "map" ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
    map.repeat.set(1, 1);
    map.anisotropy = 8;
    map.needsUpdate = true;
    material[key] = map;
    owned.push(map);
  }
  let disposed = false;
  material.addEventListener("dispose", () => {
    if (disposed) return;
    disposed = true;
    for (const map of owned) map.dispose();
  });
  return material;
}
