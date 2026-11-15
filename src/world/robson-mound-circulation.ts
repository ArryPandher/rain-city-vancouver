import * as T from "three";
import clipping, { type MultiPolygon } from "polygon-clipping";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pointInPoly, segmentPoint, type Point } from "./data";
import { flatPolygon } from "./geometry";
import {
  robsonMoundHeight,
  robsonMoundEdgeDistance,
} from "./robson-mound-site";
import {
  ROBSON_MOUND_CIRCULATION_NODES as nodes,
  ROBSON_MOUND_CIRCULATION_EDGES as edges,
} from "./robson-mound-circulation-data";
const LANDING = 1.15,
  RADIUS = 1.1;
export interface CirculationInterval {
  start: number;
  end: number;
  y0: number;
  y1: number;
}
export const ROBSON_MOUND_FLIGHTS = edges.map((e) => {
  const a = nodes[e.a],
    b = nodes[e.b],
    length = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]),
    dx = (b.p[0] - a.p[0]) / length,
    dz = (b.p[1] - a.p[1]) / length,
    width = e.steps ? 2 : 1.8;
  const point = (s: number, c = 0): Point => [
    a.p[0] + dx * s - dz * c,
    a.p[1] + dz * s + dx * c,
  ];
  const ring = [
    point(0, -width / 2),
    point(length, -width / 2),
    point(length, width / 2),
    point(0, width / 2),
  ];
  const pad = e.trace === 37 ? 0 : LANDING;
  const intervals: CirculationInterval[] = pad
    ? [{ start: 0, end: pad, y0: a.y, y1: a.y }]
    : [];
  const rise = b.y - a.y,
    n = e.steps ? Math.max(1, Math.ceil(Math.abs(rise) / 0.18 - 1e-8)) : 1,
    midLanding = e.steps && length > 8 && Math.abs(rise) > 2 ? 1 : 0;
  const run = (length - 2 * pad - midLanding) / n;
  let start = pad;
  for (let i = 0; i < n; i++) {
    const y = e.steps ? a.y + (rise * (i + 1)) / n : a.y,
      next = e.steps ? y : b.y;
    intervals.push({ start, end: start + run, y0: y, y1: next });
    start += run;
    if (midLanding && i === Math.floor(n / 2) - 1) {
      intervals.push({ start, end: start + midLanding, y0: y, y1: y });
      start += midLanding;
    }
  }
  if (pad)
    intervals.push({ start: length - pad, end: length, y0: b.y, y1: b.y });
  return { ...e, aNode: a, bNode: b, length, width, point, ring, intervals };
});
const circles = nodes.map((n) =>
  Array.from(
    { length: 16 },
    (_, i) =>
      [
        n.p[0] + Math.cos((i * Math.PI) / 8) * RADIUS,
        n.p[1] + Math.sin((i * Math.PI) / 8) * RADIUS,
      ] as Point,
  ),
);
interface Region {
  polygons: MultiPolygon;
  height: (x: number, z: number) => number;
  owner: string;
  bounds: number[];
}
/** Disjoint planar ownership is authoritative for both geometry and height.
 * A joint landing owns its area before adjacent flight strips are partitioned. */
