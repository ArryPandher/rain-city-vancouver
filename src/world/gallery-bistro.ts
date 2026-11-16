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
    mesh.add(galleryBistroHedgeGeometry(p), leaf);
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

/** A single connected planted mass per trough. Unequal multiscale surface
 * variation avoids the repeated hemispherical highlight of discrete shrubs. */
export function galleryBistroHedgeGeometry(p: (typeof D.planters)[number]) {
  const alongU = p.maxU - p.minU > p.maxV - p.minV;
  const start = (alongU ? p.minU : p.minV) + 0.035;
  const end = (alongU ? p.maxU : p.maxV) - 0.035;
  const centre = alongU ? (p.minV + p.maxV) / 2 : (p.minU + p.maxU) / 2;
  const half = (alongU ? p.maxV - p.minV : p.maxU - p.minU) / 2 - 0.035;
  const n = Math.ceil((end - start) / 0.16),
    positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const section = [
    [-0.9, 0],
    [0.9, 0],
    [1, 0.4],
    [0.9, 0.8],
    [0.4, 1],
    [-0.35, 0.98],
    [-0.88, 0.82],
    [-1, 0.43],
  ];
  for (let i = 0; i <= n; i++) {
    const station = start + ((end - start) * i) / n;
    for (let j = 0; j < section.length; j++) {
      const [w, h] = section[j];
      const noise =
        Math.sin(i * 1.713 + j * 2.173) * 0.011 +
        Math.sin(i * 0.419 + j * 0.97) * 0.016;
      const broad =
        Math.sin(i * 0.197) * 0.015 + Math.sin(i * 0.071 + 0.7) * 0.018;
      const width = w * (half - 0.018 + noise * 0.55);
      const y =
        D.top +
        D.planterHeight -
        0.035 +
        h * (D.foliageHeight - 0.045 + broad) +
        (h ? noise : 0);
      positions.push(
        ...(alongU
          ? [station, y, centre + width]
          : [centre + width, y, station]),
      );
      uv.push(station, w);
    }
  }
  const k = section.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k; j++) {
      const a = i * k + j,
        b = (i + 1) * k + j,
        c = (i + 1) * k + ((j + 1) % k),
        d = i * k + ((j + 1) % k);
      indices.push(a, b, c, a, c, d);
    }
  for (let j = 1; j < k - 1; j++) {
    indices.push(0, j, j + 1);
    indices.push(n * k, n * k + j + 1, n * k + j);
  }
  if (!alongU)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
