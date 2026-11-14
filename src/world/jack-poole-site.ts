import Delaunator from "delaunator";
import { pointInPoly, segmentPoint, type Point } from "./data";
import { pathRectangle } from "./prospect-lookout-site";
import map from "./jack-poole-map.json";

export const JACK_LEVEL = 12.04;
export const JACK_SEAWALL = 6.04;
export const CACTUS_ROOF = 17.82;
export const CACTUS_ID = "w89118744";
export const JACK_POOL = map.ways.w1070091596.pts.slice(0, -2);
export const JACK_CAULDRON = map.nodes.n648735254.point;
export const JACK_ORCA = map.nodes.n2322709550.point;
export const CACTUS_OUTLINE = map.ways.w89118744.pts.slice(0, -2);
export const JACK_UPPER = [
  91, -681, 137, -649, 177, -669, 254, -748, 237, -758, 168, -786, 157, -768,
  140, -707, 127, -700, 91, -697,
];
const coast: Point[] = [];
for (let i = 20; i < 60; i += 2)
  coast.push([map.ways.w1216968927.pts[i], map.ways.w1216968927.pts[i + 1]]);
coast.reverse();
export const JACK_COAST = coast;
// Preserve the existing elevation controls while handing the western park
// apron to the more detailed Harbour Green surface.
const JACK_TERRAIN_BOUNDARY = [
  ...coast.flat(),
  268,
  -756,
  177,
  -669,
  280,
  -595,
  180,
  -500,
  30,
  -500,
  -20,
  -575,
  -100,
  -690,
];
export const JACK_BOUNDARY = [
  ...coast.slice(3).flat(),
  268,
  -756,
  177,
  -669,
  280,
  -595,
  180,
  -500,
  30,
  -500,
  -20,
  -575,
  12,
  -690,
  35,
  -748,
];
export type PlazaSurface = {
  id: string;
  pts: number[];
  height: (x: number, z: number) => number;
  kind: "paving" | "ramp" | "stair" | "roof";
  steps?: number;
  a?: Point;
  b?: Point;
  width?: number;
  low?: number;
  high?: number;
};
const constant = (y: number) => () => y;
const points = (p: number[]): Point[] =>
  Array.from({ length: p.length / 2 }, (_, i) => [p[i * 2], p[i * 2 + 1]]);
