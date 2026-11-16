import * as T from "three";
import { bakeGeometry } from "./geometry";

const consecutive = (base: number) =>
  Array.from({ length: 30 }, (_, i) => base + i);
const quads = (base: number) =>
  Array.from({ length: 5 }, (_, i) => {
    const b = base + i * 4;
    return [b, b + 1, b + 2, b, b + 2, b + 3];
  }).flat();

/** Codriver CC-BY-4.0 HOTEL southeast edges 36–40, lower/.94/.80 tiers.
 * Audit: artifacts/local/pan-pacific-howe-next-pass.md. Only vertical faces;
 * source caps, PIER top, adjacent elevations and hotel tower are retained. */
export const PAN_PACIFIC_HOWE_PODIUM_SOURCE = {
  concrete: {
    vertices: 8368,
    indices: 11154,
    positionFingerprint: 1414622155,
    indexFingerprint: 1369104451,
    selected: [...consecutive(864), ...consecutive(4032), ...consecutive(4548)],
  },
  glass: {
    vertices: 2424,
    indices: 3384,
    positionFingerprint: 1183434523,
    indexFingerprint: 1336512461,
    selected: [...quads(1712), ...quads(1888)],
  },
  trim: {
    vertices: 34749,
    indices: 54198,
    positionFingerprint: 3092327902,
    indexFingerprint: 1514902125,
    selected: [...quads(33265), ...quads(33441)],
  },
} as const;

function sourceSpec(material: string) {
  return Object.hasOwn(PAN_PACIFIC_HOWE_PODIUM_SOURCE, material)
    ? PAN_PACIFIC_HOWE_PODIUM_SOURCE[
        material as keyof typeof PAN_PACIFIC_HOWE_PODIUM_SOURCE
      ]
    : undefined;
}

function indexFingerprint(index: T.BufferAttribute) {
  let hash = 2166136261;
  for (let i = 0; i < index.count; i++)
    hash = Math.imul(hash ^ index.getX(i), 16777619) >>> 0;
  return hash;
}

function selectedTriangles(
  g: T.BufferGeometry,
  material: string,
): number[] | null {
  const spec = sourceSpec(material),
    p = g.getAttribute("position"),
    ix = g.getIndex();
  if (
    !spec ||
    !p ||
    !ix ||
    p.itemSize !== 3 ||
    p.count !== spec.vertices ||
    ix.itemSize !== 1 ||
    ix.count > spec.indices ||
    ix.count % 3 ||
    g.groups.length ||
    g.drawRange.start !== 0 ||
    g.drawRange.count !== Infinity
  )
    return null;
  // Exactly the Float32-baked, millimetre-rounded source fingerprint. Existing
  // paving/west/canopy cuts only change indices, so they preserve this guard.
  let hash = 2166136261;
  for (let i = 0; i < p.count; i++)
    for (const value of [p.getX(i), p.getY(i), p.getZ(i)]) {
      if (!Number.isFinite(value)) return null;
      hash = Math.imul(hash ^ Math.round(value * 1000), 16777619) >>> 0;
    }
  if (
    hash !== spec.positionFingerprint ||
    (ix.count === spec.indices &&
      indexFingerprint(ix) !== spec.indexFingerprint)
  )
    return null;

  const selectedVertices = new Set(spec.selected),
    found: number[] = [];
  let cursor = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const triangle = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (triangle.some((id) => !Number.isInteger(id) || id < 0 || id >= p.count))
      return null;
    if (!triangle.some((id) => selectedVertices.has(id))) continue;
    // Match complete ordered triples, in original order, wherever they now
    // occur. Missing, reversed, duplicated or partially edited faces reject
    // the complete primitive; original triangle offsets are never reused.
    if (triangle.some((id, j) => id !== spec.selected[cursor + j])) return null;
    cursor += 3;
    found.push(i);
  }
  return cursor === spec.selected.length ? found : null;
}

/** Atomic per primitive. Call the whole-scene preflight BEFORE any edits, then
 * use baked local geometry. Returns 30 concrete / 20 glass / 20 trim triangles.
 * Failure (including repeat calls) preserves the original index object and all
 * attributes. The caller must gate the complete assembly on scene preflight. */
export function replacePanPacificHowePodiumFaces(
  g: T.BufferGeometry,
  material: string,
): number {
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

/** Validate all three untouched source primitives before any source removals.
 * Runtime GLTFLoader normalized Int16 buffers are checked via Float32 baking,
 * without mutating the original geometry. Duplicate/missing primitives fail. */
export function panPacificHowePodiumCompatible(root: T.Object3D): boolean {
  root.updateMatrixWorld(true);
  const found = new Set<string>();
  let valid = true;
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    if (Array.isArray(object.material)) {
      if (
        object.material.some((material: T.Material) =>
          sourceSpec(material.name),
        )
      )
        valid = false;
      return;
    }
    const name = object.material.name,
      spec = sourceSpec(name);
    if (!spec) return;
    const ix = object.geometry.getIndex();
    if (
      found.has(name) ||
      !ix ||
      ix.count !== spec.indices ||
      indexFingerprint(ix) !== spec.indexFingerprint
    ) {
      valid = false;
      return;
    }
    found.add(name);
    const baked = bakeGeometry(object.geometry, object.matrixWorld);
    if (!selectedTriangles(baked, name)) valid = false;
    baked.dispose();
  });
  return valid && found.size === 3;
}
