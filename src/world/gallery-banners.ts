import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GALLERY_FACADE_EDGES } from "./gallery-facade";
import entry from "./gallery-rear-entry-data.json";
import { GALLERY_PORTICO } from "./gallery-portico-data";

/** Original identity-only interpretation; dimensions are not a measured survey. */
export const GALLERY_BANNERS = {
  shaftU: GALLERY_PORTICO.shaftU,
  width: 1.9,
  bottom: 5.45,
  top: GALLERY_PORTICO.bannerTop,
  // Clear existing 160 mm stone sills; no underlying facade faces are removed.
  standOff: 0.19,
  drape: 0.02,
} as const;

/** Exact mapped rear elevation in the same source frame as the repaired shafts. */
export function galleryBannerWallV(u: number) {
  const edge = GALLERY_FACADE_EDGES.find(
    (e) => u >= Math.min(e.a[0], e.b[0]) && u <= Math.max(e.a[0], e.b[0]),
  );
  if (!edge)
    throw new RangeError("Banner lies outside reviewed gallery rear wall");
  return (
    edge.a[1] +
    ((u - edge.a[0]) * (edge.b[1] - edge.a[1])) / (edge.b[0] - edge.a[0])
  );
}

let fabricMaterial: T.MeshStandardMaterial | undefined;
function fabric() {
  if (fabricMaterial) return fabricMaterial;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gallery banner canvas unavailable");
  ctx.fillStyle = "#914b46";
  ctx.fillRect(0, 0, 512, 1024);
  // Original typography only: no exhibition title, artwork, logo or date.
  ctx.fillStyle = "#eee5d5";
  ctx.textAlign = "center";
  ctx.font = "600 100px sans-serif";
  ctx.translate(205, 512);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("VANCOUVER", 0, 0, 820);
  ctx.fillText("ART GALLERY", 0, 115, 820);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  fabricMaterial = new T.MeshStandardMaterial({
    name: "Gallery original muted-red fabric banners",
    map,
    roughness: 0.96,
    metalness: 0,
    side: T.DoubleSide,
  });
  return fabricMaterial;
}

/** Call only after the existing source/facade preflight succeeds, on the same
 * source-local group passed to addGalleryFacade. No source triangles removed. */
export function addGalleryBanners(parent: T.Object3D): T.Mesh[] {
  const existing = parent.getObjectByName("Gallery original identity banners");
  if (existing)
    return existing.children.filter((o): o is T.Mesh => o instanceof T.Mesh);
  const root = new T.Group();
  root.name = "Gallery original identity banners";
  root.rotation.y = -entry.angle;
  const panels: T.BufferGeometry[] = [],
    hardware: T.BufferGeometry[] = [];
  const p = GALLERY_BANNERS;
  for (let i = 0; i < p.shaftU.length - 1; i++) {
    const centre = (p.shaftU[i] + p.shaftU[i + 1]) / 2;
    const g = new T.PlaneGeometry(p.width, p.top - p.bottom, 8, 24);
    const pos = g.getAttribute("position");
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j),
        y = pos.getY(j) + (p.top + p.bottom) / 2;
      const t = (y - p.bottom) / (p.top - p.bottom);
      const z =
        galleryBannerWallV(centre + x) +
        p.standOff +
        p.drape * Math.sin(Math.PI * t) * Math.cos((x / p.width) * Math.PI);
      pos.setXYZ(j, centre + x, y, z);
    }
    g.computeVertexNormals();
    panels.push(g);
    // Top support and weighted hem follow the mapped wall angle exactly.
    const angle = -Math.atan(
      (galleryBannerWallV(centre + 0.1) - galleryBannerWallV(centre - 0.1)) /
        0.2,
    );
    for (const y of [p.bottom, p.top]) {
      hardware.push(
        new T.BoxGeometry(p.width + 0.08, 0.045, 0.045)
          .rotateY(angle)
          .translate(centre, y, galleryBannerWallV(centre) + p.standOff),
      );
      for (const x of [centre - p.width / 2, centre + p.width / 2]) {
        hardware.push(
          new T.BoxGeometry(0.065, 0.1, p.standOff + 0.045).translate(
            x,
            y,
            galleryBannerWallV(x) + p.standOff / 2,
          ),
        );
      }
    }
  }
  const metal = new T.MeshStandardMaterial({
    name: "Gallery banner mounting hardware",
    color: 0x65615b,
    roughness: 0.65,
    metalness: 0.45,
  });
  const result = [
    [panels, fabric()],
    [hardware, metal],
  ].map(([parts, material]) => {
    const geometries = parts as T.BufferGeometry[];
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach((g) => g.dispose());
    const mesh = new T.Mesh(geometry, material as T.Material);
    mesh.name = (material as T.Material).name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
  parent.add(root);
  return result;
}
