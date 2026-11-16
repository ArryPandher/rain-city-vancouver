import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import data from "./g3-terminal-source.json";
export const G3_TERMINAL = data;
export const G3_GALLERY = {
  width: 3.6,
  deckRise: 0.6,
  railHeight: 1.5,
  postSpacing: 3,
  axis: [0.2804, -0.9599] as const,
};
const accepted = new Map(data.bins.map((b) => [b.id, b]));
export function isG3Silo(id: string) {
  return accepted.has(id);
}
/** All 48 original rings must match before any source cylinder is replaced. */
export function preflightG3Silos(buildings: Building[]) {
  const found = buildings.filter((b) => accepted.has(b.id));
  return (
    found.length === 48 &&
    new Set(found.map((b) => b.id)).size === 48 &&
    found.every((b) => {
      const source = accepted.get(b.id)!;
      return (
        b.kind === "yes" &&
        b.height === undefined &&
        b.levels === undefined &&
        b.pts.length === source.pts.length &&
        b.pts.every((v, i) => v === source.pts[i])
      );
    })
  );
}
type P = [number, number, number];
export function createG3TerminalGeometry(
  ground: (x: number, z: number) => number = () => 0,
) {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    steel: T.BufferGeometry[] = [],
    housing: T.BufferGeometry[] = [];
  const supports: {
    point: [number, number];
    bottom: number;
    top: number;
    silo: string;
  }[] = [];
  function triangle(a: P, b: P, c: P, n: P, smoothCentre?: [number, number]) {
    const normal = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (normal.dot(new T.Vector3(...n)) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) {
      positions.push(...p);
      if (smoothCentre) {
        const dx = p[0] - smoothCentre[0],
          dz = p[2] - smoothCentre[1],
          length = Math.hypot(dx, dz);
        normals.push(dx / length, 0, dz / length);
        uvs.push((Math.atan2(dz, dx) * length) / 4, p[1] / 4);
      } else {
        normals.push(...n);
        uvs.push(p[0] / 4, p[2] / 4);
      }
    }
  }
  const bins = data.bins.map((b) => {
    const ring = Array.from(
        { length: b.pts.length / 2 },
        (_, i) => [b.pts[i * 2], b.pts[i * 2 + 1]] as [number, number],
      ),
      centre = ring.reduce(
        (v, p) => [v[0] + p[0] / ring.length, v[1] + p[1] / ring.length],
        [0, 0] as [number, number],
      ),
      base = ground(...centre),
      roof = base + data.cylinderHeight;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length],
        a: P = [p[0], ground(...p), p[1]],
        b: P = [q[0], ground(...q), q[1]],
        c: P = [q[0], roof, q[1]],
        d: P = [p[0], roof, p[1]],
        v = new T.Vector3(
          (p[0] + q[0]) / 2 - centre[0],
          0,
          (p[1] + q[1]) / 2 - centre[1],
        ).normalize();
      triangle(a, b, c, v.toArray() as P, centre);
      triangle(a, c, d, v.toArray() as P, centre);
      triangle([centre[0], roof, centre[1]], d, c, [0, 1, 0]);
      triangle([centre[0], base, centre[1]], b, a, [0, -1, 0]);
    }
    return { id: b.id, ring, centre, base, roof };
  });
  function beam(
    out: T.BufferGeometry[],
    a: P,
    b: P,
    width: number,
    depth: number,
  ) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      dir = bv.clone().sub(av),
      g = new T.BoxGeometry(width, depth, dir.length());
    const forward = dir.normalize(),
      right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), forward);
    if (right.lengthSq() < 1e-10) right.set(1, 0, 0);
    else right.normalize();
    const up = new T.Vector3().crossVectors(forward, right);
    g.applyMatrix4(
      new T.Matrix4()
        .makeBasis(right, up, forward)
        .setPosition(av.add(bv).multiplyScalar(0.5)),
    );
    out.push(g);
  }
  const galleries = [];
  const u = new T.Vector2(...G3_GALLERY.axis).normalize(),
    v = new T.Vector2(-u.y, u.x);
  for (let annex = 0; annex < 3; annex++) {
    const group = bins.slice(annex * 16, annex * 16 + 16),
      project = (b: (typeof bins)[number], axis: T.Vector2) =>
        b.centre[0] * axis.x + b.centre[1] * axis.y,
      sorted = [...group].sort((a, b) => project(a, v) - project(b, v));
    const groups = Array.from({ length: 4 }, (_, i) =>
        sorted.slice(i * 4, i * 4 + 4),
      ),
      mid = group.reduce((s, b) => s + project(b, v), 0) / 16;
    const row = groups
      .sort(
        (a, b) =>
          Math.abs(a.reduce((s, b) => s + project(b, v), 0) / 4 - mid) -
          Math.abs(b.reduce((s, b) => s + project(b, v), 0) / 4 - mid),
      )[0]
      .sort((a, b) => project(a, u) - project(b, u));
    const transverse = row.reduce((s, b) => s + project(b, v), 0) / 4,
      lo = project(row[0], u) - 4,
      hi = project(row.at(-1)!, u) + 4,
      floor = Math.max(...row.map((b) => b.roof)) + G3_GALLERY.deckRise;
    const at = (s: number, side: number, y: number): P => [
      u.x * s + v.x * (transverse + side),
      y,
      u.y * s + v.y * (transverse + side),
    ];
    beam(steel, at(lo, 0, floor), at(hi, 0, floor), G3_GALLERY.width, 0.14);
    beam(housing, at(lo, 0, floor + 0.48), at(hi, 0, floor + 0.48), 1.15, 0.62);
    for (const b of row)
      for (const side of [-1.35, 1.35]) {
        const p = at(project(b, u), side, b.roof),
          q = at(project(b, u), side, floor - 0.07);
        beam(steel, p, q, 0.16, 0.16);
        supports.push({
          point: [p[0], p[2]],
          bottom: p[1],
          top: q[1],
          silo: b.id,
        });
      }
    const n = Math.ceil((hi - lo) / G3_GALLERY.postSpacing);
    for (const side of [-1.65, 1.65]) {
      beam(
        steel,
        at(lo, side, floor + G3_GALLERY.railHeight),
        at(hi, side, floor + G3_GALLERY.railHeight),
        0.08,
        0.08,
      );
      for (let i = 0; i <= n; i++) {
        const s = lo + ((hi - lo) * i) / n;
        beam(
          steel,
          at(s, side, floor + 0.07),
          at(s, side, floor + G3_GALLERY.railHeight),
          0.08,
          0.08,
        );
        if (i < n)
          beam(
            steel,
            at(s, side, floor + 0.13),
            at(
              lo + ((hi - lo) * (i + 1)) / n,
              side,
              floor + G3_GALLERY.railHeight - 0.08,
            ),
            0.07,
            0.07,
          );
      }
    }
    galleries.push({
      annex,
      lo,
      hi,
      transverse,
      floor,
      supportIds: row.map((b) => b.id),
    });
  }
  const concrete = new T.BufferGeometry();
  concrete.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  concrete.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  concrete.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  const merge = (geometries: T.BufferGeometry[]) => {
    const merged = mergeGeometries(geometries)!;
    geometries.forEach((g) => g.dispose());
    return merged;
  };
  const result = { concrete, steel: merge(steel), housing: merge(housing) };
  return {
    ...result,
    bins,
    galleries,
    supports,
    triangles: Object.values(result).reduce(
      (n, g) => n + (g.index?.count ?? g.attributes.position.count) / 3,
      0,
    ),
  };
}
export function createG3TerminalMaterials() {
  const size = 64,
    pixels = new Uint8Array(size * size * 4);
  let seed = 3187;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 235 + (seed % 13) - (y === 0 ? 8 : 0),
        i = (y * size + x) * 4;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  const map = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return {
    concrete: new T.MeshStandardMaterial({
      color: 0xb4b2a7,
      map,
      roughness: 0.88,
    }),
    steel: new T.MeshStandardMaterial({
      color: 0x686f70,
      roughness: 0.64,
      metalness: 0.55,
    }),
    housing: new T.MeshStandardMaterial({
      color: 0xb5b8b5,
      roughness: 0.68,
      metalness: 0.32,
    }),
  };
}
/** One source-validated assembly, then suppress precisely its 48 generic fallbacks. */
export function createG3TerminalAssembly(
  buildings: Building[],
  ground: (x: number, z: number) => number,
) {
  const valid = preflightG3Silos(buildings);
  let emitted = false;
  return (b: Building, batch: Batcher) => {
    if (!valid || !accepted.has(b.id)) return false;
    if (!emitted) {
      const geometry = createG3TerminalGeometry(ground),
        materials = createG3TerminalMaterials(),
        old = batch.offsetY;
      batch.offsetY = 0;
      try {
        for (const key of ["concrete", "steel", "housing"] as const)
          batch.add(
            geometry[key],
            materials[key],
            5466.15,
            -2337.05,
            `g3-${key}`,
          );
      } finally {
        batch.offsetY = old;
      }
      emitted = true;
    }
    return true;
  };
}
