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
  | "stone"
  | "base"
  | "brick"
  | "trim"
  | "glass"
  | "glassHowe"
  | "frame"
  | "roof"
  | "lining"
  | "blind",
  T.Material
>;
type Frame = ReturnType<typeof facadeFrame>;
type StoneSection = { y: number; depth: number; left: number; right: number };

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
  /** Closed, shaped stone volume. Cross-sections change in both depth and
   * width, giving battered heads/shoulders real inclined faces and returns.
   * All dimensions below are photographic interpretations, not a survey. */
  const shapedStone = (
    f: Frame,
    sections: StoneSection[],
    back = 0.12,
    lip = false,
  ) => {
    const tangent = f.p(1, 0).map((v, i) => v - f.p(0, 0)[i]) as Vertex3;
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1],
        b = sections[i];
      const material = lip && i === sections.length - 1 ? m.trim : m.base;
      quad(
        material,
        [
          f.p(a.left, a.y, a.depth),
          f.p(a.right, a.y, a.depth),
          f.p(b.right, b.y, b.depth),
          f.p(b.left, b.y, b.depth),
        ],
        [f.outward[0], 0, f.outward[1]],
        [a.left, a.y, a.right, a.y, b.right, b.y, b.left, b.y],
      );
      for (const right of [false, true]) {
        const u0 = right ? a.right : a.left,
          u1 = right ? b.right : b.left,
          sign = right ? 1 : -1;
        quad(
          material,
          [
            f.p(u0, a.y, a.depth),
            f.p(u0, a.y, back),
            f.p(u1, b.y, back),
            f.p(u1, b.y, b.depth),
          ],
          [sign * tangent[0], 0, sign * tangent[2]],
          [a.depth, a.y, back, a.y, back, b.y, b.depth, b.y],
        );
      }
      quad(
        m.base,
        [
          f.p(a.left, a.y, back),
          f.p(a.right, a.y, back),
          f.p(b.right, b.y, back),
          f.p(b.left, b.y, back),
        ],
        [-f.outward[0], 0, -f.outward[1]],
        [a.left, a.y, a.right, a.y, b.right, b.y, b.left, b.y],
      );
    }
    const first = sections[0],
      last = sections[sections.length - 1];
    horizontal(
      f,
      m.base,
      first.left,
      first.right,
      first.y,
      first.depth,
      back,
      false,
    );
    horizontal(
      f,
      lip ? m.trim : m.base,
      last.left,
      last.right,
      last.y,
      last.depth,
      back,
    );
  };
  // The reference's broad shoulders widen above the opening heads. Keeping
  // their stations aligned with each individual head makes continuous joints,
  // while a 30–45 mm depth difference exposes the shoulder returns.
  const headStations = [
    [4.25, 0, 0],
    [4.3, 0.02, -0.03],
    [4.4, 0.08, -0.1],
    [4.48, 0.14, -0.135],
    [4.58, 0.14, -0.135],
    [4.65, 0.1, -0.105],
  ];
  const stoneHead = (f: Frame, left: number, right: number) =>
    shapedStone(
      f,
      headStations.map(([y, shoulder, depth]) => ({
        y,
        depth,
        left: left + shoulder,
        right: right - shoulder,
      })),
    );
  const pierShoulder = (
    f: Frame,
    left: number,
    right: number,
    cornerLeft = false,
    cornerRight = false,
  ) => {
    // Exact shared-corner miter: the mapped Cordova/Howe angle is close to,
    // but not precisely, 90 degrees. Both faces meet at the same outer line.
    const adjacent = cornerLeft
      ? facadeFrame(ring[0], ring[1])
      : facadeFrame(ring[1], ring[2]);
    const tangent = f.p(1, 0).map((v, i) => v - f.p(0, 0)[i]);
    const miter = (depth: number) =>
      (-depth *
        ((f.outward[0] + adjacent.outward[0]) * tangent[0] +
          (f.outward[1] + adjacent.outward[1]) * tangent[2])) /
      (1 +
        f.outward[0] * adjacent.outward[0] +
        f.outward[1] * adjacent.outward[1]);
    const stations = [
      [4.12, 0, 0],
      [4.25, 0, -0.045],
      [4.3, 0.02, -0.075],
      [4.4, 0.08, -0.145],
      [4.48, 0.14, -0.18],
      [4.58, 0.14, -0.18],
      [4.65, 0.1, -0.105],
    ];
    shapedStone(
      f,
      stations.map(([y, spread, depth]) => ({
        y,
        depth,
        left: cornerLeft ? miter(depth) : Math.max(0, left - spread),
        right: cornerRight
          ? f.length + miter(depth)
          : Math.min(f.length, right + spread),
      })),
    );
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
    glazing: T.Material,
    a: number,
    b: number,
    lo: number,
    hi: number,
    base = false,
    door = false,
    shapedSill = false,
  ) => {
    const depth = base ? s.baseRecess : s.windowRecess,
      trim = base ? 0.1 : 0.075;
    const revealMaterial = base ? m.base : m.stone;
    side(f, revealMaterial, a, lo, hi, 0, depth, true);
    side(f, revealMaterial, b, lo, hi, 0, depth, false);
    horizontal(f, revealMaterial, a, b, lo, shapedSill ? 0.18 : 0, depth);
    horizontal(f, revealMaterial, a, b, hi, 0, depth, false);
    // A frame is an opening, not a dark opaque rectangle immediately behind
    // the pane. Its perimeter preserves the previous visible coordinates.
    face(f, m.frame, a, a + trim, lo + trim, hi - trim, depth);
    face(f, m.frame, b - trim, b, lo + trim, hi - trim, depth);
    face(f, m.frame, a, b, lo, lo + trim, depth);
    face(f, m.frame, a, b, hi - trim, hi, depth);
    face(f, glazing, a + trim, b - trim, lo + trim, hi - trim, depth - 0.018);

    // One shallow, genuinely closed cavity supplies parallax, occlusion and
    // shaded returns behind the original exterior glazing. No furniture,
    // occupiable room, emissive fill or photographic room panorama is implied.
    const back = depth + 0.86,
      left = a + trim,
      right = b - trim,
      bottom = lo + trim,
      top = hi - trim;
    face(f, m.lining, left, right, bottom, top, back);
    side(f, m.lining, left, bottom, top, depth, back, true);
    side(f, m.lining, right, bottom, top, depth, back, false);
    horizontal(f, m.lining, left, right, bottom, depth, back);
    horizontal(f, m.lining, left, right, top, depth, back, false);

    if (!base) {
      const location = f.p((a + b) / 2, lo);
      const seed =
        ((Math.round(location[0] * 10) * 73856093) ^
          (Math.round(location[2] * 10) * 19349663) ^
          (Math.round(lo * 100) * 83492791)) >>>
        0;
      const coverage = [0, 0, 0.22, 0.36, 0.58, 0, 0.22, 0.44];
      const mid = (a + b) / 2;
      for (const [index, span] of [
        [left + 0.025, mid - 0.07],
        [mid + 0.07, right - 0.025],
      ].entries()) {
        // Vary individual upper sashes deterministically. Source photos show
        // mixed pane appearance; exact blind positions are an interpretation.
        let hash = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
        hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
        const amount = coverage[(hash ^ (hash >>> 13)) & 7];
        const [l, r] = span,
          head = top - 0.025,
          blindDepth = depth + 0.19;
        solid(
          f,
          m.blind,
          l,
          r,
          head - 0.075,
          head,
          blindDepth - 0.025,
          blindDepth + 0.04,
        );
        if (!amount) continue;
        const end = head - (top - bottom) * amount;
        for (let y = head - 0.075; y > end + 0.012; y -= 0.065) {
          const low = Math.max(end, y - 0.052);
          quad(
            m.blind,
            [
              f.p(l, y, blindDepth),
              f.p(r, y, blindDepth),
              f.p(r, low, blindDepth + 0.034),
              f.p(l, low, blindDepth + 0.034),
            ],
            [f.outward[0] * 0.85, 0.54, f.outward[1] * 0.85],
            [l, y, r, y, r, low, l, low],
          );
        }
        solid(
          f,
          m.blind,
          l,
          r,
          end - 0.018,
          end + 0.018,
          blindDepth - 0.012,
          blindDepth + 0.05,
        );
      }
    }
    const bar = (aa: number, bb: number, ll: number, hh: number) =>
      solid(f, m.frame, aa, bb, ll, hh, depth - 0.065, depth - 0.008);
    const mid = (a + b) / 2;
    bar(mid - 0.048, mid + 0.048, lo + trim, hi - trim);
    // Source ground windows have narrow top lights. Do not stretch entrance
    // doors or change the separate paired upper sash proportions with them.
    const transom = door ? lo + 2.42 : lo + (hi - lo) * (base ? 0.82 : 0.66);
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
    if (shapedSill) {
      shapedStone(
        f,
        [
          { y: lo - 0.22, depth: 0.06, left: a, right: b },
          { y: lo - 0.14, depth: 0.025, left: a - 0.035, right: b + 0.035 },
          { y: lo - 0.11, depth: 0, left: a - 0.065, right: b + 0.065 },
          { y: lo - 0.025, depth: 0, left: a - 0.065, right: b + 0.065 },
          { y: lo, depth: 0.16, left: a - 0.065, right: b + 0.065 },
        ],
        0.18,
        true,
      );
    } else
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
    const glazing = edge === 0 ? m.glass : m.glassHowe;
    const bays = pacificCoastBays(edge),
      baseBays = bays.map((b, i) => ({
        ...b,
        door: edge === 1 && (i === 2 || i === 3),
        index: i,
      }));
    let previous = 0;
    for (const b of baseBays) {
      pier(f, previous, b.left, s.baseBottom, s.baseTop, m.base, 0.85);
      if (edge === 0) pierShoulder(f, previous, b.left);
      // The photographed prominent corner column carries its cap around Howe;
      // other Howe heads are obscured and do not receive invented matching trim.
      if (edge === 1 && b.index === 0) pierShoulder(f, previous, b.left, true);
      const sill = b.door ? thresholds[b.index] : edge === 0 ? 0.3 : 0.7,
        head = 4.25;
      if (edge === 0) {
        // Recessed plinth panel and its bevelled stone cap are all
        // inside the original outline. No uncollidable stone apron is added.
        pier(f, b.left, b.right, s.baseBottom, -0.52, m.base, 0.5);
        shapedStone(f, [
          { y: -0.52, depth: 0, left: b.left, right: b.right },
          { y: -0.46, depth: 0, left: b.left, right: b.right },
          { y: -0.39, depth: 0.06, left: b.left, right: b.right },
        ]);
        face(f, m.base, b.left, b.right, -0.39, sill - 0.22, 0.06);
        side(f, m.base, b.left, -0.39, sill - 0.22, 0, 0.06, true);
        side(f, m.base, b.right, -0.39, sill - 0.22, 0, 0.06, false);
      } else pier(f, b.left, b.right, s.baseBottom, sill, m.base, 0.5);
      face(f, m.base, b.left, b.right, head, s.baseTop);
      if (edge === 0) stoneHead(f, b.left, b.right);
      window(f, glazing, b.left, b.right, sill, head, true, b.door, edge === 0);
      previous = b.right;
    }
    pier(f, previous, f.length, s.baseBottom, s.baseTop, m.base, 0.85);
    if (edge === 0) pierShoulder(f, previous, f.length, false, true);
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
        window(f, glazing, b.left, b.right, row.sill, row.head);
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
