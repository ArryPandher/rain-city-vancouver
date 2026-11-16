import * as T from "three";
import clipping from "polygon-clipping";
import { Batcher, flatPolygon } from "./geometry";
import type { Point } from "./data";
import type { Materials } from "./materials";
import type {
  HoweCordovaJunctionSite,
  JunctionSurface,
} from "./howe-cordova-junction-site";

/** Reuses the existing credited mineral maps: geometry supplies the actual
 * curb profile, slab edge and street grade. No new assets or baked facade art. */
export function createHoweCordovaJunctionMaterials(
  library: Pick<Materials, "texture">,
) {
  const map = library.texture("pacific-coast/mineral-color.webp", true).clone();
  const normalMap = library.texture("landmarks/mineral-normal.webp").clone();
  for (const texture of [map, normalMap]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(1 / 1.3, 1 / 1.3);
    texture.updateMatrix();
  }
  const material = (name: string, color: number) =>
    new T.MeshStandardMaterial({
      name,
      color,
      map,
      normalMap,
      normalScale: new T.Vector2(0.12, 0.12),
      roughness: 0.9,
      metalness: 0,
    });
  return {
    sidewalk: material("Howe Cordova cast concrete sidewalk", 0xa5aaa1),
    curb: material("Howe Cordova formed curb", 0xb6b8ac),
    gutter: material("Howe Cordova shallow concrete gutter", 0x8e958c),
  };
}
export function buildHoweCordovaJunction(
  batch: Batcher,
  site: HoweCordovaJunctionSite,
  materials: Record<JunctionSurface, T.Material>,
) {
  const buffers = new Map<JunctionSurface, { p: number[]; uv: number[] }>();
  for (const kind of ["sidewalk", "curb", "gutter"] as const)
    buffers.set(kind, { p: [], uv: [] });
  for (const tri of site.triangles)
    for (const p of tri.points) {
      const buffer = buffers.get(tri.surface)!;
      buffer.p.push(p[0], p[1] - batch.offsetY, p[2]);
      buffer.uv.push(...site.local(p[0], p[2]));
    }
  const curb = buffers.get("curb")!;
  for (const face of site.curbFaces) {
    const length = Math.hypot(face[1][0] - face[0][0], face[1][2] - face[0][2]);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = face[i];
      curb.p.push(p[0], p[1] - batch.offsetY, p[2]);
      curb.uv.push(i === 0 || i === 3 ? 0 : length, p[1]);
    }
  }
  for (const [kind, { p, uv }] of buffers) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    batch.add(geometry, materials[kind], 427, -402, `howe-cordova-${kind}`);
  }
  return {
    supportTriangles: site.triangles.length,
    curbFaceTriangles: site.curbFaces.length * 2,
    triangles: site.triangles.length + site.curbFaces.length * 2,
    materialGroups: 3,
  };
}

/** Remove only the old pedestrian concrete under the new finish. Crosswalk
 * paint and all original carriageways retain their existing geometry/widths. */
export function clipHoweCordovaPaths(
  geometry: T.BufferGeometry,
  site: HoweCordovaJunctionSite,
) {
  return clipFinish(geometry, site, site.pathCutout);
}

/** The gutter replaces a narrow band INSIDE the existing road footprint. */
export function clipHoweCordovaRoadEdges(
  geometry: T.BufferGeometry,
  site: HoweCordovaJunctionSite,
) {
  return clipFinish(geometry, site, site.masks.gutter);
}

function clipFinish(
  geometry: T.BufferGeometry,
  site: HoweCordovaJunctionSite,
  mask: Point[][][],
) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!,
    b = site.bounds;
  if (
    box.max.x < b.minX ||
    box.min.x > b.maxX ||
    box.max.z < b.minZ ||
    box.min.z > b.maxZ
  )
    return geometry;
  const p = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv"),
    ix = geometry.getIndex(),
    positions: number[] = [],
    tex: number[] = [];
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((k) => (ix ? ix.getX(i + k) : i + k)),
      tri = ids.map((k) => [p.getX(k), p.getZ(k)] as Point);
    const [a, b, c] = tri,
      det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(det) < 1e-10) continue;
    const pieces = clipping.difference([tri], mask);
    for (const poly of pieces) {
      const g = flatPolygon(
          poly[0].slice(0, -1).flat(),
          poly.slice(1).map((h) => h.slice(0, -1).flat()),
        ),
        q = g.getAttribute("position"),
        gi = g.getIndex()!;
      for (let j = 0; j < gi.count; j++) {
        const k = gi.getX(j),
          x = q.getX(k),
          z = q.getZ(k),
          wa = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / det,
          wb = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / det,
          wc = 1 - wa - wb;
        positions.push(
          x,
          wa * p.getY(ids[0]) + wb * p.getY(ids[1]) + wc * p.getY(ids[2]),
          z,
        );
        tex.push(
          uv
            ? wa * uv.getX(ids[0]) + wb * uv.getX(ids[1]) + wc * uv.getX(ids[2])
            : x,
          uv
            ? wa * uv.getY(ids[0]) + wb * uv.getY(ids[1]) + wc * uv.getY(ids[2])
            : z,
        );
      }
      g.dispose();
    }
  }
  const result = new T.BufferGeometry();
  result.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  result.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
  result.computeVertexNormals();
  geometry.dispose();
  return result;
}
