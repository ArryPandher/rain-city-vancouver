import { geo } from "./data";
import * as T from "three";
import source from "./gallery-rear-entry-data.json";
/** Repair only the authored rear entrance buried behind the mapped south wall.
 * Explicit reviewed source vertex ranges preserve all unrelated model surfaces. */
export function repairGalleryRearEntry(
  geometry: T.BufferGeometry,
  material: string,
) {
  const part = source.materials[material as keyof typeof source.materials];
  if (!part) return 0;
  const p = geometry.getAttribute("position");
  if (
    p.count !== part.positionCount ||
    geometry.getIndex()?.count !== part.indexCount
  ) {
    console.warn(
      "Gallery rear-entry source changed; leaving geometry untouched",
    );
    return 0;
  }
  const dx = -Math.sin(source.angle) * source.translationV,
    dz = Math.cos(source.angle) * source.translationV;
  for (const [first, last] of part.ranges)
    for (let i = first; i <= last; i++)
      p.setXYZ(i, p.getX(i) + dx, p.getY(i), p.getZ(i) + dz);
  p.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return part.selectedVertices;
}

/** Original source staircase, translated with the visual repair. */
export const GALLERY_REAR_STEPS = {
  origin: [-123.12046, 49.28287] as const,
  minU: -7.75,
  maxU: 3.95,
  startV: 12.1 + source.translationV,
  tread: 0.35,
  count: 12,
  rise: 3.2 / 12,
  datum: 0.08,
};
export function galleryRearStepHeight(x: number, z: number) {
  const [ox, oz] = geo(
    GALLERY_REAR_STEPS.origin[1],
    GALLERY_REAR_STEPS.origin[0],
  );
  const xx = x - ox,
    zz = z - oz,
    c = Math.cos(source.angle),
    s = Math.sin(source.angle);
  const u = c * xx + s * zz,
    v = -s * xx + c * zz,
    p = GALLERY_REAR_STEPS;
  if (
    u < p.minU ||
    u > p.maxU ||
    v < p.startV ||
    v >= p.startV + p.tread * p.count
  )
    return;
  const index = Math.min(
    p.count - 1,
    Math.floor((v - p.startV) / p.tread + 1e-8),
  );
  return p.datum + (p.count - index) * p.rise;
}

/** Remove only the part of a generic path ribbon covering the custom stair.
 * Split triangles at the stair rectangle, keeping the rest of each approach.
 * Re-evaluate exposed heights so a sampled stair endpoint cannot leave a ramp
 * floating outside the cut. The tiny collar covers source quantization error. */
export function clipGalleryStairPath(
  geometry: T.BufferGeometry,
  height: (x: number, z: number) => number,
  offset: number,
) {
  const p = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv"),
    index = geometry.getIndex();
  const [ox, oz] = geo(
    GALLERY_REAR_STEPS.origin[1],
    GALLERY_REAR_STEPS.origin[0],
  );
  const c = Math.cos(source.angle),
    s = Math.sin(source.angle),
    steps = GALLERY_REAR_STEPS,
    eps = 0.015;
  const local = (x: number, z: number) => [
    c * (x - ox) + s * (z - oz),
    -s * (x - ox) + c * (z - oz),
  ];
  let minU = Infinity,
    maxU = -Infinity,
    minV = Infinity,
    maxV = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const [u, v] = local(p.getX(i), p.getZ(i));
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const bounds = [
    steps.minU - eps,
    steps.maxU + eps,
    steps.startV - eps,
    steps.startV + steps.tread * steps.count + eps,
  ];
  if (
    maxU < bounds[0] ||
    minU > bounds[1] ||
    maxV < bounds[2] ||
    minV > bounds[3]
  )
    return geometry;
  type Vertex = {
    x: number;
    z: number;
    u: number;
    v: number;
    tx: number;
    ty: number;
  };
  const vertex = (i: number): Vertex => {
    const x = p.getX(i),
      z = p.getZ(i),
      [u, v] = local(x, z);
    return { x, z, u, v, tx: uv?.getX(i) ?? 0, ty: uv?.getY(i) ?? 0 };
  };
  const output: number[] = [],
    tex: number[] = [];
  const emit = (polygon: Vertex[]) => {
    for (let i = 1; i < polygon.length - 1; i++)
      for (const a of [polygon[0], polygon[i], polygon[i + 1]]) {
        output.push(a.x, height(a.x, a.z) + offset, a.z);
        tex.push(a.tx, a.ty);
      }
  };
  const planes = [
    (a: Vertex) => a.u - bounds[0],
    (a: Vertex) => bounds[1] - a.u,
    (a: Vertex) => a.v - bounds[2],
    (a: Vertex) => bounds[3] - a.v,
  ];
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    let remaining = [0, 1, 2].map((k) =>
      vertex(index ? index.getX(i + k) : i + k),
    );
    for (const distance of planes) {
      const inside: Vertex[] = [],
        outside: Vertex[] = [];
      for (let j = 0; j < remaining.length; j++) {
        const a = remaining[j],
          b = remaining[(j + 1) % remaining.length],
          da = distance(a),
          db = distance(b);
        (da >= 0 ? inside : outside).push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db),
            cut = {} as Vertex;
          for (const key of ["x", "z", "u", "v", "tx", "ty"] as const)
            cut[key] = a[key] + (b[key] - a[key]) * t;
          inside.push(cut);
          outside.push(cut);
        }
      }
      if (outside.length >= 3) emit(outside);
      remaining = inside;
      if (remaining.length < 3) break;
    }
  }
  const clipped = new T.BufferGeometry();
  clipped.setAttribute("position", new T.Float32BufferAttribute(output, 3));
  clipped.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
  clipped.computeVertexNormals();
  geometry.dispose();
  return clipped;
}
