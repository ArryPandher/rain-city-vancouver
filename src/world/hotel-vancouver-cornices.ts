import * as T from "three";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import source from "./hotel-vancouver-cornice-source.json";

export const HOTEL_VANCOUVER_CORNICES = source;
type P = [number, number];
type V = [number, number, number];
/** Outward projection / height below the existing tier. Source-constrained
 * moulding, not a surveyed stone profile. Lower and roof tiers remain untouched. */
export function hotelCorniceProfile(level: number): P[] {
  const scale = level === 60 ? 0.78 : level === 80 ? 1 : 0.88;
  return [
    [-0.14, -1.35],
    [0.16, -1.35],
    [0.16, -1.17],
    [0.3, -1.17],
    [0.4, -1.02],
    [0.4, -0.86],
    [0.27, -0.86],
    [0.27, -0.64],
    [0.53, -0.64],
    [0.65, -0.49],
    [0.65, -0.25],
    [0.57, -0.13],
    [0.57, 0.035],
    [-0.14, 0.035],
  ].map(([out, y]) => [out * scale, y * scale]);
}
function outward(ring: number[][], i: number): P {
  const area = ring.reduce((n, p, k) => {
    const q = ring[(k + 1) % ring.length];
    return n + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const p = ring[i],
    q = ring[(i + 1) % ring.length];
  const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const sign = Math.sign(area);
  return [(sign * (q[1] - p[1])) / length, (-sign * (q[0] - p[0])) / length];
}
function corner(ring: number[][], i: number, distance: number): P {
  const a = outward(ring, (i + ring.length - 1) % ring.length),
    b = outward(ring, i);
  const d = 1 + a[0] * b[0] + a[1] * b[1];
  if (d < 0.01) throw new Error("Unsupported Hotel cornice corner");
  return [
    ring[i][0] + (distance * (a[0] + b[0])) / d,
    ring[i][1] + (distance * (a[1] + b[1])) / d,
  ];
}
export function createHotelVancouverCorniceGeometry() {
  const positions: number[] = [];
  function triangle(a: V, b: V, c: V, normal: V) {
    const av = new T.Vector3(...a),
      cross = new T.Vector3(...b).sub(av).cross(new T.Vector3(...c).sub(av));
    if (cross.dot(new T.Vector3(...normal)) < 0) [b, c] = [c, b];
    positions.push(...a, ...b, ...c);
  }
  for (const { level, rings } of source.levels) {
    const profile = hotelCorniceProfile(level);
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length,
          n = outward(ring, i);
        for (let k = 0; k < profile.length; k++) {
          const a = profile[k],
            b = profile[(k + 1) % profile.length];
          const at = (vertex: number, p: P): V => {
            const c = corner(ring, vertex, p[0]);
            return [c[0], level + p[1], c[1]];
          };
          const p = at(i, a),
            q = at(j, a),
            r = at(j, b),
            s = at(i, b);
          const normal: V = [
            (b[1] - a[1]) * n[0],
            -(b[0] - a[0]),
            (b[1] - a[1]) * n[1],
          ];
          triangle(p, q, r, normal);
          triangle(p, r, s, normal);
        }
      }
  }
  const g = new T.BufferGeometry().setAttribute(
    "position",
    new T.Float32BufferAttribute(positions, 3),
  );
  g.computeVertexNormals();
  landmarkSurfaceUV(g, [1, 1]);
  return g;
}
const hash = (h: number, v: number) => Math.imul(h ^ v, 16777619) >>> 0;
/** Complete baked-stone fingerprint before the shared metric UV pass. */
export function hotelVancouverCornicesCompatible(
  g: T.BufferGeometry,
  material: string,
) {
  const p = g.getAttribute("position"),
    ix = g.index;
  if (
    material !== "stone" ||
    !p ||
    p.count !== source.vertices ||
    p.itemSize !== 3 ||
    !ix ||
    ix.count !== source.indices ||
    g.groups.length ||
    g.drawRange.start !== 0 ||
    g.drawRange.count !== Infinity
  )
    return false;
  let ph = 2166136261,
    ih = 2166136261;
  for (let i = 0; i < p.count; i++)
    for (const v of [p.getX(i), p.getY(i), p.getZ(i)]) {
      if (!Number.isFinite(v)) return false;
      ph = hash(ph, Math.round(v * 1000));
    }
  for (let i = 0; i < ix.count; i++) ih = hash(ih, ix.getX(i));
  return ph === source.positionFingerprint && ih === source.indexFingerprint;
}
/** Build first, then atomically remove only the 56 isolated original tier bars.
 * Every retained attribute and ordered triangle remains bit-identical. */
export function replaceHotelVancouverCornices(
  g: T.BufferGeometry,
  material: string,
) {
  if (!hotelVancouverCornicesCompatible(g, material)) return null;
  const replacement = createHotelVancouverCorniceGeometry();
  const remove = new Set(source.removedTriangles),
    kept: number[] = [],
    ix = g.index!;
  for (let i = 0; i < ix.count; i += 3)
    if (!remove.has(i / 3))
      kept.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
  g.setIndex(kept);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return replacement;
}
