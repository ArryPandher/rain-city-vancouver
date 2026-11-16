import * as T from "three";
import data from "./ironworkers-alignment-data.json";

/** Road-strip midpoint registration; source roads and original grade are immutable. */
export const IRONWORKERS_ALIGNMENT = data;
const dx = data.gradeB[0] - data.gradeA[0],
  dz = data.gradeB[1] - data.gradeA[1];
export const IRONWORKERS_GRADE_LENGTH = Math.hypot(dx, dz);
const controls = data.controls;
const tangents = controls.slice(1).map((b, i) => {
  const a = controls[i],
    x = b.point[0] - a.point[0],
    z = b.point[1] - a.point[1],
    length = Math.hypot(x, z);
  return { x: x / length, z: z / length, length };
});
const normals = controls.map((_, i) => {
  if (i === 0) return [tangents[0].z, -tangents[0].x];
  if (i === controls.length - 1) return [tangents[i - 1].z, -tangents[i - 1].x];
  const a = tangents[i - 1],
    b = tangents[i],
    x = a.z + b.z,
    z = -a.x - b.x,
    den = x * b.z - z * b.x;
  return [x / den, z / den];
});
const distances = [0];
for (const t of tangents) distances.push(distances.at(-1)! + t.length);
export const IRONWORKERS_PLAN_LENGTH = distances.at(-1)!;
function segment(t: number) {
  let i = 0;
  while (i < controls.length - 2 && t > controls[i + 1].t) i++;
  return i;
}
/** Unclamped stations exist only on the6m rendered approach ties. */
export function ironworkersFrame(t: number) {
  t = Math.max(controls[0].t, Math.min(controls.at(-1)!.t, t));
  const i = segment(t),
    f = (t - controls[i].t) / (controls[i + 1].t - controls[i].t),
    a = controls[i],
    b = controls[i + 1];
  return {
    t,
    x: T.MathUtils.lerp(a.point[0], b.point[0], f),
    z: T.MathUtils.lerp(a.point[1], b.point[1], f),
    nx: T.MathUtils.lerp(normals[i][0], normals[i + 1][0], f),
    nz: T.MathUtils.lerp(normals[i][1], normals[i + 1][1], f),
    distance: T.MathUtils.lerp(distances[i], distances[i + 1], f),
  };
}
export function ironworkersPoint(t: number, side = 0): [number, number] {
  const f = ironworkersFrame(t);
  return [f.x + f.nx * side, f.z + f.nz * side];
}
export function ironworkersGradeT(x: number, z: number) {
  return Math.max(
    0,
    Math.min(
      1,
      ((x - data.gradeA[0]) * dx + (z - data.gradeA[1]) * dz) /
        IRONWORKERS_GRADE_LENGTH ** 2,
    ),
  );
}
export function ironworkersTAtDistance(distance: number) {
  distance = Math.max(0, Math.min(IRONWORKERS_PLAN_LENGTH, distance));
  let i = 0;
  while (i < distances.length - 2 && distance > distances[i + 1]) i++;
  return T.MathUtils.lerp(
    controls[i].t,
    controls[i + 1].t,
    (distance - distances[i]) / (distances[i + 1] - distances[i]),
  );
}
export function ironworkersSample(x: number, z: number) {
  let best = { x: 0, z: 0, d: Infinity, t: ironworkersGradeT(x, z) };
  for (let i = 0; i < tangents.length; i++) {
    const a = controls[i].point,
      b = controls[i + 1].point,
      vx = b[0] - a[0],
      vz = b[1] - a[1],
      f = Math.max(
        0,
        Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)),
      ),
      px = a[0] + vx * f,
      pz = a[1] + vz * f,
      d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { x: px, z: pz, d, t: best.t };
  }
  return best;
}
export const IRONWORKERS_DECK_RING = [
  ...controls.map((c) => ironworkersPoint(c.t, -data.width / 2)),
  ...[...controls].reverse().map((c) => ironworkersPoint(c.t, data.width / 2)),
];
const minX = Math.min(...IRONWORKERS_DECK_RING.map((p) => p[0])),
  maxX = Math.max(...IRONWORKERS_DECK_RING.map((p) => p[0])),
  minZ = Math.min(...IRONWORKERS_DECK_RING.map((p) => p[1])),
  maxZ = Math.max(...IRONWORKERS_DECK_RING.map((p) => p[1]));
export function ironworkersContains(x: number, z: number) {
  if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
  let inside = false;
  for (
    let i = 0, j = IRONWORKERS_DECK_RING.length - 1;
    i < IRONWORKERS_DECK_RING.length;
    j = i++
  ) {
    const a = IRONWORKERS_DECK_RING[i],
      b = IRONWORKERS_DECK_RING[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function isIronworkersCarriageway(id: string | undefined) {
  return id !== undefined && data.roadIds.includes(id);
}
/** Same exact rings for the top, underside and rails, including every bend. */
export const IRONWORKERS_DECK_STATIONS = [
  ...new Set([
    0,
    1,
    // Resolve the clamped old grade across both approach ties, not with a
    // long triangle that can hover over the unchanged street datum.
    ...Array.from({ length: 31 }, (_, i) => (i - 6) / IRONWORKERS_GRADE_LENGTH),
    ...Array.from(
      { length: 31 },
      (_, i) => 1 - (i - 6) / IRONWORKERS_GRADE_LENGTH,
    ),
    ...controls.map((c) => c.t),
    ...Array.from(
      { length: Math.ceil(IRONWORKERS_PLAN_LENGTH / 12) + 1 },
      (_, i) =>
        ironworkersTAtDistance(
          (i * IRONWORKERS_PLAN_LENGTH) /
            Math.ceil(IRONWORKERS_PLAN_LENGTH / 12),
        ),
    ),
  ]),
].sort((a, b) => a - b);
export function createIronworkersDeckGeometry(
  height: (t: number) => number,
  offset = 0,
) {
  const p: number[] = [],
    uv: number[] = [],
    ix: number[] = [],
    across = Math.ceil(data.width / 2);
  for (let i = 0; i < IRONWORKERS_DECK_STATIONS.length; i++) {
    const t = IRONWORKERS_DECK_STATIONS[i],
      frame = ironworkersFrame(t);
    for (let j = 0; j <= across; j++) {
      const side = -data.width / 2 + (data.width * j) / across,
        [x, z] = ironworkersPoint(t, side);
      p.push(x, height(ironworkersGradeT(x, z)) + offset, z);
      uv.push((side + data.width / 2) / 5, frame.distance / 5);
      if (i && j < across) {
        const a = (i - 1) * (across + 1) + j,
          b = i * (across + 1) + j;
        ix.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