const mapped = (id: keyof typeof map.ways) => points(map.ways[id].pts);
function strip(
  id: string,
  a: Point,
  b: Point,
  y0: number,
  y1: number,
  width: number,
  kind: "ramp" | "stair",
  steps?: number,
): PlazaSurface {
  return {
    id,
    pts: pathRectangle(a, b, width),
    a,
    b,
    width,
    low: y0,
    high: y1,
    kind,
    steps,
    height: (x, z) => {
      const t = segmentPoint(x, z, ...a, ...b).t;
      if (!steps) return y0 + (y1 - y0) * t;
      // First tread starts one riser from the upper landing; ascending flights use floor.
      const n = Math.min(
        steps,
        Math.max(
          0,
          y1 < y0 ? Math.floor(t * steps) + 1 : Math.floor(t * steps),
        ),
      );
      return y0 + ((y1 - y0) * n) / steps;
    },
  };
}
function path(
  id: keyof typeof map.ways,
  y0: number,
  y1: number,
  width: number,
  kind: "ramp" | "stair",
  steps?: number,
  plateauIndex?: number,
) {
  const p = mapped(id);
  if (id === "w223634905") {
    const a = p.at(-2)!,
      b = p.at(-1)!,
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    p[p.length - 1] = [
      b[0] - ((b[0] - a[0]) * 3) / len,
      b[1] - ((b[1] - a[1]) * 3) / len,
    ];
  }
  const lengths = p
      .slice(1)
      .map((b, i) => Math.hypot(b[0] - p[i][0], b[1] - p[i][1])),
    length = (plateauIndex ? lengths.slice(0, plateauIndex) : lengths).reduce(
      (a, b) => a + b,
      0,
    );
  let d = 0,
    used = 0;
  return lengths.map((l, i) => {
    const start = Math.min(1, d / length);
    d += l;
    const end = Math.min(1, d / length),
      n = steps
        ? i === lengths.length - 1
          ? steps - used
          : Math.max(1, Math.round((l / length) * steps))
        : undefined;
    if (n) used += n;
    return strip(
      id + ":" + i,
      p[i],
      p[i + 1],
      y0 + (y1 - y0) * start,
      y0 + (y1 - y0) * end,
      width,
      kind,
      n,
    );
  });
}
export const JACK_FLIGHTS = [
  ...path("w159354908", JACK_LEVEL, JACK_SEAWALL, 7.6, "stair", 36),
  ...path("w159354910", JACK_LEVEL, JACK_SEAWALL, 9, "stair", 30),
  ...path("w358443046", 7.54, JACK_LEVEL, 4, "stair", 30),
  ...path("w223634905", CACTUS_ROOF, JACK_LEVEL, 2.5, "stair", 34),
  ...path("w223634907", JACK_LEVEL, CACTUS_ROOF, 2.3, "stair", 39),
];
export const JACK_RAMPS = [
  ...path("w89118741", 7.54, JACK_LEVEL, 4.5, "ramp", undefined, 3),
  ...path("w119945024", 7.54, JACK_SEAWALL, 4, "ramp"),
];
const lowerRoofFlight = JACK_FLIGHTS.filter((s) =>
  s.id.startsWith("w223634905"),
).at(-1)!;
const roofLanding: PlazaSurface = {
  id: "cactus-stair-landing",
  pts: pathRectangle(lowerRoofFlight.b!, mapped("w223634905").at(-1)!, 2.5),
  height: constant(JACK_LEVEL),
  kind: "paving",
};
const rooftop: PlazaSurface = {
  id: "cactus-roof",
  pts: CACTUS_OUTLINE,
  height: constant(CACTUS_ROOF),
  kind: "roof",
};
const roofWalks: PlazaSurface[] = [
  "w223634906",
  "w223634908",
  "w223634910",
].flatMap((id) => {
  const p = mapped(id as keyof typeof map.ways);
  return p.slice(1).map((b, i) => ({
    id: id + ":" + i,
    pts: pathRectangle(p[i], b, 3),
    height: constant(CACTUS_ROOF),
    kind: "roof" as const,
  }));
});
const upper: PlazaSurface = {
  id: "upper-plaza",
  pts: JACK_UPPER,
  height: constant(JACK_LEVEL),
  kind: "paving",
};
export const JACK_SURFACES: PlazaSurface[] = [
  ...JACK_FLIGHTS,
  ...JACK_RAMPS,
  roofLanding,
  rooftop,
  ...roofWalks,
  upper,
];
export const JACK_CUSTOM_ROADS = new Set(
  [...JACK_FLIGHTS, ...JACK_RAMPS, ...roofWalks].map((s) => s.id.split(":")[0]),
);
export function jackContains(x: number, z: number) {
  return (
    x >= -100 &&
    x <= 280 &&
    z >= -835 &&
    z <= -500 &&
    pointInPoly(x, z, JACK_BOUNDARY)
  );
}
export function jackIntersects(p: number[]) {
  return p.some(
    (x, i) =>
      i % 2 === 0 &&
      x >= -110 &&
      x <= 290 &&
      p[i + 1] >= -840 &&
      p[i + 1] <= -490,
  );
}
export function jackSurface(x: number, z: number) {
  return JACK_SURFACES.find((s) => pointInPoly(x, z, s.pts));
}
// Interpreted vertical relationships follow mapped steps and the architect's
// section. They are not surveyed absolute elevations. Coast/approach controls
// blend the construction into the existing city without a perimeter cliff.
export type JackTriangle = {
  p: [Point, Point, Point];
  h: [number, number, number];
  normals?: number[][];
};
const controls: number[][] = [];
const add = (x: number, z: number, y: number) => {
  const p = controls.find((p) => Math.hypot(p[0] - x, p[1] - z) < 0.08);
  if (p) {
    p[2] = y;
    return;
  }
  controls.push([x, z, y]);
};
const coastHeight = (x: number) =>
  0.12 + (JACK_SEAWALL - 0.12) * Math.max(0, Math.min(1, (x - 75) / 100));
