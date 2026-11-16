import * as T from "three";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { addGalleryBistro } from "./gallery-bistro";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import { Batcher } from "./geometry";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import entry from "./gallery-rear-entry-data.json";
import { addGalleryEntryCornice } from "./gallery-entry-cornice";
import { createGalleryAshlarMaterial } from "./gallery-ashlar-material";
import { createGalleryStairMaterial } from "./gallery-stair-material";
import { addGalleryStairFraming } from "./gallery-stair-framing";
import {
  addGalleryEntryStairs,
  removeOriginalGalleryStairs,
} from "./gallery-entry-stairs";

// Two nearly collinear mapped rear edges form one continuous nine-bay elevation.
function edge(a: number[], b: number[], bays: number) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return { a, b, bays, length, dx, dz, nx: dz, nz: -dx, angle: entry.angle };
}
export const GALLERY_FACADE_EDGES = [
  edge([19.452, 23.181], [0.413, 23.62], 6),
  edge([0.413, 23.62], [-8.872, 23.82], 3),
];
export const GALLERY_FACADE = GALLERY_FACADE_EDGES[0];
/** Rear-window capture outside the actual sloping facade, in the same asset
 * frame as its panes. The probe does not assign its view to other elevations. */
export function galleryFacadeReflection(
  chunks: readonly T.Mesh[],
  x: number,
  z: number,
): ReflectionProbeSpec | undefined {
  const materials = [
    ...new Set(
      chunks.flatMap((mesh) =>
        Array.isArray(mesh.material) ? mesh.material : [mesh.material],
      ),
    ),
  ].filter(
    (material): material is T.MeshStandardMaterial =>
      material instanceof T.MeshStandardMaterial &&
      !!material.userData.galleryRearPane,
  );
  if (!materials.length) return;
  const face = GALLERY_FACADE,
    along = face.length / 2;
  const point = new T.Vector3(
    face.a[0] + face.dx * along + face.nx * 2.5,
    7,
    face.a[1] + face.dz * along + face.nz * 2.5,
  ).applyAxisAngle(new T.Vector3(0, 1, 0), -entry.angle);
  return {
    name: "Gallery Robson facade",
    position: [point.x + x, point.y + 0.08, point.z + z],
    materials,
    resolution: 256,
  };
}
function local(x: number, z: number) {
  const c = Math.cos(entry.angle),
    s = Math.sin(entry.angle);
  return [c * x + s * z, -s * x + c * z];
}
/** Fail closed on a changed source asset; do not layer a replacement over it. */
export function galleryFacadeCompatible(root: T.Object3D) {
  const expected: Record<string, [number, number]> = {
    foundation: [4063, 8199],
    glass: [1196, 1848],
    stone: [19388, 52020],
  };
  const found = new Set<string>();
  let valid = true;
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const name = (object.material as T.Material).name,
      counts = expected[name];
    if (!counts) return;
    if (
      found.has(name) ||
      object.geometry.getAttribute("position").count !== counts[0] ||
      object.geometry.getIndex()?.count !== counts[1]
    )
      valid = false;
    found.add(name);
  });
  return valid && found.size === 3;
}

/** Replace the continuous nine-bay rear elevation. Source-pinned entry ranges
 * explicitly protect translated stair, column and pediment geometry. */
