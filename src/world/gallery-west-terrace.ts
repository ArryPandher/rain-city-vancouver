import * as T from "three";
import {
  createGalleryWestFoliageMaterial,
  galleryWestSprayGeometry,
} from "./gallery-west-foliage";
import type { ArchitecturalMesh } from "./architectural-mesh";
import {
  GALLERY_WEST_TERRACE as D,
  galleryWestTerraceBoxes,
  galleryWestCrownProfile,
  galleryWestPoint,
  type GalleryWestBox,
} from "./gallery-west-terrace-data";

export function galleryWestBoxGeometry(b: GalleryWestBox) {
  const g = new T.BoxGeometry(
    b.maxU - b.minU,
    b.top - b.bottom,
    b.maxV - b.minV,
  );
  g.translate(
    (b.minU + b.maxU) / 2,
    (b.top + b.bottom) / 2,
    (b.minV + b.maxV) / 2,
  );
  if (b.openTop) {
    const ix = g.index!,
      n = g.getAttribute("normal"),
      keep: number[] = [];
    for (let i = 0; i < ix.count; i += 3)
      if (n.getY(ix.getX(i)) < 0.5)
        keep.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
    g.setIndex(keep);
  }
  g.clearGroups();
  return g;
}
function tint(g: T.BufferGeometry, seed: number) {
  const p = g.getAttribute("position"),
    c: number[] = [];
  const base = new T.Color(0x344a24);
  for (let i = 0; i < p.count; i++) {
    const q =
      0.86 +
      0.14 *
        (0.5 +
          0.5 *
            Math.sin(
              p.getX(i) * 7.1 + p.getY(i) * 11.3 + p.getZ(i) * 8.7 + seed,
            ));
    c.push(base.r * q, base.g * q, base.b * q);
  }
  g.setAttribute("color", new T.Float32BufferAttribute(c, 3));
  return g;
}
/** Dense narrow columnar crown; species is deliberately unclaimed. The
 * connected lobed surface avoids a repeated pile of spheres or flat billboards. */
export function galleryWestConiferGeometry(index: number, radialScale = 1) {
  const t = D.trees[index],
    rings = 29,
    sides = 12,
    p: number[] = [],
    uv: number[] = [],
    ix: number[] = [];
  const base = D.capY + D.planterHeight - 0.18;
  for (let i = 0; i < rings; i++) {
    const f = i / (rings - 1),
      profile = galleryWestCrownProfile(f);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        rough =
          1 +
          0.12 * Math.sin(i * 1.7 + j * 2.4 + index) +
          0.065 * Math.sin(i * 0.43 + j * 0.91 + index),
        r = (t.width / 2) * profile * rough * radialScale;
      p.push(
        t.u + Math.cos(a) * r + 0.025 * Math.sin(f * 8 + index),
        base + f * t.height,
        t.v + Math.sin(a) * r,
      );
      uv.push(j / sides, f);
    }
  }
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = (i + 1) * sides + j,
        c = (i + 1) * sides + ((j + 1) % sides),
        d = i * sides + ((j + 1) % sides);
      ix.push(a, b, c, a, c, d);
    }
  const bottom = p.length / 3;
  p.push(t.u + 0.025 * Math.sin(index), base, t.v);
  uv.push(0.5, 0);
  const top = p.length / 3;
  p.push(t.u + 0.025 * Math.sin(8 + index), base + t.height, t.v);
  uv.push(0.5, 1);
  for (let j = 0; j < sides; j++) {
    ix.push(bottom, j, (j + 1) % sides);
    ix.push(
      top,
      (rings - 1) * sides + ((j + 1) % sides),
      (rings - 1) * sides + j,
    );
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return tint(g, index);
}
export function galleryWestHedgeGeometry() {
  const p = D.planter,
    w = p.maxU - p.minU - 0.04,
    depth = p.maxV - p.minV - 0.04;
  const g = new T.BoxGeometry(w, 0.42, depth, Math.ceil(w / 0.3), 2, 4),
    a = g.getAttribute("position");
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i),
      y = a.getY(i),
      z = a.getZ(i),
      n =
        Math.sin(x * 6.21 + z * 7.13 + y * 13.7) * 0.018 +
        Math.sin(x * 2.71 + z * 3.97) * 0.025;
    a.setXYZ(
      i,
      x,
      y + (y > 0 ? n : 0),
      z + Math.sin(x * 5.8 + z * 2.7) * 0.016,
    );
  }
  g.translate(
    (p.minU + p.maxU) / 2,
    D.capY + D.planterHeight + 0.16,
    (p.minV + p.maxV) / 2,
  );
  g.clearGroups();
  g.computeVertexNormals();
  return tint(g, 91);
}
export function addGalleryWestTerrace(
  mesh: ArchitecturalMesh,
  stone: T.Material,
  metal: T.Material,
  glass: T.Material,
) {
  const leaf = new T.MeshStandardMaterial({
    name: "Gallery west columnar conifers and hedge",
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  const materials = { stone, metal, glass };
  const registered = (geometry: T.BufferGeometry) => {
    geometry.rotateY(Math.PI / 2);
    const [u, v] = galleryWestPoint(0, 0);
    geometry.translate(u, 0, v);
    return geometry;
  };
  for (const b of galleryWestTerraceBoxes())
    mesh.add(registered(galleryWestBoxGeometry(b)), materials[b.role]);
  mesh.add(registered(galleryWestHedgeGeometry()), leaf);
  const sprays = createGalleryWestFoliageMaterial();
  for (let i = 0; i < D.trees.length; i++) {
    mesh.add(registered(galleryWestConiferGeometry(i, 0.68)), leaf);
    mesh.add(registered(galleryWestSprayGeometry(i)), sprays);
  }
}