export const ROBSON_MOUND_CIRCULATION_REGIONS: Region[] = [];
let occupied: MultiPolygon = [];
function region(r: Point[], height: Region["height"], owner: string) {
  if (r[0][0] !== r.at(-1)![0] || r[0][1] !== r.at(-1)![1]) r = [...r, r[0]];
  const polygons = occupied.length
    ? clipping.difference([r], occupied)
    : ([[r]] as MultiPolygon);
  if (!polygons.length) return;
  const pts = polygons.flat(2);
  ROBSON_MOUND_CIRCULATION_REGIONS.push({
    polygons,
    height,
    owner,
    bounds: [
      Math.min(...pts.map((p) => p[0])),
      Math.max(...pts.map((p) => p[0])),
      Math.min(...pts.map((p) => p[1])),
      Math.max(...pts.map((p) => p[1])),
    ],
  });
  occupied = occupied.length ? clipping.union(occupied, [r]) : [[[...r, r[0]]]];
}
const externalLandingFlights = ROBSON_MOUND_FLIGHTS.filter(
  (f) => f.trace === 37,
);
// The short exit uses its complete tagged run; landings lie on the adjoining
// footway before/after it. Never cover its treads with a circular node slab.
circles.forEach((r, i) => {
  const pieces = clipping.difference(
    [r],
    ...externalLandingFlights.map((f) => [f.ring]),
  );
  for (const poly of pieces) region(poly[0], () => nodes[i].y, `landing-${i}`);
});
ROBSON_MOUND_FLIGHTS.forEach((f, j) =>
  f.intervals.forEach((i, k) =>
    region(
      [
        f.point(i.start, -f.width / 2),
        f.point(i.end, -f.width / 2),
        f.point(i.end, f.width / 2),
        f.point(i.start, f.width / 2),
      ],
      (x, z) => {
        const s =
          ((x - f.aNode.p[0]) * (f.bNode.p[0] - f.aNode.p[0]) +
            (z - f.aNode.p[1]) * (f.bNode.p[1] - f.aNode.p[1])) /
          f.length;
        return (
          i.y0 +
          (i.y1 - i.y0) *
            Math.max(0, Math.min(1, (s - i.start) / (i.end - i.start)))
        );
      },
      `flight-${j}-${k}`,
    ),
  ),
);
export const ROBSON_MOUND_CIRCULATION_POLYGONS = occupied;
const circulationBounds = [
  Math.min(...ROBSON_MOUND_CIRCULATION_REGIONS.map((r) => r.bounds[0])),
  Math.max(...ROBSON_MOUND_CIRCULATION_REGIONS.map((r) => r.bounds[1])),
  Math.min(...ROBSON_MOUND_CIRCULATION_REGIONS.map((r) => r.bounds[2])),
  Math.max(...ROBSON_MOUND_CIRCULATION_REGIONS.map((r) => r.bounds[3])),
];
const outsideBounds = (x: number, z: number, padding = 0) =>
  x < circulationBounds[0] - padding ||
  x > circulationBounds[1] + padding ||
  z < circulationBounds[2] - padding ||
  z > circulationBounds[3] + padding;
const boundary = (x: number, z: number, r: Point[]) =>
  r.some(
    (a, i) =>
      i < r.length - 1 && segmentPoint(x, z, ...a, ...r[i + 1]).d < 1e-6,
  );
function inside(x: number, z: number, poly: Point[][]) {
  return (
    (pointInPoly(x, z, poly[0].flat()) || boundary(x, z, poly[0])) &&
    !poly
      .slice(1)
      .some((r) => pointInPoly(x, z, r.flat()) && !boundary(x, z, r))
  );
}
export function robsonMoundCirculationHeight(
  x: number,
  z: number,
): number | undefined {
  if (outsideBounds(x, z, 1e-6)) return undefined;
  let height: number | undefined;
  for (const r of ROBSON_MOUND_CIRCULATION_REGIONS) {
    const b = r.bounds;
    if (
      x < b[0] - 1e-6 ||
      x > b[1] + 1e-6 ||
      z < b[2] - 1e-6 ||
      z > b[3] + 1e-6
    )
      continue;
    if (r.polygons.some((p) => inside(x, z, p)))
      height = Math.max(height ?? -Infinity, r.height(x, z));
  }
  return height;
}
/** Smooth tread-free path envelope for soil shoulders. */
export function robsonMoundPathEnvelope(
  f: (typeof ROBSON_MOUND_FLIGHTS)[number],
  s: number,
) {
  let previous = f.aNode.y;
  for (const i of f.intervals) {
    if (s <= i.end) {
      const t = Math.max(0, Math.min(1, (s - i.start) / (i.end - i.start)));
      return f.steps
        ? previous + (i.y1 - previous) * t
        : i.y0 + (i.y1 - i.y0) * t;
    }
    previous = i.y1;
  }
  return f.bNode.y;
}
export const ROBSON_MOUND_SOIL_SHOULDER = 4.8;
export const ROBSON_MOUND_SOIL_MAX = 4.6;
/** Recontour only soil near mapped paths; no trench wall protects the old
 * guessed contour. The broad 4.6 m target is a visual-fit estimate: published
 * plaza-relative heights do not establish the upper-ground datum. */
