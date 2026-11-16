import * as T from "three";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import source from "./gallery-hooper-source.json";

/** Retained Hooper hall east end; three bays/four engaged Ionic pilasters are
 * visible in Rabich2022. Depths/profile sections are bounded photographic estimates. */
export const GALLERY_HOOPER = {
  a: source.a as [number, number],
  b: source.b as [number, number],
  length: source.length,
  bottom: 3.2,
  top: 13.15,
  windowWidth: 2.65,
  rows: [
    [4.35, 7.85],
    [9.05, 12.2],
  ] as const,
  recess: 0.38,
  pilasterInset: 0.65,
  pilasterWidth: 0.76,
  projection: 0.26,
  gable: { u: -8.756, start: 33.704, end: 49.355, spring: 14, apex: 18 },
} as const;
const keys = new Map(
  Object.entries(source.materials).map(([name, s]) => [
    name,
    new Set(s.triangles.map((t) => t.join(","))),
  ]),
);

/** Checks actual decoded coordinates and complete ordered triangle identities.
 * Counts alone cannot authorize a cut when an asset changes in place. */
export function galleryHooperSourceCompatible(
  g: T.BufferGeometry,
  name: string,
) {
  if (name !== "stone" && name !== "glass") return true;
  const s = source.materials[name],
    p = g.getAttribute("position"),
    ix = g.index;
  if (!p || !ix || p.count !== s.positionCount) return false;
  const c = Math.cos(source.angle),
    n = Math.sin(source.angle);
  for (const [id, u, y, v] of s.vertices) {
    const x = p.getX(id),
      z = p.getZ(id);
    if (
      Math.abs(c * x + n * z - u) > 0.00008 ||
      Math.abs(p.getY(id) - y) > 0.00008 ||
      Math.abs(-n * x + c * z - v) > 0.00008
    )
      return false;
  }
  const expected = keys.get(name)!,
    found = new Set<string>();
  for (let i = 0; i < ix.count; i += 3) {
    const key = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)].join(",");
    if (expected.has(key)) found.add(key);
  }
  return found.size === expected.size;
}

export function removeOriginalGalleryHooperFace(
  g: T.BufferGeometry,
  name: string,
) {
  const selected = keys.get(name);
  if (!selected || !galleryHooperSourceCompatible(g, name)) return 0;
  const ix = g.index!,
    keep: number[] = [];
  let removed = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (selected.has(ids.join(","))) removed++;
    else keep.push(...ids);
  }
  if (removed) g.setIndex(keep);
  return removed;
}

export function galleryHooperBays() {
  const d = GALLERY_HOOPER,
    span = d.length - 2 * d.pilasterInset;
  return Array.from(
    { length: 3 },
    (_, i) => d.pilasterInset + (span * (i + 0.5)) / 3,
  );
}

/** Added to the existing facade batch. No new material, texture, probe or light
 * is needed; the Hooper panes retain the source glass/environment rather than
 * borrowing the rear elevation's direction-specific local reflection. */
