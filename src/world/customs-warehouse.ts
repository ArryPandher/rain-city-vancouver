import * as T from "three";
import type { Building, Point } from "./data";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import { Batcher, flatPolygon } from "./geometry";
import {
  CUSTOMS_WAREHOUSE_ID as ID,
  CUSTOMS_WAREHOUSE_RING as ring,
  CUSTOMS_WAREHOUSE_CENTRE as centre,
  CUSTOMS_WAREHOUSE_SECTION as s,
  warehouseBays,
  CUSTOMS_WAREHOUSE_INNER_ROOF as insetRing,
  CUSTOMS_WAREHOUSE_FLAT_ROOF as flatRing,
} from "./customs-warehouse-site";

export type CustomsWarehouseGeometryMaterials = Record<
  | "brick"
  | "stone"
  | "trim"
  | "glass"
  | "frame"
  | "roof"
  | "cornice"
  | "gravel",
  T.Material
>;
type Frame = ReturnType<typeof facadeFrame>;
type Aperture = {
  outline: Point[];
  left: number;
  right: number;
  low: number;
  high: number;
  arched: boolean;
};
const rect = (a: number, b: number, lo: number, hi: number): Point[] => [
  [a, lo],
  [b, lo],
  [b, hi],
  [a, hi],
];

/** Dedicated closed exterior. No generic storefront, photograph wall, or
 * playable underground/interior space is created. */
