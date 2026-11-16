import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import data from "./ironworkers-repair-shed-source.json";
export const IRONWORKERS_REPAIR_SHED = data;
type P = [number, number];
type V = [number, number, number];
const origin: [number, number] = [data.pts[0], data.pts[1]],
  axis = new T.Vector2(
    data.pts[10] - origin[0],
    data.pts[11] - origin[1],
  ).normalize(),
  across = new T.Vector2(-axis.y, axis.x);
const local: P[] = Array.from({ length: 6 }, (_, i) => {
  const d = new T.Vector2(
    data.pts[i * 2] - origin[0],
    data.pts[i * 2 + 1] - origin[1],
  );
  return [d.dot(across), d.dot(axis)];
});
const centre: P = [
  data.pts.filter((_, i) => !(i % 2)).reduce((a, b) => a + b) / 6,
  data.pts.filter((_, i) => i % 2).reduce((a, b) => a + b) / 6,
];
const lo = Math.min(...local.map((p) => p[1])),
  hi = Math.max(...local.map((p) => p[1]));
export function repairShedWorld(u: number, v: number, y = 0): V {
  return [
    origin[0] + across.x * u + axis.x * v,
    y,
    origin[1] + across.y * u + axis.y * v,
  ];
}
export function repairShedRoofHeight(u: number) {
  for (let i = 1; i < data.profile.length; i++) {
    const a = data.profile[i - 1],
      b = data.profile[i];
    if (u <= b[0]) return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]);
  }
  throw Error("Outside roof profile");
}
export function preflightRepairShed(buildings: Building[]) {
  const bs = buildings.filter((b) => b.id === data.id);
  return (
    bs.length === 1 &&
    bs[0].kind === "yes" &&
    bs[0].height === undefined &&
    bs[0].levels === undefined &&
    bs[0].pts.length === data.pts.length &&
    bs[0].pts.every((v, i) => v === data.pts[i])
  );
}
function clip(poly: P[], axis: 0 | 1, bound: number, greater: boolean): P[] {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ina = greater ? a[axis] >= bound - 1e-9 : a[axis] <= bound + 1e-9,
      inb = greater ? b[axis] >= bound - 1e-9 : b[axis] <= bound + 1e-9;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out.filter(
    (p, i) =>
      Math.hypot(
        p[0] - out[(i + out.length - 1) % out.length][0],
        p[1] - out[(i + out.length - 1) % out.length][1],
      ) > 1e-8,
  );
}
function onBoundary(a: P, b: P) {
  return local.some((p, i) => {
    const q = local[(i + 1) % local.length],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      length = Math.hypot(dx, dy);
    return [a, b].every(
      (r) =>
        Math.abs((r[0] - p[0]) * dy - (r[1] - p[1]) * dx) / length < 1e-7 &&
        ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / length >= -1e-7 &&
        ((r[0] - q[0]) * dx + (r[1] - q[1]) * dy) / length <= 1e-7,
    );
  });
}
export function createRepairShedGeometry() {
  const shell: number[] = [],
    roof: number[] = [],
    lights: number[] = [],
    panels: T.BufferGeometry[] = [],
    trim: T.BufferGeometry[] = [];
  function triangle(out: number[], a: V, b: V, c: V, n: V) {
    const normal = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (normal.lengthSq() < 1e-12) return;
    if (normal.dot(new T.Vector3(...n)) < 0) [b, c] = [c, b];
    out.push(...a, ...b, ...c);
  }
  const point = (p: P, y: number) => repairShedWorld(p[0], p[1], y);
  const vs = [lo, hi, ...local.map((p) => p[1]), ...data.roofLights.flat()]
    .filter((v) => v >= lo && v <= hi)
    .sort((a, b) => a - b)
    .filter((v, i, a) => !i || v - a[i - 1] > 1e-8);
  for (let ui = 1; ui < data.profile.length; ui++)
    for (let vi = 1; vi < vs.length; vi++) {
      const u0 = data.profile[ui - 1][0],
        u1 = data.profile[ui][0],
        v0 = vs[vi - 1],
        v1 = vs[vi];
      let poly = clip(
        clip(clip(clip(local, 0, u0, true), 0, u1, false), 1, v0, true),
        1,
        v1,
        false,
      );
      if (poly.length < 3) continue;
      const top =
        ui <= 2 &&
        data.roofLights.some(([a, b]) => (v0 + v1) / 2 > a && (v0 + v1) / 2 < b)
          ? lights
          : roof;
      const triangles = T.ShapeUtils.triangulateShape(
        poly.map((p) => new T.Vector2(...p)),
        [],
      );
      for (const ids of triangles) {
        const ps = ids.map((i) => poly[i]);
        triangle(
          top,
          ...(ps.map((p) => point(p, repairShedRoofHeight(p[0]))) as [V, V, V]),
          [0, 1, 0],
        );
        triangle(
          shell,
          ...(ps.map((p) => point(p, 0)) as [V, V, V]),
          [0, -1, 0],
        );
      }
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length];
        if (!onBoundary(a, b)) continue;
        const pa = point(a, 0),
          pb = point(b, 0),
          qa = point(a, repairShedRoofHeight(a[0])),
          qb = point(b, repairShedRoofHeight(b[0])),
          n: V = [-(pb[2] - pa[2]), 0, pb[0] - pa[0]];
        triangle(shell, pa, pb, qb, n);
        triangle(shell, pa, qb, qa, n);
      }
    }
  function beam(a: V, b: V, w: number, d = w) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start),
      g = new T.BoxGeometry(w, delta.length(), d);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...start.add(end).multiplyScalar(0.5).toArray());
    trim.push(g);
  }
  // Low profile ridge/valley closures stop inside the actual skewed end edges.
  for (const u of [7.75, 15.5, 22.85]) {
    const poly = clip(clip(local, 0, u - 0.001, true), 0, u + 0.001, false),
      a = Math.min(...poly.map((p) => p[1])) + 0.12,
      b = Math.max(...poly.map((p) => p[1])) - 0.12;
    beam(
      repairShedWorld(u, a, repairShedRoofHeight(u) + 0.04),
      repairShedWorld(u, b, repairShedRoofHeight(u) + 0.04),
      0.15,
      0.08,
    );
  }
  // Closed south doors preserve the source's private, solid workshop footprint.
  const a = new T.Vector2(data.pts[0], data.pts[1]),
    b = new T.Vector2(data.pts[2], data.pts[3]),
    dir = b.clone().sub(a).normalize(),
    out = new T.Vector2(-dir.y, dir.x);
  for (const t of [0.255, 0.755]) {
    const p = a.clone().lerp(b, t),
      g = new T.BoxGeometry(12.6, 5.5, 0.06);
    g.rotateY(Math.atan2(out.x, out.y));
    g.translate(p.x + out.x * 0.04, 2.8, p.y + out.y * 0.04);
    panels.push(g);
    beam(
      [p.x - dir.x * 6.4, 5.65, p.y - dir.y * 6.4],
      [p.x + dir.x * 6.4, 5.65, p.y + dir.y * 6.4],
      0.18,
      0.15,
    );
  }
  function make(p: number[]) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }
  function merge(gs: T.BufferGeometry[]) {
    const g = mergeGeometries(gs)!;
    gs.forEach((x) => x.dispose());
    return g;
  }
  return {
    shell: make(shell),
    roof: make(roof),
    lights: make(lights),
    panels: merge(panels),
    trim: merge(trim),
  };
}
export function createRepairShedAssembly(buildings: Building[]) {
  const valid = preflightRepairShed(buildings);
  let emitted = false;
  return (b: Building, batch: Batcher) => {
    if (!valid || b.id !== data.id) return false;
    if (!emitted) {
      const geometry = createRepairShedGeometry(),
        colors = {
          shell: 0xc4c7be,
          roof: 0x686b67,
          lights: 0xc2cece,
          panels: 0x657577,
          trim: 0xb2b7af,
        };
      for (const key of ["shell", "roof", "lights", "panels", "trim"] as const)
        batch.add(
          geometry[key],
          new T.MeshStandardMaterial({
            name: `Ironworkers repair shed ${key}`,
            color: colors[key],
            roughness: key === "lights" ? 0.55 : 0.94,
            metalness: 0,
          }),
          ...centre,
          `repair-shed-${key}`,
        );
      emitted = true;
    }
    return true;
  };
}