export function robsonMoundCirculationTerrainHeight(x: number, z: number) {
  const normalized = robsonMoundHeight(x, z);
  if (normalized === undefined) return;
  const original = (normalized / 7.62) * ROBSON_MOUND_SOIL_MAX;
  let closest = Infinity,
    sum = 0,
    weighted = 0;
  for (const f of ROBSON_MOUND_FLIGHTS) {
    const q = segmentPoint(x, z, ...f.aNode.p, ...f.bNode.p),
      d = Math.max(0, q.d - f.width / 2),
      s = Math.max(
        0,
        Math.min(
          f.length,
          ((x - f.aNode.p[0]) * (f.bNode.p[0] - f.aNode.p[0]) +
            (z - f.aNode.p[1]) * (f.bNode.p[1] - f.aNode.p[1])) /
            f.length,
        ),
      );
    if (d >= ROBSON_MOUND_SOIL_SHOULDER) continue;
    const y = robsonMoundPathEnvelope(f, s);
    closest = Math.min(closest, d);
    // Compact continuous weights avoid a nearest-path switch at junctions.
    const w =
      (1 - d / ROBSON_MOUND_SOIL_SHOULDER) ** 2 / Math.max(0.005, d) ** 6;
    sum += w;
    weighted += w * y;
  }
  let result = original;
  if (sum) {
    const t = Math.min(1, closest / ROBSON_MOUND_SOIL_SHOULDER),
      blend = t * t * (3 - 2 * t),
      target = weighted / sum;
    const edge = Math.min(1, robsonMoundEdgeDistance(x, z) / 0.8),
      edgeBlend = edge * edge * (3 - 2 * edge);
    result = original + (target - original) * (1 - blend) * edgeBlend;
  }
  return Math.min(ROBSON_MOUND_SOIL_MAX, Math.max(0, result));
}
/** Finite source-earth/path boundary, not a collider across a walking route. */
export const ROBSON_MOUND_RETAINING_EDGES = occupied.flatMap((poly) =>
  poly.flatMap((ring) =>
    ring.slice(0, -1).flatMap((a, i) => {
      const b = ring[i + 1],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3),
        result: {
          a: Point;
          b: Point;
          low: number;
          high: number;
          highA: number;
          highB: number;
        }[] = [];
      for (let j = 0; j < n; j++) {
        const p: Point = [
            a[0] + ((b[0] - a[0]) * j) / n,
            a[1] + ((b[1] - a[1]) * j) / n,
          ],
          q: Point = [
            a[0] + ((b[0] - a[0]) * (j + 1)) / n,
            a[1] + ((b[1] - a[1]) * (j + 1)) / n,
          ],
          x = (p[0] + q[0]) / 2,
          z = (p[1] + q[1]) / 2,
          y = robsonMoundCirculationHeight(x, z);
        if (y === undefined) continue;
        const old = robsonMoundCirculationTerrainHeight(x, z) ?? 0,
          highA = Math.max(
            robsonMoundCirculationHeight(...p) ?? y,
            robsonMoundCirculationTerrainHeight(...p) ?? 0,
          ),
          highB = Math.max(
            robsonMoundCirculationHeight(...q) ?? y,
            robsonMoundCirculationTerrainHeight(...q) ?? 0,
          );
        result.push({
          a: p,
          b: q,
          low: Math.min(y, old),
          high: Math.max(y, old, highA, highB),
          highA,
          highB,
        });
      }
      return result;
    }),
  ),
);
export function robsonMoundCirculationBlocked(
  x: number,
  z: number,
  r: number,
  y: number,
  camera = false,
) {
  if (!Number.isFinite(y) || outsideBounds(x, z, r + 0.035)) return false;
  return ROBSON_MOUND_RETAINING_EDGES.some(
    (e) =>
      e.high - e.low > 0.35 &&
      y >= e.low - (camera ? r : 0.25) &&
      y <= e.high + (camera ? r : 0.25) &&
      segmentPoint(x, z, ...e.a, ...e.b).d < r + 0.035,
  );
}
export function createRobsonMoundCirculationGeometry() {
  const pieces: T.BufferGeometry[] = [];
  const quad = (p: number[], n: T.Vector3) => {
    const a = new T.Vector3(...p.slice(0, 3)),
      cross = new T.Vector3(...p.slice(3, 6))
        .sub(a)
        .cross(new T.Vector3(...p.slice(6, 9)).sub(a));
    if (cross.dot(n) < 0)
      p = [
        ...p.slice(0, 3),
        ...p.slice(9, 12),
        ...p.slice(6, 9),
        ...p.slice(3, 6),
      ];
    const w = new T.Vector3(...p.slice(0, 3)).distanceTo(
        new T.Vector3(...p.slice(3, 6)),
      ),
      h = new T.Vector3(...p.slice(0, 3)).distanceTo(
        new T.Vector3(...p.slice(9, 12)),
      );
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, w, 0, w, h, 0, h], 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    pieces.push(g);
  };
  for (const r of ROBSON_MOUND_CIRCULATION_REGIONS)
    for (const poly of r.polygons) {
      const top = flatPolygon(
          poly[0].flat(),
          poly.slice(1).map((r) => r.flat()),
          0,
          1,
        ),
        p = top.getAttribute("position");
      for (let i = 0; i < p.count; i++)
        p.setY(i, r.height(p.getX(i), p.getZ(i)));
      top.computeVertexNormals();
      pieces.push(top);
      const bottom = flatPolygon(
          poly[0].flat(),
          poly.slice(1).map((r) => r.flat()),
          -0.18,
          1,
        ),
        ix = bottom.index!;
      for (let i = 0; i < ix.count; i += 3) {
        const a = ix.getX(i);
        ix.setX(i, ix.getX(i + 2));
        ix.setX(i + 2, a);
      }
      bottom.computeVertexNormals();
      pieces.push(bottom);
      for (const ring of poly)
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i],
            b = ring[i + 1];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5) continue;
          quad(
            [
              a[0],
              -0.18,
              a[1],
              b[0],
              -0.18,
              b[1],
              b[0],
              r.height(...b),
              b[1],
              a[0],
              r.height(...a),
              a[1],
            ],
            new T.Vector3(b[1] - a[1], 0, a[0] - b[0]),
          );
        }
    }
  for (const e of ROBSON_MOUND_RETAINING_EDGES) {
    if (e.high - e.low < 0.04) continue;
    const n = new T.Vector3(e.b[1] - e.a[1], 0, e.a[0] - e.b[0]).normalize(),
      p = [
        e.a[0],
        -0.18,
        e.a[1],
        e.b[0],
        -0.18,
        e.b[1],
        e.b[0],
        e.highB,
        e.b[1],
        e.a[0],
        e.highA,
        e.a[1],
      ];
    quad(p, n);
    quad(p, n.negate());
  }
  const merged = mergeGeometries(pieces, false)!;
  pieces.forEach((g) => g.dispose());
  return merged;
}
/** Clip old terrain and generic ribbons BEFORE fitting them to a discontinuous
 * stair sampler. Barycentric interpolation preserves original UVs and normals. */
