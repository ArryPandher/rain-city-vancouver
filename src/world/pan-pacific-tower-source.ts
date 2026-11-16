import * as T from "three";
import { bakeGeometry } from "./geometry";

/** Exact original Codriver CC-BY-4.0 tower, including its crown and old glow.
 * Index offsets are audit metadata only; runtime selection uses vertex ownership
 * and the complete ordered-triple fingerprint after earlier source cuts. */
export const PAN_PACIFIC_TOWER_SOURCE = {
  concrete: {
    vertices: 8368,
    indices: 11154,
    firstVertex: 4596,
    triangles: 1802,
    positionFingerprint: 1414622155,
    indexFingerprint: 1369104451,
    selectedFingerprint: 2908693943,
  },
  glass: {
    vertices: 2424,
    indices: 3384,
    firstVertex: 1920,
    triangles: 168,
    positionFingerprint: 1183434523,
    indexFingerprint: 1336512461,
    selectedFingerprint: 877753549,
  },
  trim: {
    vertices: 34749,
    indices: 54198,
    firstVertex: 33473,
    triangles: 638,
    positionFingerprint: 3092327902,
    indexFingerprint: 1514902125,
    selectedFingerprint: 4269162897,
  },
  glow: {
    vertices: 128,
    indices: 192,
    firstVertex: 0,
    triangles: 64,
    positionFingerprint: 2709859513,
    indexFingerprint: 2648328901,
    selectedFingerprint: 2648328901,
  },
  roof: {
    vertices: 299,
    indices: 1404,
    firstVertex: 0,
    triangles: 468,
    positionFingerprint: 2046971939,
    indexFingerprint: 2447683069,
    selectedFingerprint: 2447683069,
  },
} as const;

function specFor(material: string) {
  return Object.hasOwn(PAN_PACIFIC_TOWER_SOURCE, material)
    ? PAN_PACIFIC_TOWER_SOURCE[
        material as keyof typeof PAN_PACIFIC_TOWER_SOURCE
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
  let selectedHash = 2166136261,
    selectedIndices = 0;
  const kept: number[] = [];
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (
      ids.some((id) => !Number.isInteger(id) || id < 0 || id >= spec.vertices)
    )
      return null;
    const selected = ids.filter((id) => id >= spec.firstVertex).length;
    if (selected !== 0 && selected !== 3) return null;
    if (!selected) {
      kept.push(...ids);
      continue;
    }
    for (const id of ids) selectedHash = hashValue(selectedHash, id);
    selectedIndices += 3;
  }
  if (
    selectedIndices !== spec.triangles * 3 ||
    selectedHash !== spec.selectedFingerprint
  )
    return null;
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
export function replacePanPacificTowerFaces(
  geometry: T.BufferGeometry,
  material: string,
): number {
  const plan = planRemoval(geometry, material);
  if (!plan) return 0;
  geometry.setIndex(plan.index);
  return plan.triangles;
}

/** All five already-baked local source primitives, before or after other cuts.
 * Any missing, duplicated, altered or partially removed tower aborts the entire
 * transaction without changing any geometry. Unknown materials are untouched. */
export function replacePanPacificTowerSource(
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
  if (found.size !== 5) return 0;
  for (const plan of plans) plan.geometry.setIndex(plan.index);
  return plans.reduce((sum, plan) => sum + plan.triangles, 0);
}

/** Validate the complete original scene BEFORE paving or any facade removals.
 * Float32 baking matches GLTFLoader normalized Int16 quantization semantics. */
export function panPacificTowerCompatible(root: T.Object3D): boolean {
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
  return valid && found.size === 5;
}
