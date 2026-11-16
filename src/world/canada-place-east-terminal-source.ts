import * as T from "three";
import { bakeGeometry } from "./geometry";

/** Original first east SAILS face only. Other walls, caps, PIER and rigging stay. */
export const CANADA_PLACE_EAST_TERMINAL_SOURCE = {
  concrete: {
    vertices: 8368,
    indices: 11154,
    triangles: 2,
    positionFingerprint: 1414622155,
    indexFingerprint: 1369104451,
    selected: [1104, 1105, 1106, 1107, 1108, 1109],
  },
  glass: {
    vertices: 2424,
    indices: 3384,
    triangles: 20,
    positionFingerprint: 1183434523,
    indexFingerprint: 1336512461,
    selected: [
      1208, 1209, 1210, 1208, 1210, 1211, 1212, 1213, 1214, 1212, 1214, 1215,
      1216, 1217, 1218, 1216, 1218, 1219, 1220, 1221, 1222, 1220, 1222, 1223,
      1224, 1225, 1226, 1224, 1226, 1227, 1228, 1229, 1230, 1228, 1230, 1231,
      1232, 1233, 1234, 1232, 1234, 1235, 1236, 1237, 1238, 1236, 1238, 1239,
      1240, 1241, 1242, 1240, 1242, 1243, 1244, 1245, 1246, 1244, 1246, 1247,
    ],
  },
} as const;

function specFor(material: string) {
  return Object.hasOwn(CANADA_PLACE_EAST_TERMINAL_SOURCE, material)
    ? CANADA_PLACE_EAST_TERMINAL_SOURCE[
        material as keyof typeof CANADA_PLACE_EAST_TERMINAL_SOURCE
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
  const selectedVertices = new Set<number>(spec.selected),
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
export function replaceCanadaPlaceEastTerminalFaces(
  geometry: T.BufferGeometry,
  material: string,
): number {
  const plan = planRemoval(geometry, material);
  if (!plan) return 0;
  geometry.setIndex(plan.index);
  return plan.triangles;
}

/** Both already-baked local source primitives, before or after other cuts.
 * Any missing, duplicated, altered or partially removed east terminal face aborts the entire
 * transaction without changing any geometry. Unknown materials are untouched. */
export function replaceCanadaPlaceEastTerminalSource(
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
  if (found.size !== 2) return 0;
  for (const plan of plans) plan.geometry.setIndex(plan.index);
  return plans.reduce((sum, plan) => sum + plan.triangles, 0);
}

/** Validate the complete original scene BEFORE paving or any facade removals.
 * Float32 baking matches GLTFLoader normalized Int16 quantization semantics. */
export function canadaPlaceEastTerminalCompatible(root: T.Object3D): boolean {
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
  return valid && found.size === 2;
}
