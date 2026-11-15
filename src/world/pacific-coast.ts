import * as T from "three";
import type { Building, Point } from "./data";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import { Batcher, flatPolygon } from "./geometry";
import {
  PACIFIC_COAST_ID as ID,
  PACIFIC_COAST_RING as ring,
  PACIFIC_COAST_CENTRE as centre,
  PACIFIC_COAST_SECTION as s,
  PACIFIC_COAST_PLANT_RING as plantRing,
  pacificCoastBays,
  PACIFIC_COAST_ENTRANCE_THRESHOLDS as thresholds,
} from "./pacific-coast-site";
export type PacificCoastGeometryMaterials = Record<
  "stone" | "base" | "brick" | "trim" | "glass" | "frame" | "roof",
  T.Material
>;
type Frame = ReturnType<typeof facadeFrame>;

/** Original present-day 325 Howe exterior. Source-specific vertical piers,
 * rectangular paired windows and a restrained parapet replace the unrelated
 * arch photograph. Street-grade lower exposure is retained; interiors closed. */
export function buildPacificCoast(
  batch: Batcher,
  building: Pick<Building, "id" | "pts">,
  m: PacificCoastGeometryMaterials,
) {
  if (building.id !== ID) return false;
  const mesh = new ArchitecturalMesh(batch, ...centre);
  const quad = (
    mat: T.Material,
    p: Vertex3[],
    normal: Vertex3,
    uv?: number[],
  ) => {
    const cross = new T.Vector3(...p[1])
      .sub(new T.Vector3(...p[0]))
      .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    if (!uv) {
      const w = Math.hypot(...p[1].map((v, i) => v - p[0][i])),
        h = Math.hypot(...p[3].map((v, i) => v - p[0][i]));
      uv = [0, 0, w, 0, w, h, 0, h];
    }
    if (cross.dot(new T.Vector3(...normal)) < 0) {
      p = [p[0], p[3], p[2], p[1]];
      uv = [
        ...uv.slice(0, 2),
        ...uv.slice(6, 8),
        ...uv.slice(4, 6),
        ...uv.slice(2, 4),
      ];
    }
    mesh.quad(mat, p[0], p[1], p[2], p[3], uv);
  };
  const face = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    lo: number,
    hi: number,
    d = 0,
  ) => {
    if (b - a < 1e-5 || hi - lo < 1e-5) return;
    quad(
      mat,
      [f.p(a, lo, d), f.p(b, lo, d), f.p(b, hi, d), f.p(a, hi, d)],
      [f.outward[0], 0, f.outward[1]],
      [a, lo, b, lo, b, hi, a, hi],
    );
  };
  const horizontal = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    y: number,
    d0: number,
    d1: number,
    up = true,
  ) =>
    quad(
      mat,
      [f.p(a, y, d0), f.p(b, y, d0), f.p(b, y, d1), f.p(a, y, d1)],
      [0, up ? 1 : -1, 0],
      [a, d0, b, d0, b, d1, a, d1],
    );
  const side = (
    f: Frame,
    mat: T.Material,
    u: number,
    lo: number,
    hi: number,
    d0: number,
    d1: number,
    right: boolean,
  ) => {
    const a = f.p(0, 0),
      b = f.p(1, 0),
      sign = right ? 1 : -1;
    quad(
      mat,
      [f.p(u, lo, d0), f.p(u, lo, d1), f.p(u, hi, d1), f.p(u, hi, d0)],
      [sign * (b[0] - a[0]), 0, sign * (b[2] - a[2])],
      [u + d0, lo, u + d1, lo, u + d1, hi, u + d0, hi],
    );
  };
  const solid = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    lo: number,
    hi: number,
    d0: number,
    d1: number,
  ) => {
    face(f, mat, a, b, lo, hi, d0);
    horizontal(f, mat, a, b, lo, d0, d1, false);
    horizontal(f, mat, a, b, hi, d0, d1);
    side(f, mat, a, lo, hi, d0, d1, false);
    side(f, mat, b, lo, hi, d0, d1, true);
  };
  const pier = (
    f: Frame,
    a: number,
    b: number,
    lo: number,
    hi: number,
    mat: T.Material,
    course = 1.1,
  ) => {
    // Fine real horizontal joints break broad mineral piers without changing
    // their source-supported vertical emphasis or drawing stripes on the wall.
    face(f, mat, a, b, lo, hi, 0.025);
    for (let y = lo; y < hi; y += course) {
      const top = Math.min(hi, y + course),
        inset = 0.008;
      face(f, mat, a, b, y + inset, top - inset, 0);
      horizontal(f, mat, a, b, y + inset, 0, 0.025, false);
      horizontal(f, mat, a, b, top - inset, 0, 0.025);
    }
  };
  const spandrel = (
    f: Frame,
    a: number,
    b: number,
    lo: number,
    hi: number,
    mat: T.Material,
  ) => {
    if (hi - lo < 0.01) return;
    const depth = mat === m.brick ? 0.055 : 0;
    face(f, mat, a, b, lo, hi, depth);
    if (depth) {
      horizontal(f, m.stone, a, b, lo, 0, depth);
      horizontal(f, m.stone, a, b, hi, 0, depth, false);
      side(f, m.stone, a, lo, hi, 0, depth, true);
      side(f, m.stone, b, lo, hi, 0, depth, false);
    }
  };
  const window = (
    f: Frame,
    a: number,
    b: number,
    lo: number,
    hi: number,
    base = false,
    door = false,
  ) => {
    const depth = base ? s.baseRecess : s.windowRecess,
      trim = base ? 0.1 : 0.075;
    const revealMaterial = base ? m.base : m.stone;
    side(f, revealMaterial, a, lo, hi, 0, depth, true);
    side(f, revealMaterial, b, lo, hi, 0, depth, false);
    horizontal(f, revealMaterial, a, b, lo, 0, depth);
    horizontal(f, revealMaterial, a, b, hi, 0, depth, false);
    face(f, m.frame, a, b, lo, hi, depth);
    face(f, m.glass, a + trim, b - trim, lo + trim, hi - trim, depth - 0.018);
    const bar = (aa: number, bb: number, ll: number, hh: number) =>
      solid(f, m.frame, aa, bb, ll, hh, depth - 0.065, depth - 0.008);
    const mid = (a + b) / 2;
    bar(mid - 0.048, mid + 0.048, lo + trim, hi - trim);
    const transom = door ? lo + 2.42 : lo + (hi - lo) * 0.66;
    bar(a + trim, b - trim, transom - 0.034, transom + 0.034);
    // Separate sash edges and slight meeting-rail depth hold up at walking range.
    for (const [left, right] of [
      [a + trim, mid - 0.048],
      [mid + 0.048, b - trim],
    ]) {
      bar(left + 0.032, left + 0.055, lo + trim + 0.03, transom - 0.03);
      bar(right - 0.055, right - 0.032, lo + trim + 0.03, transom - 0.03);
      bar(left + 0.03, right - 0.03, lo + trim + 0.03, lo + trim + 0.055);
    }
    if (door) {
      // Closed paired entrance doors, modest handles and threshold; no invented tenant.
      for (const sign of [-1, 1]) {
        const u = mid + sign * 0.16;
        solid(
          f,
          m.frame,
          u - 0.017,
          u + 0.017,
          lo + 0.8,
          lo + 1.23,
          depth - 0.13,
          depth - 0.065,
        );
        for (const y of [lo + 0.83, lo + 1.2])
          solid(
            f,
            m.frame,
            u - 0.03,
            u + 0.03,
            y - 0.012,
            y + 0.012,
            depth - 0.065,
            depth - 0.015,
          );
      }
    }
    // The street base stays within its collision outline; upper sills project
    // above the player, providing an actual underside and modest runoff lip.
    const projection = base ? 0 : -0.095;
    solid(f, m.trim, a - 0.065, b + 0.065, lo - 0.115, lo, projection, 0.14);
    if (!base) solid(f, m.trim, a, b, hi, hi + 0.055, -0.022, 0.05);
  };
  const band = (
    f: Frame,
    mat: T.Material,
    low: number,
    high: number,
    projection: number,
  ) => solid(f, mat, 0, f.length, low, high, projection, 0.1);

  for (let edge = 0; edge < ring.length; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % ring.length]),
      visible = edge < 2;
    if (!visible) {
      pier(f, 0, f.length, s.baseBottom, s.baseTop, m.base, 0.85);
      face(f, m.stone, 0, f.length, s.baseTop, s.roof);
      continue;
    }
    const bays = pacificCoastBays(edge),
      baseBays = bays.map((b, i) => ({
        ...b,
        door: edge === 1 && (i === 2 || i === 3),
        index: i,
      }));
    let previous = 0;
    for (const b of baseBays) {
      pier(f, previous, b.left, s.baseBottom, s.baseTop, m.base, 0.85);
      const sill = b.door ? thresholds[b.index] : edge === 0 ? 0.3 : 0.7,
        head = 4.25;
      pier(f, b.left, b.right, s.baseBottom, sill, m.base, 0.5);
      face(f, m.base, b.left, b.right, head, s.baseTop);
      window(f, b.left, b.right, sill, head, true, b.door);
      previous = b.right;
    }
    pier(f, previous, f.length, s.baseBottom, s.baseTop, m.base, 0.85);
    band(f, m.base, s.baseTop, s.baseTop + 0.16, -0.105);
    band(f, m.trim, s.baseTop + 0.16, s.beltTop, -0.15);

    previous = 0;
    for (const b of bays) {
      pier(f, previous, b.left, s.beltTop, s.roof, m.stone);
      let low: number = s.beltTop;
      for (const row of s.rows) {
        spandrel(
          f,
          b.left,
          b.right,
          low,
          row.sill,
          edge === 1 ? m.brick : m.stone,
        );
        window(f, b.left, b.right, row.sill, row.head);
        low = row.head;
      }
      spandrel(f, b.left, b.right, low, s.roof, edge === 1 ? m.brick : m.stone);
      previous = b.right;
    }
    pier(f, previous, f.length, s.beltTop, s.roof, m.stone);
    // The retained subtle stringcourse beneath the top row is not the removed
    // deep historic cornice. Cordova's pale spandrels stay free of orange brick.
    band(f, m.trim, 20.73, 20.84, -0.085);
  }

  // Slim parapet is mitered at the true footprint corners, with a closed inner
  // face and roof cap. No historic overhanging cornice or giant pitched roof.
  const inset = (depth: number): Point[] =>
    ring.map((point, i) => {
      const previous = facadeFrame(ring[(i + 3) % 4], point),
        next = facadeFrame(point, ring[(i + 1) % 4]);
      const nx = previous.outward[0] + next.outward[0],
        nz = previous.outward[1] + next.outward[1];
      const den = nx * next.outward[0] + nz * next.outward[1];
      return [point[0] - (depth * nx) / den, point[1] - (depth * nz) / den];
    });
  const inside = inset(0.24),
    outside = inset(-0.055);
  for (let edge = 0; edge < 4; edge++) {
    const next = (edge + 1) % 4,
      f = facadeFrame(ring[edge], ring[next]);
    face(f, m.stone, 0, f.length, s.roof, s.parapet - 0.07);
    const back = facadeFrame(inside[next], inside[edge]);
    face(back, m.base, 0, back.length, s.roof, s.parapet);
    quad(
      m.trim,
      [
        [outside[edge][0], s.parapet, outside[edge][1]],
        [outside[next][0], s.parapet, outside[next][1]],
        [inside[next][0], s.parapet, inside[next][1]],
        [inside[edge][0], s.parapet, inside[edge][1]],
      ],
      [0, 1, 0],
    );
    const front = facadeFrame(outside[edge], outside[next]);
    face(front, m.trim, 0, front.length, s.parapet - 0.07, s.parapet);
  }
  mesh.add(flatPolygon(inside.flat(), [], s.roof, 1), m.roof);
  // The small inset service structure has the source part's actual plan area.
  // Its height is an interpretation below the highest historical element.
  for (let edge = 0; edge < plantRing.length; edge++) {
    const f = facadeFrame(
      plantRing[edge],
      plantRing[(edge + 1) % plantRing.length],
    );
    face(f, m.base, 0, f.length, s.roof, s.plantRoom);
    horizontal(f, m.trim, 0, f.length, s.plantRoom, -0.025, 0.18);
  }
  mesh.add(flatPolygon(plantRing.flat(), [], s.plantRoom, 1), m.roof);
  const plantCentre: Point = [
    plantRing.reduce((n, p) => n + p[0], 0) / 4,
    plantRing.reduce((n, p) => n + p[1], 0) / 4,
  ];
  // One low service cabinet and a pair of low roof vents are visible roof clutter;
  // they do not stand in for a much taller continuous roof.
  mesh.box(
    [plantCentre[0], s.plantRoom + 0.28, plantCentre[1]],
    1.15,
    0.56,
    0.75,
    m.roof,
  );
  const roofFrame = facadeFrame(ring[2], ring[3]);
  for (const u of [4.0, 7.0])
    mesh.box(roofFrame.p(u, s.roof + 0.25, 3.0), 0.7, 0.5, 0.7, m.base);
  mesh.finish();
  return true;
}