export function replaceGalleryWingFaces(g: T.BufferGeometry, material: string) {
  if (!["stone", "foundation", "glass"].includes(material)) return 0;
  const removedStairs = removeOriginalGalleryStairs(g, material);
  const p = g.getAttribute("position"),
    ix = g.getIndex(),
    kept: number[] = [];
  let removed = 0;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j));
    const protectedRanges =
      entry.materials[material as keyof typeof entry.materials]?.ranges ?? [];
    const entryPart = ids.some((id) =>
      protectedRanges.some(([first, last]) => id >= first && id <= last),
    );
    const selected =
      !entryPart &&
      GALLERY_FACADE_EDGES.some(({ a, dx, dz, nx, nz, length }) => {
        const v = ids.map((j) => {
          const [u, w] = local(p.getX(j), p.getZ(j));
          return {
            x: (u - a[0]) * dx + (w - a[1]) * dz,
            d: -((u - a[0]) * nx + (w - a[1]) * nz),
            y: p.getY(j),
          };
        });
        const base = v.every((q) => q.y <= 3.205);
        return (
          v.every(
            (q) =>
              q.x >= -0.006 &&
              q.x <= length + 0.006 &&
              q.d >= -0.006 &&
              q.d <= 0.286 &&
              q.y >= -0.006 &&
              q.y <= 13.155,
          ) &&
          v.reduce((sum, q) => sum + q.x, 0) / 3 < length - 0.01 &&
          (base || v.every((q) => q.y >= 3.195))
        );
      });
    if (selected) removed++;
    else kept.push(...ids);
  }
  if (removed) g.setIndex(kept);
  return removed + removedStairs;
}

