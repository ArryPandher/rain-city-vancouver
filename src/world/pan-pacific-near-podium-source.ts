import * as T from "three";
import { bakeGeometry } from "./geometry";

const consecutive = (base: number) =>
  Array.from({ length: 30 }, (_, i) => base + i);
const quads = (base: number) =>
  Array.from({ length: 5 }, (_, i) => {
    const b = base + i * 4;
    return [b, b + 1, b + 2, b, b + 2, b + 3];
  }).flat();

/** Codriver CC-BY-4.0 HOTEL faces31–35, lower/.94/.80 vertical faces only.
 * Preserve all caps, source PIER, the adjoining face36 and the finished tower. */
export const PAN_PACIFIC_NEAR_PODIUM_SOURCE = {
  concrete: {
    vertices: 8368,
    indices: 11154,
    triangles: 30,
    positionFingerprint: 1414622155,
    indexFingerprint: 1369104451,
    selected: [...consecutive(834), ...consecutive(4002), ...consecutive(4518)],
  },
  glass: {
    vertices: 2424,
    indices: 3384,
    triangles: 20,
    positionFingerprint: 1183434523,
    indexFingerprint: 1336512461,
    selected: [...quads(1692), ...quads(1868)],
  },
  trim: {
    vertices: 34749,
    indices: 54198,
    triangles: 20,
    positionFingerprint: 3092327902,
    indexFingerprint: 1514902125,
    selected: [...quads(33245), ...quads(33421)],
  },
} as const;

function specFor(material: string) {
  return Object.hasOwn(PAN_PACIFIC_NEAR_PODIUM_SOURCE, material)
    ? PAN_PACIFIC_NEAR_PODIUM_SOURCE[
        material as keyof typeof PAN_PACIFIC_NEAR_PODIUM_SOURCE
      ]
    : undefined;
}
const hashValue = (hash: number, value: number) =>
  Math.imul(hash ^ value, 16777619) >>> 0;
function indexHash(index: T.BufferAttribute) {
  let hash = 2166136261;
  for (let i = 0; i < index.count; i++) hash = hashValue(hash, index.getX(i));
  return hash;
}
function planRemoval(geometry: T.BufferGeometry, material: string) {
  const spec = specFor(material),
    p = geometry.getAttribute("position"),
    ix = geometry.getIndex();
  if (
    !spec ||
    !p ||
    !ix ||
    p.itemSize !== 3 ||
    p.count !== spec.vertices ||
    ix.itemSize !== 1 ||
    ix.count > spec.indices ||
    ix.count % 3 ||
    geometry.groups.length ||
    geometry.drawRange.start !== 0 ||
    geometry.drawRange.count !== Infinity
  )
    return null;
  let positions = 2166136261;
  for (let i = 0; i < p.count; i++)
    for (const v of [p.getX(i), p.getY(i), p.getZ(i)]) {
      if (!Number.isFinite(v)) return null;
      positions = hashValue(positions, Math.round(v * 1000));
    }
  if (
    positions !== spec.positionFingerprint ||
    (ix.count === spec.indices && indexHash(ix) !== spec.indexFingerprint)
  )
    return null;
  const selectedVertices = new Set(spec.selected),
    kept: number[] = [];
  let cursor = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (
      ids.some((id) => !Number.isInteger(id) || id < 0 || id >= spec.vertices)
    )
      return null;
    if (!ids.some((id) => selectedVertices.has(id))) {
      kept.push(...ids);
      continue;
    }
    // Verify every complete ordered triple wherever previous cuts moved it.
    // Missing, repeated, reversed or mixed target vertices abort before mutation.
    if (ids.some((id, j) => id !== spec.selected[cursor + j])) return null;
    cursor += 3;
  }
  if (cursor !== spec.selected.length) return null;
  // Build every replacement index before mutation, preserving its original
  // integer width, all attributes, and the exact order of retained triangles.
  const index =
    ix.array instanceof Uint32Array
      ? new T.Uint32BufferAttribute(kept, 1)
      : new T.Uint16BufferAttribute(kept, 1);
  return { geometry, index, triangles: spec.triangles };
}

/** Per-primitive operation for staged loader transactions. Original-scene
 * preflight is required; prefer the all-material atomic helper below. */
export function replacePanPacificNearPodiumFaces(
  geometry: T.BufferGeometry,
  material: string,
): number {
  const plan = planRemoval(geometry, material);
  if (!plan) return 0;
  geometry.setIndex(plan.index);
  return plan.triangles;
}

/** All three already-baked local source primitives, before or after other cuts.
 * Any missing, duplicated, altered or partially removed near return aborts the entire
 * transaction without changing any geometry. Unknown materials are untouched. */
export function replacePanPacificNearPodiumSource(
  primitives: readonly { geometry: T.BufferGeometry; material: string }[],
): number {
  const found = new Set<string>(),
    plans: NonNullable<ReturnType<typeof planRemoval>>[] = [];
  for (const { geometry, material } of primitives) {
    if (!specFor(material)) continue;
    if (found.has(material)) return 0;
    found.add(material);
    const plan = planRemoval(geometry, material);
    if (!plan) return 0;
    plans.push(plan);
  }
  if (found.size !== 3) return 0;
  for (const plan of plans) plan.geometry.setIndex(plan.index);
  return plans.reduce((sum, plan) => sum + plan.triangles, 0);
}

/** Validate the complete original scene BEFORE paving or any facade removals.
 * Float32 baking matches GLTFLoader normalized Int16 quantization semantics. */
export function panPacificNearPodiumCompatible(root: T.Object3D): boolean {
  root.updateMatrixWorld(true);
  const found = new Set<string>();
  let valid = true;
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    if (Array.isArray(object.material)) {
      if (object.material.some((m: T.Material) => specFor(m.name)))
        valid = false;
      return;
    }
    const name = object.material.name,
      spec = specFor(name);
    if (!spec) return;
    const index = object.geometry.getIndex();
    if (
      found.has(name) ||
      !index ||
      index.count !== spec.indices ||
      indexHash(index) !== spec.indexFingerprint
    ) {
      valid = false;
      return;
    }
    found.add(name);
    const baked = bakeGeometry(object.geometry, object.matrixWorld);
    if (!planRemoval(baked, name)) valid = false;
    baked.dispose();
  });
  return valid && found.size === 3;
}
