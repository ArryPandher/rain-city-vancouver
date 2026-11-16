import * as T from "three";
import type { ArchitecturalMesh } from "./architectural-mesh";
import { GALLERY_BISTRO as D, galleryBistroRing } from "./gallery-bistro-data";

/** Union of the right stair cheek and the full bistro terrace: one closed
 * shell, no duplicated internal cheek face or retained source-cap overlay. */
export function addGalleryBistroPlatform(
  mesh: ArchitecturalMesh,
  stone: T.Material,
) {
  const ring = galleryBistroRing();
  const shape = new T.Shape(ring.map(([u, v]) => new T.Vector2(u, v)));
  const g = new T.ExtrudeGeometry(shape, {
    depth: D.top - D.bottom,
    bevelEnabled: false,
    steps: 1,
  });
  // (u,v,extrusion) -> (u,height,v) is a reflection. Reverse each triangle.
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    p.setXYZ(i, p.getX(i), D.bottom + p.getZ(i), p.getY(i));
  for (let i = 0; i < p.count; i += 3)
    for (const a of Object.values(g.attributes))
      for (let k = 0; k < a.itemSize; k++) {
        const j = (i + 1) * a.itemSize + k,
          l = (i + 2) * a.itemSize + k,
          q = a.array[j];
        a.array[j] = a.array[l];
        a.array[l] = q;
      }
  g.clearGroups();
  g.computeVertexNormals();
  mesh.add(g, stone);
}
export function addGalleryBistro(
  mesh: ArchitecturalMesh,
  stone: T.Material,
  metal: T.Material,
) {
  const fabric = new T.MeshStandardMaterial({
    name: "Gallery bistro off-white canvas",
    color: 0xdedbd0,
    roughness: 0.95,
    metalness: 0,
  });
  const leaf = new T.MeshStandardMaterial({
    name: "Gallery bistro clipped planting",
    color: 0x354b29,
    roughness: 1,
    metalness: 0,
  });
  for (const p of D.planters) {
    mesh.box(
      [
        (p.minU + p.maxU) / 2,
        D.top + D.planterHeight / 2,
        (p.minV + p.maxV) / 2,
      ],
      p.maxU - p.minU,
      D.planterHeight,
      p.maxV - p.minV,
      stone,
    );
    // Low clipped greenery with a restrained irregular silhouette. Closed
    // clusters stay inside their actual planter rather than billboard cards.
    const length = p.maxU - p.minU,
      alongU = length > p.maxV - p.minV,
      n = Math.ceil(Math.max(length, p.maxV - p.minV) / 0.31);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        u = alongU ? p.minU + t * length : (p.minU + p.maxU) / 2,
        v = alongU ? (p.minV + p.maxV) / 2 : p.minV + t * (p.maxV - p.minV);
      const h = D.foliageHeight * (0.9 + 0.08 * Math.sin(i * 2.4));
      const g = new T.IcosahedronGeometry(1, 1);
      g.scale(alongU ? 0.24 : 0.28, h / 2, alongU ? 0.29 : 0.24);
      g.translate(u, D.top + D.planterHeight + h / 2 - 0.035, v);
      mesh.add(g, leaf);
    }
  }
  for (const { u, v } of D.parasols) {
    // Square hipped canopy with a thin closed underside and four corner ribs.
    const r = D.canopyWidth / 2,
      e = D.top + D.canopyEave,
      peak = D.top + D.canopyPeak;
    const corners: [number, number, number][] = [
      [u - r, e, v - r],
      [u + r, e, v - r],
      [u + r, e, v + r],
      [u - r, e, v + r],
    ];
    const positions: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i],
        b = corners[(i + 1) % 4];
      positions.push(...a, u, peak, v, ...b); // upwards
      positions.push(
        ...[b[0], b[1] - 0.025, b[2]],
        u,
        peak - 0.025,
        v,
        ...[a[0], a[1] - 0.025, a[2]],
      );
      mesh.quad(fabric, a, b, [b[0], e - 0.025, b[2]], [a[0], e - 0.025, a[2]]);
      mesh.beam([u, peak - 0.04, v], [a[0], e - 0.04, a[2]], 0.013, metal, 6);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        Array((positions.length / 3) * 2).fill(0),
        2,
      ),
    );
    g.computeVertexNormals();
    mesh.add(g, fabric);
    mesh.beam([u, D.top, v], [u, peak, v], 0.027, metal, 10);
    mesh.box([u, D.top + 0.035, v], 0.48, 0.07, 0.48, metal);
    mesh.add(
      new T.CylinderGeometry(D.tableRadius, D.tableRadius, 0.045, 20).translate(
        u,
        D.top + D.tableHeight - 0.0225,
        v,
      ),
      metal,
    );
    // Four recognisable, full-size outdoor seats; sparse to retain an aisle.
    for (const [du, dv] of [
      [-0.85, 0],
      [0.85, 0],
      [0, -0.85],
      [0, 0.85],
    ]) {
      const x = u + du,
        z = v + dv,
        angle = Math.atan2(du, dv);
      mesh.box([x, D.top + 0.45, z], 0.43, 0.045, 0.43, metal, angle);
      const backU = x + Math.sin(angle) * 0.2,
        backV = z + Math.cos(angle) * 0.2;
      mesh.box([backU, D.top + 0.69, backV], 0.43, 0.38, 0.025, metal, angle);
      for (const a of [-0.16, 0.16])
        for (const b of [-0.16, 0.16])
          mesh.beam(
            [x + a, D.top, z + b],
            [x + a, D.top + 0.43, z + b],
            0.015,
            metal,
            6,
          );
    }
  }
}
