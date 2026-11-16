import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import data from "./ironworkers-yard-source.json";
export const IRONWORKERS_YARD = data;
type P = [number, number, number];
const ring = Array.from(
  { length: 4 },
  (_, i) => new T.Vector2(data.pts[i * 2], data.pts[i * 2 + 1]),
);
export const IRONWORKERS_YARD_CENTRE = [6884.6, -1946.375] as const;

export function preflightIronworkersYard(buildings: Building[]) {
  const found = buildings.filter((b) => b.id === data.id);
  return (
    found.length === 1 &&
    found[0].kind === "yes" &&
    found[0].height === undefined &&
    found[0].levels === undefined &&
    found[0].pts.length === data.pts.length &&
    found[0].pts.every((v, i) => v === data.pts[i])
  );
}

/** Parameter u crosses the gable; t follows the source long walls south to north. */
export function ironworkersYardPoint(u: number, t: number, y: number): P {
  const west = ring[0].clone().lerp(ring[3], t);
  const east = ring[1].clone().lerp(ring[2], t);
  const p = west.lerp(east, u);
  return [p.x, y, p.y];
}

export function createIronworkersYardGeometry() {
  const walls: number[] = [],
    roof: number[] = [],
    panels: T.BufferGeometry[] = [],
    trim: T.BufferGeometry[] = [];
  function tri(out: number[], a: P, b: P, c: P, outward: P) {
    const n = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (n.dot(new T.Vector3(...outward)) < 0) [b, c] = [c, b];
    out.push(...a, ...b, ...c);
  }
  function quad(out: number[], a: P, b: P, c: P, d: P, n: P) {
    tri(out, a, b, c, n);
    tri(out, a, c, d, n);
  }
  const at = ironworkersYardPoint;
  const outward = (a: P, b: P): P => [
    (a[0] + b[0]) / 2 - IRONWORKERS_YARD_CENTRE[0],
    0,
    (a[2] + b[2]) / 2 - IRONWORKERS_YARD_CENTRE[1],
  ];
  for (const u of [0, 1]) {
    const a = at(u, 0, 0),
      b = at(u, 1, 0),
      c = at(u, 1, data.eave),
      d = at(u, 0, data.eave);
    quad(walls, a, b, c, d, outward(a, b));
  }
  for (const t of [0, 1]) {
    const a = at(0, t, 0),
      b = at(1, t, 0),
      c = at(1, t, data.eave),
      d = at(0, t, data.eave),
      n = outward(a, b);
    quad(walls, a, b, c, d, n);
    tri(walls, d, c, at(0.5, t, data.ridge), n);
  }
  quad(walls, at(0, 0, 0), at(1, 0, 0), at(1, 1, 0), at(0, 1, 0), [0, -1, 0]);
  for (const u of [0, 1])
    quad(
      roof,
      at(u, 0, data.eave),
      at(u, 1, data.eave),
      at(0.5, 1, data.ridge),
      at(0.5, 0, data.ridge),
      [0, 1, 0],
    );
  function beam(
    out: T.BufferGeometry[],
    a: P,
    b: P,
    width: number,
    depth = width,
  ) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start);
    const g = new T.BoxGeometry(width, delta.length(), depth);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...start.add(end).multiplyScalar(0.5).toArray());
    out.push(g);
  }
  // Restrained standing seams follow the observed ridge-to-eave direction.
  for (let i = 0; i <= 64; i++)
    for (const u of [0, 1])
      beam(
        trim,
        at(u, i / 64, data.eave + 0.025),
        at(0.5, i / 64, data.ridge + 0.025),
        0.035,
        0.045,
      );
  beam(
    trim,
    at(0.5, 0, data.ridge + 0.03),
    at(0.5, 1, data.ridge + 0.03),
    0.13,
    0.08,
  );
  for (const u of [0, 1]) {
    const a = at(u, 0, 0),
      b = at(u, 1, 0),
      normal = new T.Vector3(...outward(a, b)).normalize();
    // Shallow closed panels: no accessible openings or invented interiors.
    for (let i = 0; i < data.longSideBays; i++) {
      const t = (i + 0.5) / data.longSideBays,
        p = at(u, t, 4.05);
      const g = new T.BoxGeometry(1.15, 2.2, 0.05);
      g.rotateY(Math.atan2(normal.x, normal.z));
      g.translate(p[0] + normal.x * 0.03, p[1], p[2] + normal.z * 0.03);
      panels.push(g);
    }
    for (let i = 0; i <= data.longSideBays; i++) {
      const t = i / data.longSideBays,
        p = at(u, t, 0.15),
        q = at(u, t, data.eave);
      beam(
        trim,
        [p[0] + normal.x * 0.045, p[1], p[2] + normal.z * 0.045],
        [q[0] + normal.x * 0.045, q[1], q[2] + normal.z * 0.045],
        0.13,
        0.1,
      );
    }
  }
  for (const t of [0, 1]) {
    const p = at(0.5, t, 2.9),
      n = new T.Vector3(...outward(at(0, t, 0), at(1, t, 0))).normalize();
    const g = new T.BoxGeometry(5.8, 5.8, 0.06);
    g.rotateY(Math.atan2(n.x, n.z));
    g.translate(p[0] + n.x * 0.04, p[1], p[2] + n.z * 0.04);
    panels.push(g);
  }
  function geometry(p: number[]) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }
  function merged(gs: T.BufferGeometry[]) {
    const g = mergeGeometries(gs)!;
    gs.forEach((x) => x.dispose());
    return g;
  }
  return {
    walls: geometry(walls),
    roof: geometry(roof),
    panels: merged(panels),
    trim: merged(trim),
  };
}

export function createIronworkersYardAssembly(buildings: Building[]) {
  const valid = preflightIronworkersYard(buildings);
  let emitted = false;
  return (b: Building, batch: Batcher) => {
    if (!valid || b.id !== data.id) return false;
    if (!emitted) {
      const gs = createIronworkersYardGeometry();
      const colors = {
        walls: 0xb7b8ae,
        roof: 0x656763,
        panels: 0x515c5c,
        trim: 0x92978e,
      };
      for (const key of ["walls", "roof", "panels", "trim"] as const)
        batch.add(
          gs[key],
          new T.MeshStandardMaterial({
            name: `Ironworkers eastern workshop ${key}`,
            color: colors[key],
            roughness: 0.94,
            metalness: key === "roof" ? 0.12 : 0,
          }),
          ...IRONWORKERS_YARD_CENTRE,
          `ironworkers-yard-${key}`,
        );
      emitted = true;
    }
    return true;
  };
}