for (let i = 0; i < JACK_TERRAIN_BOUNDARY.length; i += 2) {
  const x = JACK_TERRAIN_BOUNDARY[i],
    z = JACK_TERRAIN_BOUNDARY[i + 1];
  const isCoast = i < coast.length * 2;
  add(x, z, isCoast ? coastHeight(x) : 0);
}
for (const [x, z, y] of [
  [64, -596, 6],
  [124, -645, JACK_LEVEL],
  [137, -649, JACK_LEVEL],
  [90, -681, JACK_LEVEL],
  [78.64, -690.78, 7.54],
  [51.6, -739.53, 0.12],
  [89.72, -708.82, 7.54],
  [175, -800.92, JACK_SEAWALL],
  [256.96, -764.61, JACK_SEAWALL],
  [170.45, -819.57, JACK_SEAWALL],
  [193.3, -792.44, JACK_SEAWALL],
  [236.4, -775.84, JACK_SEAWALL],
])
  add(x, z, y);
for (const s of [
  upper,
  ...JACK_RAMPS,
  ...JACK_FLIGHTS.filter((f) => !f.id.startsWith("w223")),
]) {
  const p = points(s.pts);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
    for (let j = 0; j < n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n;
      add(x, z, s.height(x, z));
    }
  }
}
const del = Delaunator.from(controls);
export const JACK_TRIANGLES: JackTriangle[] = [];
for (let i = 0; i < del.triangles.length; i += 3) {
  const v = [0, 1, 2].map((j) => controls[del.triangles[i + j]]);
  JACK_TRIANGLES.push({
    p: v.map((p) => [p[0], p[1]]) as JackTriangle["p"],
    h: v.map((p) => p[2]) as JackTriangle["h"],
  });
}
// Area-weighted shared normals remove triangulation seams on continuous banks.
const vertexNormals = new Map<string, number[]>();
for (const t of JACK_TRIANGLES) {
  const a = [t.p[1][0] - t.p[0][0], t.h[1] - t.h[0], t.p[1][1] - t.p[0][1]],
    b = [t.p[2][0] - t.p[0][0], t.h[2] - t.h[0], t.p[2][1] - t.p[0][1]];
  const n = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  if (n[1] < 0) for (let i = 0; i < 3; i++) n[i] *= -1;
  for (const p of t.p) {
    const key = p.join(","),
      sum = vertexNormals.get(key) ?? [0, 0, 0];
    for (let i = 0; i < 3; i++) sum[i] += n[i];
    vertexNormals.set(key, sum);
  }
}
for (const t of JACK_TRIANGLES)
  t.normals = t.p.map((p) => {
    const n = vertexNormals.get(p.join(","))!,
      len = Math.hypot(...n);
    return n.map((v) => v / len);
  });
export function jackTriangleNormal(t: JackTriangle, x: number, z: number) {
  const { weights } = jackTriangleHeight(t, x, z),
    n = [0, 1, 2].map((axis) =>
      weights.reduce((v, w, i) => v + w * t.normals![i][axis], 0),
    ),
    length = Math.hypot(...n);
  return n.map((v) => v / length);
}
export function jackTriangleHeight(t: JackTriangle, x: number, z: number) {
  const [a, b, c] = t.p,
    det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]),
    u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / det,
    v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / det;
  return {
    weights: [u, v, 1 - u - v],
    inside: u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6,
    height: u * t.h[0] + v * t.h[1] + (1 - u - v) * t.h[2],
  };
}
const cells = new Map<string, JackTriangle[]>();
for (const t of JACK_TRIANGLES) {
  const xs = t.p.map((p) => p[0]),
    zs = t.p.map((p) => p[1]);
  for (
    let x = Math.floor(Math.min(...xs) / 20);
    x <= Math.floor(Math.max(...xs) / 20);
    x++
  )
    for (
      let z = Math.floor(Math.min(...zs) / 20);
      z <= Math.floor(Math.max(...zs) / 20);
      z++
    ) {
      const k = x + "," + z;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k)!.push(t);
    }
}
export function jackBaseHeight(x: number, z: number) {
  for (const t of cells.get(Math.floor(x / 20) + "," + Math.floor(z / 20)) ??
    []) {
    const h = jackTriangleHeight(t, x, z);
    if (h.inside) return h.height;
  }
  return 0;
}
export function jackGroundHeight(x: number, z: number) {
  if (!jackContains(x, z)) return;
  return jackSurface(x, z)?.height(x, z) ?? jackBaseHeight(x, z);
}
export function jackRoofAccess(x: number, z: number, y: number) {
  const s = jackSurface(x, z);
  return (
    !!s &&
    (s.kind === "roof" || s.id.startsWith("w223")) &&
    y >= s.height(x, z) - 0.4
  );
}