export function addGalleryFacade(
  parent: T.Object3D,
  materials: Map<string, T.MeshStandardMaterial>,
) {
  const stone = materials.get("stone"),
    base = materials.get("foundation"),
    sourceGlass = materials.get("glass");
  if (!stone || !base || !sourceGlass) return [];
  const glass = sourceGlass.clone();
  glass.userData.galleryRearPane = true;
  const wallStone = createGalleryAshlarMaterial(stone);
  const root = new T.Group();
  root.name = "Gallery southeast wing and engaged entrance";
  root.rotation.y = -entry.angle;
  parent.add(root);
  const batch = new Batcher(root, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const frame = new T.MeshStandardMaterial({
    name: "Gallery dark sash frames",
    color: 0x393c38,
    roughness: 0.72,
    metalness: 0.1,
  });
  for (const { a, dx, dz, nx, nz, length, bays } of GALLERY_FACADE_EDGES) {
    function at(x: number, y: number, depth = 0): Vertex3 {
      return [a[0] + dx * x - nx * depth, y, a[1] + dz * x - nz * depth];
    }
    function quad(
      m: T.Material,
      l: number,
      r: number,
      b: number,
      t: number,
      d = 0,
    ) {
      mesh.quad(m, at(l, b, d), at(l, t, d), at(r, t, d), at(r, b, d));
    }
    function box(
      l: number,
      r: number,
      b: number,
      t: number,
      front: number,
      back: number,
      m: T.Material,
    ) {
      // Each face uses the edge's local horizontal direction; no assumed axis alignment.
      quad(m, l, r, b, t, front);
      mesh.quad(
        m,
        at(l, b, front),
        at(r, b, front),
        at(r, b, back),
        at(l, b, back),
      );
      mesh.quad(
        m,
        at(l, t, front),
        at(l, t, back),
        at(r, t, back),
        at(r, t, front),
      );
      mesh.quad(
        m,
        at(l, b, front),
        at(l, b, back),
        at(l, t, back),
        at(l, t, front),
      );
      mesh.quad(
        m,
        at(r, b, front),
        at(r, t, front),
        at(r, t, back),
        at(r, b, back),
      );
    }
    for (const foundation of [true, false]) {
      const mat = foundation ? base : wallStone,
        end = length,
        lo = foundation ? 0 : 3.2,
        hi = foundation ? 3.2 : 13.15;
      // The photograph shows a shorter upper sash row than the repeated source openings.
      const rows = foundation
        ? [[1, 2.35]]
        : [
            [4.35, 7.85],
            [9.55, 11.75],
          ];
      const width = foundation ? 1.05 : 1.65;
      const holes = rows.flatMap(([b, t]) =>
        Array.from({ length: bays }, (_, j) => {
          const centre = ((j + 0.5) * length) / bays;
          return { l: centre - width / 2, r: centre + width / 2, b, t };
        }),
      );
      const xs = [0, end, ...holes.flatMap((h) => [h.l, h.r])];
      const ys = [lo, hi, ...holes.flatMap((h) => [h.b, h.t])];
      // Physical horizontal rustication, confined to the replaced base faces.
      if (foundation) for (let y = 0.52; y < hi; y += 0.52) ys.push(y);
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++)
        for (let j = 1; j < ys.length; j++) {
          const l = xs[i - 1],
            r = xs[i],
            b = ys[j - 1],
            t = ys[j];
          if (
            r - l < 0.001 ||
            t - b < 0.001 ||
            holes.some(
              (h) =>
                (l + r) / 2 > h.l &&
                (l + r) / 2 < h.r &&
                (b + t) / 2 > h.b &&
                (b + t) / 2 < h.t,
            )
          )
            continue;
          if (foundation) {
            quad(mat, l, r, b, t, 0.035);
            box(l, r, b + 0.012, t - 0.012, 0, 0.035, mat);
          } else quad(mat, l, r, b, t);
        }
      for (const h of holes) {
        const { l, r, b, t } = h,
          depth = 0.38;
        quad(glass, l, r, b, t, depth);
        // Aperture normals face the opening (jambs inward, head down, sill up).
        mesh.quad(mat, at(l, t), at(l, t, depth), at(l, b, depth), at(l, b));
        mesh.quad(mat, at(r, t, depth), at(r, t), at(r, b), at(r, b, depth));
        mesh.quad(mat, at(r, t), at(r, t, depth), at(l, t, depth), at(l, t));
        mesh.quad(mat, at(r, b, depth), at(r, b), at(l, b), at(l, b, depth));
        // Dark perimeter sash and one meeting rail, replacing the pale centre cross.
        for (const [ll, rr, bb, tt] of [
          [l, l + 0.055, b, t],
          [r - 0.055, r, b, t],
          [l, r, b, b + 0.055],
          [l, r, t - 0.055, t],
          [l, r, (b + t) / 2 - 0.025, (b + t) / 2 + 0.025],
        ])
          box(ll, rr, bb, tt, 0.29, 0.37, frame);
        // Projecting stone sill, drip lip and shallow jamb architraves seen in the reference.
        box(l - 0.13, r + 0.13, b - 0.16, b - 0.035, -0.16, 0.06, mat);
        box(l - 0.1, r + 0.1, b - 0.205, b - 0.16, -0.1, 0.04, mat);
        if (!foundation) {
          box(l - 0.09, l, b - 0.035, t + 0.09, -0.055, 0.04, mat);
          box(r, r + 0.09, b - 0.035, t + 0.09, -0.055, 0.04, mat);
          box(l - 0.09, r + 0.09, t, t + 0.09, -0.065, 0.04, mat);
        }
      }
    }
  }
  // The real rear composition has four engaged shafts. Retain its two existing
  // outer columns and add only the missing pair, at their shared repaired datum.
  for (const x of [-8.8 + (4.95 + 8.8) / 3, -8.8 + (2 * (4.95 + 8.8)) / 3]) {
    const z = 12.17 + entry.translationV;
    mesh.add(
      new T.CylinderGeometry(0.554, 0.554, 0.22, 16).translate(x, 3.31, z),
      stone,
    );
    mesh.add(
      new T.LatheGeometry(
        [
          [0.554, 3.42],
          [0.546, 3.56],
          [0.42, 3.73],
          [0.403, 3.8],
          [0.344, 13.22],
          [0.42, 13.3],
          [0.42, 13.43],
        ].map(([r, y]) => new T.Vector2(r, y)),
        16,
      ).translate(x, 0, z),
      stone,
    );
    mesh.box([x, 13.65, z], 1.218, 0.5, 1.134, stone);
  }
  addGalleryEntryCornice(mesh, stone);
  addGalleryStairFraming(mesh, base, frame);
  addGalleryEntryStairs(mesh, createGalleryStairMaterial(base));
  addGalleryBistro(mesh, base, frame);
  mesh.finish();
  const chunks = batch.finish();
  for (const chunk of chunks) {
    landmarkSurfaceUV(chunk.geometry, [1, 1]);
    chunk.name = root.name;
  }
  return chunks;
}