export function clipRobsonMoundCirculation(
  g: T.BufferGeometry,
  height?: (x: number, z: number) => number,
  offset = 0,
) {
  const p = g.getAttribute("position"),
    uv = g.getAttribute("uv"),
    norm = g.getAttribute("normal"),
    ix = g.index,
    position: number[] = [],
    tex: number[] = [],
    normal: number[] = [];
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j)),
      a = ids.map((j) => [p.getX(j), p.getZ(j)] as Point),
      den =
        (a[1][1] - a[2][1]) * (a[0][0] - a[2][0]) +
        (a[2][0] - a[1][0]) * (a[0][1] - a[2][1]);
    if (Math.abs(den) < 1e-10) continue;
    const pieces = clipping.difference([a], ROBSON_MOUND_CIRCULATION_POLYGONS);
    for (const poly of pieces) {
      const t = flatPolygon(
          poly[0].slice(0, -1).flat(),
          poly.slice(1).map((r) => r.slice(0, -1).flat()),
          0,
          1,
        ),
        tp = t.getAttribute("position"),
        ti = t.index!;
      for (let k = 0; k < ti.count; k++) {
        const v = ti.getX(k),
          x = tp.getX(v),
          z = tp.getZ(v),
          w0 =
            ((a[1][1] - a[2][1]) * (x - a[2][0]) +
              (a[2][0] - a[1][0]) * (z - a[2][1])) /
            den,
          w1 =
            ((a[2][1] - a[0][1]) * (x - a[2][0]) +
              (a[0][0] - a[2][0]) * (z - a[2][1])) /
            den,
          w = [w0, w1, 1 - w0 - w1];
        position.push(
          x,
          height
            ? height(x, z) + offset
            : w.reduce((s, v, j) => s + v * p.getY(ids[j]), 0),
          z,
        );
        tex.push(
          ...[0, 1].map((c) =>
            w.reduce(
              (s, v, j) =>
                s + v * (uv ? (c ? uv.getY(ids[j]) : uv.getX(ids[j])) : 0),
              0,
            ),
          ),
        );
        const n = new T.Vector3(
          ...([0, 1, 2].map((c) =>
            w.reduce(
              (s, v, j) =>
                s +
                v *
                  (norm
                    ? [norm.getX(ids[j]), norm.getY(ids[j]), norm.getZ(ids[j])][
                        c
                      ]
                    : c === 1
                      ? 1
                      : 0),
              0,
            ),
          ) as [number, number, number]),
        ).normalize();
        normal.push(...n.toArray());
      }
      t.dispose();
    }
  }
  const result = new T.BufferGeometry();
  result.setAttribute("position", new T.Float32BufferAttribute(position, 3));
  result.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
  result.setAttribute("normal", new T.Float32BufferAttribute(normal, 3));
  g.dispose();
  return result;
}