export function addGalleryHooperFacade(
  mesh: ArchitecturalMesh,
  stone: T.Material,
  frame: T.Material,
  glass: T.Material,
) {
  const d = GALLERY_HOOPER,
    { p: at } = facadeFrame(d.a, d.b);
  const quad = (
    m: T.Material,
    l: number,
    r: number,
    b: number,
    t: number,
    z = 0,
  ) => mesh.quad(m, at(l, b, z), at(l, t, z), at(r, t, z), at(r, b, z));
  const box = (
    l: number,
    r: number,
    b: number,
    t: number,
    front: number,
    back: number,
    m = stone,
  ) => {
    quad(m, l, r, b, t, front);
    mesh.quad(
      m,
      at(r, b, back),
      at(r, t, back),
      at(l, t, back),
      at(l, b, back),
    );
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
  };
  const holes = d.rows.flatMap(([b, t]) =>
    galleryHooperBays().map((x) => ({
      l: x - d.windowWidth / 2,
      r: x + d.windowWidth / 2,
      b,
      t,
    })),
  );
  const xs = [0, d.length, ...holes.flatMap((h) => [h.l, h.r])].sort(
      (a, b) => a - b,
    ),
    ys = [d.bottom, d.top, ...holes.flatMap((h) => [h.b, h.t])].sort(
      (a, b) => a - b,
    );
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const l = xs[i - 1],
        r = xs[i],
        b = ys[j - 1],
        t = ys[j];
      if (
        r - l < 1e-5 ||
        t - b < 1e-5 ||
        holes.some(
          (h) =>
            (l + r) / 2 > h.l &&
            (l + r) / 2 < h.r &&
            (b + t) / 2 > h.b &&
            (b + t) / 2 < h.t,
        )
      )
        continue;
      quad(stone, l, r, b, t);
    }
  for (const h of holes) {
    const { l, r, b, t } = h,
      z = d.recess;
    quad(glass, l, r, b, t, z);
    // Aperture-facing jamb, sill and head surfaces close every oblique view.
    mesh.quad(stone, at(l, t), at(l, t, z), at(l, b, z), at(l, b));
    mesh.quad(stone, at(r, t, z), at(r, t), at(r, b), at(r, b, z));
    mesh.quad(stone, at(r, t), at(r, t, z), at(l, t, z), at(l, t));
    mesh.quad(stone, at(r, b, z), at(r, b), at(l, b), at(l, b, z));
    for (const [ll, rr, bb, tt] of [
      [l, l + 0.055, b, t],
      [r - 0.055, r, b, t],
      [l, r, b, b + 0.055],
      [l, r, t - 0.055, t],
      [(l + r) / 2 - 0.025, (l + r) / 2 + 0.025, b, t],
      [l, r, (b + t) / 2 - 0.025, (b + t) / 2 + 0.025],
    ])
      box(ll, rr, bb, tt, 0.29, 0.37, frame);
    box(l - 0.18, r + 0.18, b - 0.18, b - 0.04, -0.23, 0.04);
    box(l - 0.12, r + 0.12, b - 0.24, b - 0.18, -0.14, 0.04);
    box(l - 0.16, l, b - 0.04, t + 0.16, -0.13, 0.03);
    box(r, r + 0.16, b - 0.04, t + 0.16, -0.13, 0.03);
    box(l - 0.16, r + 0.16, t, t + 0.16, -0.15, 0.03);
    box(l - 0.23, r + 0.23, t + 0.16, t + 0.27, -0.22, 0.03);
  }
  const pilasterSpan = d.length - 2 * d.pilasterInset;
  for (let i = 0; i < 4; i++) {
    const x = d.pilasterInset + (pilasterSpan * i) / 3;
    box(x - 0.54, x + 0.54, 3.2, 3.43, -0.34, 0.04);
    box(x - 0.46, x + 0.46, 3.43, 3.58, -0.3, 0.04);
    box(
      x - d.pilasterWidth / 2,
      x + d.pilasterWidth / 2,
      3.58,
      12.47,
      -d.projection,
      0.04,
    );
    box(x - 0.45, x + 0.45, 12.36, 12.49, -0.32, 0.04);
    box(x - 0.59, x + 0.59, 12.49, 12.8, -0.39, 0.04);
    box(x - 0.66, x + 0.66, 12.8, 13.0, -0.43, 0.04);
    for (const side of [-1, 1]) {
      const g = new T.TorusGeometry(0.155, 0.041, 6, 12);
      g.rotateY(
        Math.atan2((d.b[1] - d.a[1]) / d.length, -(d.b[0] - d.a[0]) / d.length),
      );
      g.translate(...at(x + side * 0.36, 12.615, -0.43));
      mesh.add(g, stone);
    }
  }
  // Continuous stepped entablature closes onto the retained13.15–14m roof band.
  for (const [b, t, front] of [
    [13, 13.18, -0.34],
    [13.18, 13.65, -0.18],
    [13.65, 13.78, -0.28],
    [13.78, 13.92, -0.45],
    [13.92, 14.05, -0.53],
  ])
    box(0, d.length, b, t, front, 0.035);
  for (let x = 0.22; x < d.length - 0.15; x += 0.38)
    box(x - 0.095, x + 0.095, 13.59, 13.79, -0.39, -0.12);
  // Closed profiled triangular annulus, inset under the original roof silhouette.
  const g = d.gable,
    half = (g.end - g.start) / 2,
    mid = (g.start + g.end) / 2,
    slope = (g.apex - g.spring) / half;
  const ring = (inset: number, projection: number): Vertex3[] => {
    const top = g.apex - inset * Math.hypot(1, slope),
      bottom = g.spring + inset,
      w = (top - bottom) / slope;
    return [
      [g.u + projection, bottom, mid - w],
      [g.u + projection, top, mid],
      [g.u + projection, bottom, mid + w],
    ];
  };
  const rings = [
    ring(0, -0.015),
    ring(0.035, 0.34),
    ring(0.14, 0.34),
    ring(0.2, 0.22),
    ring(0.31, 0.22),
    ring(0.36, -0.015),
  ];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) % 3;
      mesh.quad(
        stone,
        rings[j - 1][i],
        rings[j - 1][k],
        rings[j][k],
        rings[j][i],
      );
    }
  for (let i = 0; i < 3; i++) {
    const k = (i + 1) % 3;
    mesh.quad(
      stone,
      rings[0][k],
      rings[0][i],
      rings.at(-1)![i],
      rings.at(-1)![k],
    );
  }
}
