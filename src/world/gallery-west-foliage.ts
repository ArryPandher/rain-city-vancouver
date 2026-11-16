import * as T from "three";
import { BASE } from "./materials";
import { CONIFER_ALPHA_CUTOFF } from "./conifer-foliage";
import {
  GALLERY_WEST_TERRACE as D,
  galleryWestCrownProfile,
} from "./gallery-west-terrace-data";

/** Actual alpha-connected branches in the licensed 1024px atlas, plus6px filter margins.
 * Pixel origin and UV v both point down, retaining glTF's flipY=false convention. */
export const GALLERY_TWIG_CUTS = [
  [187, 41, 445, 325],
  [662, 35, 967, 384],
  [307, 403, 666, 800],
  [643, 457, 987, 856],
] as const;
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 31.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Upward folded needle sprays, arranged around rather than replacing the
 * photographic narrow crown. Card dimensions are branch-scale interpretations. */
export function galleryWestSprayGeometry(index: number) {
  const t = D.trees[index],
    rows = Math.ceil(t.height / 0.22),
    sides = 12,
    base = D.capY + D.planterHeight - 0.18,
    p: number[] = [],
    uv: number[] = [],
    ix: number[] = [];
  for (let row = 0; row < rows; row++)
    for (let j = 0; j < sides; j++) {
      const id = row * sides + j + index * 2003,
        f = (row + 0.4 + hash(id) * 0.2) / rows,
        a = (j / sides + row * 0.381966 + hash(id + 3) * 0.08) * Math.PI * 2,
        radius = (t.width / 2) * galleryWestCrownProfile(f),
        y = base + f * t.height,
        width =
          Math.min(0.48, t.width * 0.42) *
          (0.82 + hash(id + 7) * 0.24) *
          galleryWestCrownProfile(f),
        length =
          Math.min(0.76, (t.height - (y - base)) * 0.95) *
          (0.84 + hash(id + 9) * 0.16),
        r = radius * (0.72 + hash(id + 11) * 0.1),
        radial = new T.Vector3(Math.cos(a), 0, Math.sin(a)),
        tangent = new T.Vector3(-Math.sin(a), 0, Math.cos(a)),
        origin = new T.Vector3(t.u + radial.x * r, y, t.v + radial.z * r),
        cut = GALLERY_TWIG_CUTS[id % GALLERY_TWIG_CUTS.length],
        start = p.length / 3;
      // Two gently folded longitudinal halves: actual needle edges and normal
      // detail, with no view-facing billboard or whole-tree silhouette stretch.
      for (const [s, v] of [
        [-0.5, 0],
        [0, 0],
        [0.5, 0],
        [-0.5, 1],
        [0, 1],
        [0.5, 1],
      ]) {
        const q = origin.clone().addScaledVector(tangent, s * width);
        q.y += v * length;
        q.addScaledVector(radial, Math.abs(s) * 0.11 * width + v * 0.05);
        // Keep the full branch inside the fitted crown's explicit envelope.
        const localF = (q.y - base) / t.height,
          limit = (t.width / 2) * galleryWestCrownProfile(localF) * 1.16,
          dx = q.x - t.u,
          dz = q.z - t.v,
          rr = Math.hypot(dx, dz);
        if (rr > limit) {
          q.x = t.u + (dx * limit) / rr;
          q.z = t.v + (dz * limit) / rr;
        }
        p.push(q.x, q.y, q.z);
        uv.push(
          (cut[0] + (s + 0.5) * (cut[2] - cut[0])) / 1024,
          (cut[3] - v * (cut[3] - cut[1])) / 1024,
        );
      }
      ix.push(
        start,
        start + 3,
        start + 4,
        start,
        start + 4,
        start + 1,
        start + 1,
        start + 4,
        start + 5,
        start + 1,
        start + 5,
        start + 2,
      );
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

type ImageLoader = Pick<T.TextureLoader, "load">;
/** Image requests settle independently; incomplete/error loads leave the compact
 * opaque inner crown in place and never display untextured opaque cards. */
export function createGalleryWestFoliageMaterial(loader?: ImageLoader) {
  const material = new T.MeshStandardMaterial({
    name: "Gallery west licensed twig sprays",
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    side: T.DoubleSide,
    alphaTest: CONIFER_ALPHA_CUTOFF,
    alphaToCoverage: true,
    normalScale: new T.Vector2(0.75, -0.75),
  });
  material.userData.galleryFoliageAtlas = true;
  material.userData.galleryFoliageStatus = "loading";
  material.visible = false;
  loader ??=
    typeof document === "undefined" ? undefined : new T.TextureLoader();
  if (!loader) {
    material.userData.galleryFoliageStatus = "unrequested";
    return material;
  }
  const received: (T.Texture | undefined)[] = [];
  let failed = false;
  material.addEventListener("dispose", () => {
    failed = true;
    for (const texture of received) texture?.dispose();
  });
  const fail = () => {
    failed = true;
    material.visible = false;
    material.userData.galleryFoliageStatus = "fallback";
    for (const t of received) t?.dispose();
  };
  for (const [i, role] of ["color", "normal"].entries())
    loader.load(
      `${BASE}textures/gallery-conifers/${role}.webp`,
      (texture) => {
        if (failed) {
          texture.dispose();
          return;
        }
        texture.flipY = false;
        texture.colorSpace = i === 0 ? T.SRGBColorSpace : T.NoColorSpace;
        texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
        texture.anisotropy = 8;
        texture.needsUpdate = true;
        received[i] = texture;
        if (received[0] && received[1]) {
          material.map = received[0];
          material.normalMap = received[1];
          material.visible = true;
          material.userData.galleryFoliageStatus = "ready";
          material.needsUpdate = true;
        }
      },
      undefined,
      fail,
    );
  return material;
}
