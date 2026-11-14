import * as T from "three";
import clipping, { type Polygon, type MultiPolygon } from "polygon-clipping";
import { Batcher, flatPolygon } from "./geometry";
import type { CityData } from "./data";
import { segmentPoint } from "./data";
import type { CollisionWorld } from "./collision";
import type { Materials } from "./materials";
import {
  LOOKOUT_CUTOUTS,
  LOOKOUT_LEVELS,
  LOOKOUT_FLIGHTS,
  LOOKOUT_FENCE,
  LOOKOUT_COURT,
  LOOKOUT_GARDEN,
  pathRectangle,
  prospectLookoutHeight,
} from "./prospect-lookout-site";

const polygon = (p: number[]): Polygon => [
  Array.from({ length: p.length / 2 }, (_, i) => [p[i * 2], p[i * 2 + 1]]),
];
export interface LookoutSurface {
  pts: number[];
  holes: number[][];
  height: number;
  stair: boolean;
  kind: "concrete" | "asphalt" | "grass";
}
/** Partition overlapping construction areas so each position has exactly one visible tread. */
export function lookoutSurfaces(): LookoutSurface[] {
  const sources: {
    pts: number[];
    height: number;
    stair: boolean;
    kind: "concrete" | "asphalt" | "grass";
  }[] = [
    ...LOOKOUT_FLIGHTS.flatMap((f) =>
      Array.from({ length: f.steps }, (_, i) => {
        const at = (t: number) => f.a.map((v, j) => v + (f.b[j] - v) * t);
        return {
          pts: pathRectangle(at(i / f.steps), at((i + 1) / f.steps), f.width),
          height: f.top - ((f.top - f.bottom) * (i + 1)) / f.steps,
          stair: true,
          kind: "concrete" as const,
        };
      }),
    ),
    ...LOOKOUT_LEVELS.map((a) => ({ ...a, stair: false })),
  ];
  let occupied: MultiPolygon = [];
  const result: LookoutSurface[] = [];
  for (const source of sources) {
    const p = polygon(source.pts),
      remaining = occupied.length ? clipping.difference(p, occupied) : [p];
    for (const [outer, ...holes] of remaining)
      result.push({
        pts: outer.flat(),
        holes: holes.map((h) => h.flat()),
        height: source.height,
        stair: source.stair,
        kind: source.kind,
      });
    occupied = occupied.length ? clipping.union(occupied, p) : [p];
  }
  return result;
}
export function buildProspectLookout(
  parent: T.Object3D,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
) {
  const terrain = data.terrain;
  if (!terrain) return [];
  const batch = new Batcher(parent, 80),
    surfaces = lookoutSurfaces();
  const concrete = m.pbr("concrete_pavement", 0xb6b7ac, 0.94);
  concrete.name = "Prospect lookout — weathered concrete";
  concrete.normalScale.set(0.38, 0.38);
  const stone = new T.MeshStandardMaterial({
    name: "Prospect lookout — stone piers and foundations",
    map: m.texture("seawall/stone-color.webp", true),
    normalMap: m.texture("seawall/stone-normal.webp"),
    roughnessMap: m.texture("seawall/stone-roughness.webp"),
    normalScale: new T.Vector2(0.55, 0.55),
    color: 0xa5a69b,
    roughness: 0.96,
    side: T.DoubleSide,
  });
  const metal = new T.MeshStandardMaterial({
    name: "Prospect lookout — painted steel",
    color: 0x182321,
    roughness: 0.58,
    metalness: 0.5,
  });
  const joint = new T.MeshStandardMaterial({ color: 0x52584e, roughness: 1 });
  const wood = new T.MeshStandardMaterial({
    name: "Prospect lookout — bench timber",
    color: 0x80624a,
    map: m.texture("houses/painted-wood-color.webp", true),
    normalMap: m.texture("houses/painted-wood-normal.webp"),
    roughnessMap: m.texture("houses/painted-wood-roughness.webp"),
    normalScale: new T.Vector2(0.25, 0.25),
    roughness: 0.9,
  });
  const add = (g: T.BufferGeometry, mat: T.Material, name: string) =>
    batch.add(g, mat, -1620, -3380, name);
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    name: string,
    angle = 0,
  ) => {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(angle);
    g.translate(x, y, z);
    add(g, mat, name);
  };
  const beam = (
    a: number[],
    b: number[],
    width: number,
    mat: T.Material,
    name: string,
    depth = width,
  ) => {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      delta = bv.clone().sub(av);
    const g = new T.BoxGeometry(width, delta.length(), depth);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...av.add(bv).multiplyScalar(0.5).toArray());
    add(g, mat, name);
  };
  const face = (
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    mat: T.Material,
    name: string,
  ) => {
    const g = new T.BufferGeometry(),
      pts = [a, b, c, d];
    g.setAttribute("position", new T.Float32BufferAttribute(pts.flat(), 3));
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        [0, a[1] / 2, length / 2, b[1] / 2, length / 2, c[1] / 2, 0, d[1] / 2],
        2,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    add(g, mat, name);
  };
  for (const s of surfaces)
    add(
      flatPolygon(s.pts, s.holes, s.height + 0.008, 3),
      s.kind === "grass"
        ? m.grass
        : s.kind === "asphalt"
          ? m.asphalt
          : concrete,
      "lookout walkable surfaces",
    );
  // Actual vertical risers: the camera and feet use the corresponding flat treads.
  for (const f of LOOKOUT_FLIGHTS) {
    const dx = f.b[0] - f.a[0],
      dz = f.b[1] - f.a[1],
      len = Math.hypot(dx, dz),
      nx = ((dz / len) * f.width) / 2,
      nz = ((-dx / len) * f.width) / 2;
    for (let i = 0; i < f.steps; i++) {
      const x = f.a[0] + (dx * i) / f.steps,
        z = f.a[1] + (dz * i) / f.steps,
        top = f.top - ((f.top - f.bottom) * i) / f.steps + 0.008,
        bottom = top - (f.top - f.bottom) / f.steps;
      face(
        [x + nx, top, z + nz],
        [x - nx, top, z - nz],
        [x - nx, bottom, z - nz],
        [x + nx, bottom, z + nz],
        concrete,
        "lookout stair risers",
      );
      // Narrow nosing gives readable steps without high-contrast hazard stripes.
      beam(
        [x + nx, bottom + 0.009, z + nz],
        [x - nx, bottom + 0.009, z - nz],
        0.024,
        joint,
        "lookout stair nosings",
        0.024,
      );
    }
  }
  // Only the exterior of the union receives cut/fill faces; internal edges must
  // not produce walls across a connected stair or terrace. Split at every tread
  // and terrain interpolation break to prevent open wedges on the steep bank.
  const [firstCut, ...otherCuts] = LOOKOUT_CUTOUTS.map(polygon);
  const union = clipping.union(firstCut, ...otherCuts);
  for (const area of union)
    for (const ring of area)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i],
          b = ring[i + 1],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz);
        if (len < 0.0001) continue;
        const cuts = new Set([0, 1]);
        for (const s of surfaces)
          for (let k = 0; k < s.pts.length; k += 2) {
            const q = segmentPoint(
              s.pts[k],
              s.pts[k + 1],
              a[0],
              a[1],
              b[0],
              b[1],
            );
            if (q.d < 0.003) cuts.add(q.t);
          }
        const grid =
          terrain.details.find((t) =>
            t.contains((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
          ) ?? terrain;
        for (const [start, end, origin] of [
          [a[0], b[0], grid.meta.minX],
          [a[1], b[1], grid.meta.minZ],
          [a[0] + a[1], b[0] + b[1], grid.meta.minX + grid.meta.minZ],
        ]) {
          if (Math.abs(end - start) < 1e-8) continue;
          for (
            let n =
              Math.ceil((Math.min(start, end) - origin) / grid.meta.step) *
                grid.meta.step +
              origin;
            n < Math.max(start, end);
            n += grid.meta.step
          ) {
            const t = (n - start) / (end - start);
            if (t > 0 && t < 1) cuts.add(t);
          }
        }
        const ts = [...cuts].sort((a, b) => a - b);
        for (let k = 1; k < ts.length; k++) {
          const t = (ts[k - 1] + ts[k]) / 2,
            x = a[0] + dx * t,
            z = a[1] + dz * t;
          const height =
            prospectLookoutHeight(
              x + (dz / len) * 0.003,
              z - (dx / len) * 0.003,
            ) ??
            prospectLookoutHeight(
              x - (dz / len) * 0.003,
              z + (dx / len) * 0.003,
            );
          if (height === undefined) continue;
          const u = [a[0] + dx * ts[k - 1], a[1] + dz * ts[k - 1]],
            v = [a[0] + dx * ts[k], a[1] + dz * ts[k]];
          face(
            [u[0], height + 0.008, u[1]],
            [v[0], height + 0.008, v[1]],
            [v[0], terrain.height(...(v as [number, number])) - 0.012, v[1]],
            [u[0], terrain.height(...(u as [number, number])) - 0.012, u[1]],
            stone,
            "lookout cut and fill",
          );
        }
      }
  const rail = (
    a: number[],
    b: number[],
    ya: number,
    yb = ya,
    pickets = true,
    piers = false,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      n = Math.max(1, Math.ceil(length / 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = a[0] + dx * t,
        z = a[1] + dz * t,
        y = ya + (yb - ya) * t;
      box(
        x,
        y + 0.57,
        z,
        piers ? 0.45 : 0.075,
        1.14,
        piers ? 0.45 : 0.075,
        piers ? stone : metal,
        "lookout rail posts",
      );
      if (piers)
        box(x, y + 1.17, z, 0.53, 0.09, 0.53, concrete, "lookout pier caps");
    }
    for (const h of [0.3, 1.08])
      beam(
        [a[0], ya + h, a[1]],
        [b[0], yb + h, b[1]],
        0.05,
        metal,
        "lookout rail beams",
      );
    if (pickets)
      for (let i = 1, n = Math.ceil(length / 0.15); i < n; i++) {
        const t = i / n,
          x = a[0] + dx * t,
          z = a[1] + dz * t,
          y = ya + (yb - ya) * t;
        box(x, y + 0.69, z, 0.019, 0.75, 0.019, metal, "lookout rail pickets");
      }
    // Short collision segments retain the changing height along stair rails.
    for (let i = 0; i < n; i++)
      collision.addBarrier(
        a[0] + (dx * i) / n,
        a[1] + (dz * i) / n,
        a[0] + (dx * (i + 1)) / n,
        a[1] + (dz * (i + 1)) / n,
        0.045,
        Math.max(ya + ((yb - ya) * i) / n, ya + ((yb - ya) * (i + 1)) / n) +
          1.14,
      );
  };
  // The first mapped fence segment accompanies the staircase; its two-sided
  // handrails below follow the constructed treads. Remaining segments edge the plaza.
  for (let i = 2; i < LOOKOUT_FENCE.length - 2; i += 2)
    rail(LOOKOUT_FENCE.slice(i, i + 2), LOOKOUT_FENCE.slice(i + 2, i + 4), 66);
  for (const f of LOOKOUT_FLIGHTS) {
    const dx = f.b[0] - f.a[0],
      dz = f.b[1] - f.a[1],
      len = Math.hypot(dx, dz);
    for (const side of [-1, 1]) {
      const trim = Math.min(1.05, len * 0.24),
        t = trim / len,
        nx = (dz / len) * (f.width / 2 + 0.055) * side,
        nz = (-dx / len) * (f.width / 2 + 0.055) * side;
      rail(
        [f.a[0] + nx + dx * t, f.a[1] + nz + dz * t],
        [f.b[0] + nx - dx * t, f.b[1] + nz - dz * t],
        f.top - (f.top - f.bottom) * t - 0.08,
        f.bottom + (f.top - f.bottom) * t,
        false,
      );
    }
  }
  // Historical photographs show a low stone-pier enclosure at the lower court.
  // Leave both mapped stair entries open on its south-west side.
  for (let i = 2; i < LOOKOUT_COURT.length - 4; i += 2)
    rail(
      LOOKOUT_COURT.slice(i, i + 2),
      LOOKOUT_COURT.slice(i + 2, i + 4),
      56.3,
      56.3,
      false,
      true,
    );
  // Small planted island within the lower ring, clear of both mapped approaches.
  const garden = LOOKOUT_GARDEN;
  for (let i = 0; i < garden.length; i += 2) {
    const j = (i + 2) % garden.length,
      a = [garden[i], 56.44, garden[i + 1]],
      b = [garden[j], 56.44, garden[j + 1]];
    beam(a, b, 0.28, stone, "lookout garden curb", 0.26);
    collision.addBarrier(a[0], a[2], b[0], b[2], 0.14, 56.7);
  }
  // Original furnishings informed by the site's visitor use, not a surveyed inventory.
  for (const [x, z, angle] of [
    [-1638, -3365, -0.72],
    [-1624.7, -3375, -0.72],
  ]) {
    const local = (xx: number, yy: number, zz: number) => [
      x + Math.cos(angle) * xx + Math.sin(angle) * zz,
      66 + yy,
      z - Math.sin(angle) * xx + Math.cos(angle) * zz,
    ];
    for (const xx of [-0.68, 0.68])
      for (const zz of [-0.18, 0.18]) {
        const p = local(xx, 0.25, zz);
        box(p[0], p[1], p[2], 0.05, 0.5, 0.05, metal, "lookout benches", angle);
      }
    for (let s = 0; s < 4; s++) {
      const a = local(-0.9, 0.51, -0.2 + s * 0.135),
        b = local(0.9, 0.51, -0.2 + s * 0.135);
      beam(a, b, 0.09, wood, "lookout benches", 0.075);
    }
    for (let s = 0; s < 3; s++) {
      const a = local(-0.9, 0.72 + s * 0.115, 0.28),
        b = local(0.9, 0.72 + s * 0.115, 0.28);
      beam(a, b, 0.09, wood, "lookout benches", 0.07);
    }
    const a = local(-0.95, 0, 0.1),
      b = local(0.95, 0, 0.1);
    collision.addBarrier(a[0], a[2], b[0], b[2], 0.32, 67.1);
  }
  const result = batch.finish();
  for (const mesh of result)
    mesh.name =
      "Prospect Point lookout — " + (mesh.material as T.Material).name;
  return result;
}