export function buildCustomsWarehouse(
  batch: Batcher,
  building: Pick<Building, "id" | "pts">,
  m: CustomsWarehouseGeometryMaterials,
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
      const w = Math.hypot(...p[1].map((v, i) => v - p[0][i]));
      const h = Math.hypot(...p[3].map((v, i) => v - p[0][i]));
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
    );
  };
  const extrusion = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    lo: number,
    hi: number,
    front: number,
    back = 0,
  ) => {
    face(f, mat, a, b, lo, hi, front);
    horizontal(f, mat, a, b, lo, front, back, false);
    horizontal(f, mat, a, b, hi, front, back);
    side(f, mat, a, lo, hi, front, back, false);
    side(f, mat, b, lo, hi, front, back, true);
  };
  const plane = (
    f: Frame,
    mat: T.Material,
    outline: Point[],
    holes: Point[][] = [],
    depth = 0,
    reverse = false,
  ) => {
    const shape = new T.Shape(outline.map((p) => new T.Vector2(...p)));
    for (const h of holes)
      shape.holes.push(new T.Path(h.map((p) => new T.Vector2(...p))));
    const g = new T.ShapeGeometry(shape),
      p = g.getAttribute("position"),
      uv = g.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i),
        y = p.getY(i);
      p.setXYZ(i, ...f.p(u, y, depth));
      uv.setXY(i, u, y);
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(p, ix.getX(i));
      const b = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 1));
      const c = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 2));
      if (
        b
          .sub(a)
          .cross(c.sub(a))
          .dot(
            new T.Vector3(f.outward[0], 0, f.outward[1]).multiplyScalar(
              reverse ? -1 : 1,
            ),
          ) < 0
      ) {
        const q = ix.getX(i + 1);
        ix.setX(i + 1, ix.getX(i + 2));
        ix.setX(i + 2, q);
      }
    }
    g.computeVertexNormals();
    mesh.add(g, mat);
  };
  const aperture = (
    left: number,
    right: number,
    low: number,
    high: number,
    arched = false,
  ): Aperture => {
    if (!arched)
      return {
        left,
        right,
        low,
        high,
        arched,
        outline: rect(left, right, low, high),
      };
    const hw = (right - left) / 2,
      rise = high - s.upper.spring,
      radius = (hw * hw + rise * rise) / (2 * rise);
    const yc = high - radius,
      mid = (left + right) / 2;
    const outline: Point[] = [
      [left, low],
      [right, low],
      [right, s.upper.spring],
    ];
    for (let i = 1; i <= 16; i++) {
      const x = hw - (i * 2 * hw) / 16;
      outline.push([
        mid + x,
        yc + Math.sqrt(Math.max(0, radius * radius - x * x)),
      ]);
    }
    return { left, right, low, high, arched, outline };
  };
  const opening = (f: Frame, o: Aperture, material: T.Material) => {
    const d = s.recess;
    for (let i = 0; i < o.outline.length; i++) {
      const a = o.outline[i],
        b = o.outline[(i + 1) % o.outline.length];
      const tangent = f.p(1, 0).map((v, j) => v - f.p(0, 0)[j]);
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      quad(
        material,
        [
          f.p(a[0], a[1], 0),
          f.p(b[0], b[1], 0),
          f.p(b[0], b[1], d),
          f.p(a[0], a[1], d),
        ],
        [-dy * tangent[0], dx, -dy * tangent[2]],
        Math.abs(dx) < 0.001
          ? [a[0], a[1], a[0], b[1], a[0] + d, b[1], a[0] + d, a[1]]
          : [a[0], 0, b[0], 0, b[0], d, a[0], d],
      );
    }
    plane(f, m.frame, o.outline, [], d);
    const cx = (o.left + o.right) / 2,
      cy = (o.low + o.high) / 2;
    const inner = o.outline.map(
      ([x, y]) =>
        [
          cx + (x - cx) * (1 - 0.16 / (o.right - o.left)),
          cy + (y - cy) * (1 - 0.16 / (o.high - o.low)),
        ] as Point,
    );
    plane(f, m.glass, inner, [], d - 0.014);
    const frameBar = (a: number, b: number, lo: number, hi: number) =>
      extrusion(f, m.frame, a, b, lo, hi, d - 0.052, d - 0.008);
    if (o.arched) {
      // Four lights under the curved head, with a stronger central meeting rail.
      for (const t of [0.25, 0.5, 0.75]) {
        const u = o.left + (o.right - o.left) * t;
        frameBar(
          u - (t === 0.5 ? 0.042 : 0.027),
          u + (t === 0.5 ? 0.042 : 0.027),
          o.low + 0.07,
          (() => {
            const half = (o.right - o.left) / 2,
              rise = o.high - s.upper.spring;
            const radius = (half * half + rise * rise) / (2 * rise);
            const x = Math.abs(u - (o.left + o.right) / 2) + 0.045;
            return o.high - radius + Math.sqrt(radius * radius - x * x) - 0.09;
          })(),
        );
      }
      frameBar(
        o.left + 0.07,
        o.right - 0.07,
        o.low + 1.3 - 0.033,
        o.low + 1.3 + 0.033,
      );
      frameBar(
        o.left + 0.07,
        o.right - 0.07,
        s.upper.spring - 0.035,
        s.upper.spring + 0.035,
      );
    } else {
      for (const t of [0.36, 0.76]) {
        const y = o.low + (o.high - o.low) * t;
        frameBar(o.left + 0.07, o.right - 0.07, y - 0.035, y + 0.035);
      }
    }
    extrusion(
      f,
      m.trim,
      o.left - 0.1,
      o.right + 0.1,
      o.low - 0.16,
      o.low,
      material === m.stone ? 0 : -0.17,
      0.1,
    );
    if (!o.arched) {
      extrusion(
        f,
        m.trim,
        o.left - 0.035,
        o.right + 0.035,
        o.high,
        o.high + 0.075,
        material === m.stone ? 0 : -0.035,
        0.08,
      );
      extrusion(
        f,
        m.trim,
        cx - 0.075,
        cx + 0.075,
        o.high - 0.025,
        o.high + 0.29,
        material === m.stone ? 0 : -0.045,
        0.02,
      );
    }
  };
  const archedSurround = (f: Frame, o: Aperture) => {
    const half = (o.right - o.left) / 2,
      rise = o.high - s.upper.spring;
    const radius = (half * half + rise * rise) / (2 * rise),
      yc = o.high - radius,
      mid = (o.left + o.right) / 2;
    const theta = Math.asin(half / radius);
    for (let band = 0; band < 3; band++) {
      const r0 = radius + band * 0.085,
        r1 = r0 + 0.085;
      const d = -0.08 - band * 0.055;
      for (let i = 0; i < 18; i++) {
        const ta = -theta + (i * 2 * theta) / 18,
          tb = -theta + ((i + 1) * 2 * theta) / 18;
        const a: [number, number] = [
          mid + r0 * Math.sin(ta),
          yc + r0 * Math.cos(ta),
        ];
        const b: [number, number] = [
          mid + r0 * Math.sin(tb),
          yc + r0 * Math.cos(tb),
        ];
        const c: [number, number] = [
          mid + r1 * Math.sin(tb),
          yc + r1 * Math.cos(tb),
        ];
        const e: [number, number] = [
          mid + r1 * Math.sin(ta),
          yc + r1 * Math.cos(ta),
        ];
        quad(
          m.trim,
          [f.p(...a, d), f.p(...b, d), f.p(...c, d), f.p(...e, d)],
          [f.outward[0], 0, f.outward[1]],
          [...a, ...b, ...c, ...e],
        );
        // Exposed radial moulding step creates a shadow along each nested bead.
        quad(
          m.trim,
          [
            f.p(...c, d),
            f.p(...e, d),
            f.p(...e, d + 0.055),
            f.p(...c, d + 0.055),
          ],
          [f.outward[0] * 0.3, 1, f.outward[1] * 0.3],
        );
      }
    }
    plane(
      f,
      m.trim,
      [
        [mid - 0.19, o.high - 0.09],
        [mid + 0.19, o.high - 0.09],
        [mid + 0.24, o.high + 0.46],
        [mid - 0.24, o.high + 0.46],
      ],
      [],
      -0.255,
    );
  };
  const ashlar = (f: Frame, holes: Aperture[], detailed: boolean) => {
    plane(
      f,
      m.stone,
      rect(0, f.length, s.baseBottom, s.stoneTop),
      holes.map((o) => o.outline),
      0.042,
    );
    if (!detailed) return;
    const cuts = [
      s.baseBottom,
      s.stoneTop,
      ...holes.flatMap((o) => [o.low, o.high]),
    ];
    for (let y = s.baseBottom + s.course; y < s.stoneTop; y += s.course)
      cuts.push(y);
    const ys = [...new Set(cuts)].sort((a, b) => a - b);
    for (let row = 0; row < ys.length - 1; row++) {
      const lo = ys[row],
        hi = ys[row + 1];
      if (hi - lo < 0.035) continue;
      const spacing = 1.24,
        offset = row % 2 ? spacing / 2 : 0;
      for (let u = -offset; u < f.length; u += spacing) {
        let spans: [number, number][] = [
          [Math.max(0, u), Math.min(f.length, u + spacing)],
        ];
        for (const h of holes)
          if (lo < h.high - 1e-5 && hi > h.low + 1e-5) {
            spans = spans.flatMap(([a, b]) =>
              b <= h.left || a >= h.right
                ? [[a, b]]
                : [
                    ...(a < h.left ? [[a, h.left] as [number, number]] : []),
                    ...(b > h.right ? [[h.right, b] as [number, number]] : []),
                  ],
            );
          }
        for (const [a, b] of spans) {
          const gap = 0.009,
            bevel = 0.023;
          if (b - a < 0.07) continue;
          const aa = a + gap,
            bb = b - gap,
            ll = lo + gap,
            hh = hi - gap;
          const noise = (k: number) => {
            const q =
              Math.sin(a * 14.31 + row * 37.11 + k * 17.73) * 43758.5453;
            return (q - Math.floor(q)) * 2 - 1;
          };
          const baseDepth = 0.019 + noise(1) * 0.006;
          const xx = [
            aa + bevel,
            (aa + bb) / 2 + noise(2) * (bb - aa) * 0.045,
            bb - bevel,
          ];
          const yy = [
            ll + bevel,
            (ll + hh) / 2 + noise(3) * (hh - ll) * 0.035,
            hh - bevel,
          ];
          const depths = Array.from({ length: 3 }, (_, y) =>
            Array.from({ length: 3 }, (_, x) =>
              Math.max(
                0.001,
                baseDepth +
                  noise(4 + y * 3 + x) * 0.006 -
                  (x === 1 && y === 1 ? 0.011 : 0),
              ),
            ),
          );
          for (let y = 0; y < 2; y++)
            for (let x = 0; x < 2; x++) {
              quad(
                m.stone,
                [
                  f.p(xx[x], yy[y], depths[y][x]),
                  f.p(xx[x + 1], yy[y], depths[y][x + 1]),
                  f.p(xx[x + 1], yy[y + 1], depths[y + 1][x + 1]),
                  f.p(xx[x], yy[y + 1], depths[y + 1][x]),
                ],
                [f.outward[0], 0, f.outward[1]],
                [
                  xx[x],
                  yy[y],
                  xx[x + 1],
                  yy[y],
                  xx[x + 1],
                  yy[y + 1],
                  xx[x],
                  yy[y + 1],
                ],
              );
            }
          const cornerDepths = [
            depths[0][0],
            depths[0][2],
            depths[2][2],
            depths[2][0],
          ];
          const points = rect(aa, bb, ll, hh),
            inner = rect(aa + bevel, bb - bevel, ll + bevel, hh - bevel);
          for (let k = 0; k < 4; k++) {
            const j = (k + 1) % 4,
              oa = points[k],
              ob = points[j],
              ia = inner[k],
              ib = inner[j];
            quad(
              m.stone,
              [
                f.p(...oa, 0.034),
                f.p(...ob, 0.034),
                f.p(...ib, cornerDepths[j]),
                f.p(...ia, cornerDepths[k]),
              ],
              [f.outward[0], 0, f.outward[1]],
              [...oa, ...ob, ...ib, ...ia],
            );
          }
        }
      }
    }
  };

  for (let edge = 0; edge < ring.length; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % ring.length]),
      visible = edge < 2;
    const bays = warehouseBays(edge),
      base: Aperture[] = [],
      upper: Aperture[] = [];
    if (visible)
      for (const [bi, bay] of bays.entries()) {
        const w = bay.openingWidth,
          mid = bay.centre,
          gap = 0.5;
        if (edge === 1 && bi === 2)
          base.push(aperture(mid - w / 2, mid + w / 2, 0.65, 6.3));
        else {
          base.push(aperture(mid - w / 2, mid - gap / 2, 2.2, 6.3));
          base.push(aperture(mid + gap / 2, mid + w / 2, 2.2, 6.3));
        }
        for (const row of [s.lower, s.middle]) {
          upper.push(aperture(mid - w / 2, mid - gap / 2, row.sill, row.head));
          upper.push(aperture(mid + gap / 2, mid + w / 2, row.sill, row.head));
        }
        upper.push(
          aperture(mid - w / 2, mid + w / 2, s.upper.sill, s.upper.crown, true),
        );
      }
    ashlar(f, base, visible);
    for (const o of base) opening(f, o, m.stone);
    extrusion(f, m.trim, 0, f.length, s.stoneTop, s.stoneCap, -0.13, 0.2);
    plane(
      f,
      m.brick,
      rect(0, f.length, s.stoneCap, s.brickTop),
      upper.map((o) => o.outline),
    );
    for (const o of upper) {
      opening(f, o, m.brick);
      if (o.arched) archedSurround(f, o);
    }
    if (visible) {
      const boundaries = [
        0.48,
        ...bays.slice(0, -1).map((b, i) => (b.centre + bays[i + 1].centre) / 2),
        f.length - 0.48,
      ];
      for (const u of boundaries) {
        const half = u < 1 || u > f.length - 1 ? 0.47 : 0.42;
        extrusion(
          f,
          m.brick,
          u - half,
          u + half,
          s.stoneCap,
          s.upper.spring + 0.02,
          -0.14,
          0,
        );
        extrusion(
          f,
          m.trim,
          u - half - 0.16,
          u + half + 0.16,
          s.upper.spring - 0.13,
          s.upper.spring + 0.22,
          -0.28,
          -0.1,
        );
        extrusion(
          f,
          m.trim,
          u - half - 0.08,
          u + half + 0.08,
          s.upper.spring + 0.22,
          s.upper.spring + 0.36,
          -0.2,
          -0.1,
        );
      }
    }
    // Dark projecting cornice, with a deep underside and individual dentils.
    const count = Math.floor(f.length / 0.62);
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * f.length) / count;
      extrusion(
        f,
        m.cornice,
        u - 0.1,
        u + 0.1,
        s.brickTop - 0.21,
        s.brickTop + 0.12,
        -0.3,
        0.02,
      );
    }
  }
  // Miter every cornice profile at the real plan corners, avoiding four
  // overlapping boxes or missing outer-corner slivers.
  const offsetRing = (depth: number): Point[] =>
    ring.map((point, i) => {
      const prev = facadeFrame(
        ring[(i + ring.length - 1) % ring.length],
        point,
      );
      const next = facadeFrame(point, ring[(i + 1) % ring.length]);
      const nx = prev.outward[0] + next.outward[0],
        nz = prev.outward[1] + next.outward[1];
      const denominator = nx * next.outward[0] + nz * next.outward[1];
      return [
        point[0] - (depth * nx) / denominator,
        point[1] - (depth * nz) / denominator,
      ];
    });
  const profile: Point[] = [
    [s.brickTop, 0],
    [s.brickTop, -0.19],
    [s.brickTop + 0.14, -0.19],
    [s.brickTop + 0.14, -0.36],
    [s.corniceTop - 0.18, -0.36],
    [s.corniceTop - 0.18, -0.52],
    [s.corniceTop, -0.52],
    [s.corniceTop, 0],
  ];
  for (let k = 1; k < profile.length; k++) {
    const [y0, d0] = profile[k - 1],
      [y1, d1] = profile[k],
      a = offsetRing(d0),
      b = offsetRing(d1);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length,
        f = facadeFrame(ring[i], ring[j]);
      quad(
        m.cornice,
        [
          [a[i][0], y0, a[i][1]],
          [a[j][0], y0, a[j][1]],
          [b[j][0], y1, b[j][1]],
          [b[i][0], y1, b[i][1]],
        ],
        [f.outward[0] * (y1 - y0), d1 - d0, f.outward[1] * (y1 - y0)],
      );
    }
  }
  // Aerial-grounded roof: two sloped perimeter bands, a LARGE flat gravel
  // center and low rooflights. The historical highest-element value does not
  // justify filling the center with an opaque pyramid.
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    for (const [outer, inner, low, high] of [
      [ring, insetRing, s.corniceTop, s.roofJunction],
      [insetRing, flatRing, s.roofJunction, s.flatRoof],
    ] as const) {
      quad(
        m.roof,
        [
          [outer[i][0], low, outer[i][1]],
          [outer[j][0], low, outer[j][1]],
          [inner[j][0], high, inner[j][1]],
          [inner[i][0], high, inner[i][1]],
        ],
        [0, 1, 0],
      );
      // Small raised standing seams follow each roof plane. Their tops share
      // the same aged metal material instead of using drawn dark lines.
      const length = Math.hypot(
        outer[j][0] - outer[i][0],
        outer[j][1] - outer[i][1],
      );
      const count = Math.floor(length / 0.66);
      const point = (t: number, inside: boolean, y: number): Vertex3 => {
        const r = inside ? inner : outer;
        return [
          r[i][0] + (r[j][0] - r[i][0]) * t,
          y,
          r[i][1] + (r[j][1] - r[i][1]) * t,
        ];
      };
      for (let k = 1; k < count; k++) {
        const t = k / count,
          w = 0.012 / length;
        for (const side of [-1, 1])
          quad(
            m.roof,
            [
              point(t, false, low + 0.022),
              point(t + side * w, false, low + 0.003),
              point(t + side * w, true, high + 0.003),
              point(t, true, high + 0.022),
            ],
            [0, 1, 0],
          );
      }
    }
  }
  mesh.add(flatPolygon(flatRing.flat(), [], s.flatRoof, 1), m.gravel);

  // Three shallow curved parapet caps on each photographed street face.
  // Their exact section is photo-fit; closed backs and curved edge returns
  // keep them credible when the player looks back from either street.
  for (const edge of [0, 1]) {
    const f = facadeFrame(ring[edge], ring[edge + 1]);
    for (const index of [0, 2, 4]) {
      const bay = warehouseBays(edge)[index],
        hw = Math.min(1.5, bay.openingWidth * 0.4);
      const low = s.corniceTop + 0.11,
        spring = low + 0.32,
        rise = 0.75;
      const radius = (hw * hw + rise * rise) / (2 * rise),
        yc = spring + rise - radius;
      const outline: Point[] = [
        [bay.centre - hw, low],
        [bay.centre + hw, low],
        [bay.centre + hw, spring],
      ];
      for (let j = 1; j <= 16; j++) {
        const x = hw - (j * 2 * hw) / 16;
        outline.push([bay.centre + x, yc + Math.sqrt(radius * radius - x * x)]);
      }
      plane(f, m.trim, outline, [], 0.55);
      plane(f, m.trim, outline, [], 0.81, true);
      const tangent = f.p(1, 0).map((v, j) => v - f.p(0, 0)[j]);
      for (let j = 0; j < outline.length; j++) {
        const a = outline[j],
          b = outline[(j + 1) % outline.length],
          dx = b[0] - a[0],
          dy = b[1] - a[1];
        quad(
          m.cornice,
          [f.p(...a, 0.55), f.p(...a, 0.81), f.p(...b, 0.81), f.p(...b, 0.55)],
          [dy * tangent[0], -dx, dy * tangent[2]],
        );
      }
    }
  }

  const rooftop = facadeFrame(flatRing[0], flatRing[1]);
  const triangle = (material: T.Material, points: Vertex3[]) => {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(points.flat(), 3));
    g.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    const cross = new T.Vector3(...points[1])
      .sub(new T.Vector3(...points[0]))
      .cross(new T.Vector3(...points[2]).sub(new T.Vector3(...points[0])));
    g.setIndex(cross.y >= 0 ? [0, 1, 2] : [0, 2, 1]);
    g.computeVertexNormals();
    mesh.add(g, material);
  };
  // Three small pyramidal rooflights visible in the aerial. Their glazing is
  // closed; dimensions are inferred from roof scale, not an interior model.
  for (const distance of [3.3, 8.1, 12.9]) {
    const u = 2.0,
      half = 0.85,
      base = s.flatRoof + 0.15;
    const corners = [
      rooftop.p(u - half, base, distance - half),
      rooftop.p(u + half, base, distance - half),
      rooftop.p(u + half, base, distance + half),
      rooftop.p(u - half, base, distance + half),
    ];
    const apex = rooftop.p(u, base + 0.62, distance);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      triangle(m.glass, [corners[i], corners[j], apex]);
      mesh.beam(corners[i], corners[j], 0.035, m.frame, 6);
      mesh.beam(corners[i], apex, 0.035, m.frame, 6);
    }
  }
  for (const distance of [3.0, 4.2, 5.4]) {
    const p = rooftop.p(rooftop.length * 0.72, s.flatRoof + 0.24, distance);
    mesh.box(
      p,
      0.7,
      0.48,
      0.7,
      m.trim,
      Math.atan2(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]),
    );
  }
  mesh.finish();
  return true;
}
