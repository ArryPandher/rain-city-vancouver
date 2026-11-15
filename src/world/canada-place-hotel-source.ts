import * as T from "three";
import { bakeGeometry } from "./geometry";

/** Source Codriver CC-BY-4.0 HOTEL insetRing(.94), face15 only. No caps/returns. */
export const CANADA_PLACE_HOTEL_SOURCE = {
  concrete: {
    vertices: 8368,
    indices: 11154,
    indexFingerprint: 1369104451,
    fingerprint: 1414622155,
    selected: [3906, 3907, 3908, 3909, 3910, 3911],
    y: [14.65, 20.2],
    offset: 0,
  },
  glass: {
    vertices: 2424,
    indices: 3384,
    indexFingerprint: 1336512461,
    fingerprint: 1183434523,
    selected: [1628, 1629, 1630, 1628, 1630, 1631],
    y: [15.5, 19],
    offset: 0.2,
  },
  trim: {
    vertices: 34749,
    indices: 54198,
    indexFingerprint: 1514902125,
    fingerprint: 3092327902,
    selected: [33181, 33182, 33183, 33181, 33183, 33184],
    y: [19.55, 20.1],
    offset: 0.24,
  },
} as const;
const a = [-137.68663022694864, 30.959314360481272],
  b = [-180.6373168107633, 54.04296924914311];
const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
  dx = (b[0] - a[0]) / length,
  dz = (b[1] - a[1]) / length;
function selectedTriangles(
  g: T.BufferGeometry,
  material: string,
): number[] | null {
  const spec =
    CANADA_PLACE_HOTEL_SOURCE[
      material as keyof typeof CANADA_PLACE_HOTEL_SOURCE
    ];
  const p = g.getAttribute("position"),
    ix = g.getIndex();
  if (
    !spec ||
    !p ||
    !ix ||
    p.count !== spec.vertices ||
    ix.count > spec.indices ||
    ix.count % 3
  )
    return null;
  // Existing source edits change only indices. Pin every source position to
  // reject an altered asset even if its counts and targeted faces still match.
  let hash = 2166136261;
  for (let i = 0; i < p.count; i++)
    for (const value of [p.getX(i), p.getY(i), p.getZ(i)]) {
      if (!Number.isFinite(value)) return null;
      hash = Math.imul(hash ^ Math.round(value * 1000), 16777619) >>> 0;
    }
  if (hash !== spec.fingerprint) return null;
  const found: number[] = [],
    ids: number[] = [];
  for (let i = 0; i < ix.count; i += 3) {
    const triangle = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    const vertices = triangle.map((k) => ({
      u: (p.getX(k) - a[0]) * dx + (p.getZ(k) - a[1]) * dz,
      o: -(p.getX(k) - a[0]) * dz + (p.getZ(k) - a[1]) * dx,
      y: p.getY(k),
    }));
    if (
      vertices.every(
        (v) =>
          v.u >= -0.012 &&
          v.u <= length + 0.012 &&
          Math.abs(v.o - spec.offset) < 0.012 &&
          v.y >= spec.y[0] - 0.012 &&
          v.y <= spec.y[1] + 0.012,
      ) &&
      Math.max(...vertices.map((v) => v.y)) -
        Math.min(...vertices.map((v) => v.y)) >
        0.1
    ) {
      found.push(i);
      ids.push(...triangle);
    }
  }
  if (
    ids.length !== spec.selected.length ||
    ids.some((v, i) => v !== spec.selected[i])
  )
    return null;
  return found;
}
/** Atomic per-primitive fail-closed replacement; call scene preflight before
 * starting a multi-material loader transaction. Original or already-cut index
 * streams are supported; a repeated/missing/partial face leaves geometry intact. */
export function replaceCanadaPlaceHotelFaces(
  g: T.BufferGeometry,
  material: string,
) {
  const selected = selectedTriangles(g, material);
  if (!selected) return 0;
  const skip = new Set(selected),
    ix = g.getIndex()!,
    kept: number[] = [];
  for (let i = 0; i < ix.count; i += 3)
    if (!skip.has(i)) kept.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
  g.setIndex(kept);
  return selected.length;
}
/** Preflight the untouched loaded asset before any source replacement. */
export function canadaPlaceHotelCompatible(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const found = new Set<string>();
  let valid = true;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const name = (o.material as T.Material).name;
    const spec =
      CANADA_PLACE_HOTEL_SOURCE[name as keyof typeof CANADA_PLACE_HOTEL_SOURCE];
    if (!spec) return;
    if (found.has(name) || o.geometry.getIndex()?.count !== spec.indices) {
      valid = false;
      return;
    }
    let indexHash = 2166136261;
    const ix = o.geometry.getIndex()!;
    for (let i = 0; i < ix.count; i++)
      indexHash = Math.imul(indexHash ^ ix.getX(i), 16777619) >>> 0;
    if (indexHash !== spec.indexFingerprint) {
      valid = false;
      return;
    }
    found.add(name);
    const g = bakeGeometry(o.geometry, o.matrixWorld);
    if (!selectedTriangles(g, name)) valid = false;
    g.dispose();
  });
  return valid && found.size === 3;
}
