import Delaunator from "delaunator";
import map from "./harbour-green-map.json";
import { pointInPoly, segmentPoint, type Point } from "./data";
import { pathRectangle } from "./prospect-lookout-site";
import {
  JACK_BOUNDARY,
  jackContains,
  jackBaseHeight,
  jackTriangleHeight,
  type JackTriangle,
} from "./jack-poole-site";
export const harbourWays = map.ways as unknown as Record<
  string,
  { pts: Point[]; tags: Record<string, string> }
>;
export const HARBOUR_PARK = harbourWays.w37057434.pts.slice(0, -1).flat();
export const HARBOUR_POOL = harbourWays.w223936055.pts.slice(0, -1).flat();
export const HARBOUR_POOL_LEVEL = 1.55;
export const HARBOUR_COAST: Point[] = [
  ...harbourWays.w591277605.pts.slice(0, 8).reverse(),
  ...harbourWays.w1216968927.pts.slice(26, -1).reverse(),
];
// The southern apron lets the interpreted park grades meet the existing city
// continuously. This is a game datum, not a surveyed elevation dataset.
export const HARBOUR_BOUNDARY = [
  ...HARBOUR_COAST.flat(),
  82,
  -738,
  82,
  -660,
  5,
  -608,
  -115,
  -610,
  -205,
  -650,
  -285,
  -730,
  -342,
  -818,
  -291.22,
  -877.51,
];
export function harbourContains(x: number, z: number) {
  return (
    x >= -343 &&
    x <= 83 &&
    z >= -936 &&
    z <= -607 &&
    !jackContains(x, z) &&
    pointInPoly(x, z, HARBOUR_BOUNDARY)
  );
}
export function harbourIntersects(p: number[]) {
  return p.some(
    (x, i) =>
      !(i % 2) && x > -350 && x < 90 && p[i + 1] > -945 && p[i + 1] < -600,
  );
}
export function pathDistance(x: number, z: number, p: Point[]) {
  let d = Infinity,
    t = 0,
    index = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const q = segmentPoint(x, z, ...p[i], ...p[i + 1]);
    if (q.d < d) {
      d = q.d;
      t = q.t;
      index = i;
    }
  }
  return { d, t, index };
}
export const HARBOUR_CYCLE = harbourWays.w85240509.pts;
export const HARBOUR_UPPER = harbourWays.w85240514.pts;
export type HarbourFlight = {
  id: string;
  a: Point;
  b: Point;
  low: number;
  high: number;
  steps: number;
  width: number;
  pts: number[];
};
const flight = (
  id: string,
  a: Point,
  b: Point,
  low: number,
  high: number,
  steps: number,
  width: number,
): HarbourFlight => ({
  id,
  a,
  b,
  low,
  high,
  steps,
  width,
  pts: pathRectangle(a, b, width),
});
const stairCentre = harbourWays.w48271068.pts[1];
const towards = (p: Point): Point => {
  const dx = p[0] - stairCentre[0],
    dz = p[1] - stairCentre[1],
    l = Math.hypot(dx, dz);
  return [stairCentre[0] + (dx / l) * 1.4, stairCentre[1] + (dz / l) * 1.4];
};
const lowerLanding = towards(harbourWays.w48271068.pts[0]),
  upperLanding = towards(harbourWays.w48271068.pts[2]);
export const HARBOUR_LANDING = {
  pts: pathRectangle(lowerLanding, upperLanding, 10),
  height: 3.08,
};
export const HARBOUR_FLIGHTS: HarbourFlight[] = [
  flight(
    "w48271068:0",
    harbourWays.w48271068.pts[0],
    lowerLanding,
    1.55,
    3.08,
    9,
    10,
  ),
  flight(
    "w48271068:1",
    upperLanding,
    harbourWays.w48271068.pts[2],
    3.08,
    6.14,
    18,
    10,
  ),
  ...[
    "w48271064",
    "w85240510",
    "w85240512",
    "w85240518",
    "w85240521",
    "w85240526",
  ].map((id) => {
    const w = harbourWays[id],
      up = w.tags.incline === "up";
    return flight(
      id,
      w.pts[0],
      w.pts.at(-1)!,
      up ? 1.04 : 1.55,
      up ? 1.55 : 1.04,
      3,
      3.6,
    );
  }),
];
export const HARBOUR_CUSTOM_ROADS = new Set(
  HARBOUR_FLIGHTS.map((f) => f.id.split(":")[0]),
);
export function harbourFlightHeight(f: HarbourFlight, x: number, z: number) {
  const t = segmentPoint(x, z, ...f.a, ...f.b).t;
  const n = Math.min(
    f.steps,
    Math.max(
      0,
      f.high < f.low ? Math.floor(t * f.steps) + 1 : Math.floor(t * f.steps),
    ),
  );
  return f.low + ((f.high - f.low) * n) / f.steps;
}
export const harbourPaths = Object.entries(harbourWays)
  .filter(
    ([id, w]) =>
      ["footway", "cycleway"].includes(w.tags.highway) &&
      !HARBOUR_CUSTOM_ROADS.has(id) &&
      w.tags.area !== "yes",
  )
  .map(([id, w]) => ({
    id,
    pts: w.pts,
    width:
      id === "w85240514"
        ? 4.8
        : id === "w85240509"
          ? 2.8
          : id === "w85240508"
            ? 3.6
            : 2.4,
    kind:
      w.tags.highway === "cycleway"
        ? "cycle"
        : w.tags.surface === "dirt"
          ? "dirt"
          : "paving",
  }));
export function harbourClearGround(x: number, z: number) {
  return (
    harbourContains(x, z) &&
    (pointInPoly(x, z, HARBOUR_POOL) ||
      pointInPoly(x, z, HARBOUR_LANDING.pts) ||
      HARBOUR_FLIGHTS.some((f) => pointInPoly(x, z, f.pts)) ||
      harbourPaths.some(
        (p) => pathDistance(x, z, p.pts).d < p.width / 2 + 0.38,
      ))
  );
}
export function fountainWorld(u: number, v: number): Point {
  const l = Math.hypot(12.06, 6.61),
    ux = 12.06 / l,
    uz = 6.61 / l;
  return [-105.02 + u * ux + v * uz, -771.08 + u * uz - v * ux];
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function seedHeight(x: number, z: number) {
  const coast = pathDistance(x, z, HARBOUR_COAST).d,
    cycle = pathDistance(x, z, HARBOUR_CYCLE).d,
    upper = pathDistance(x, z, HARBOUR_UPPER).d;
  const inPark = pointInPoly(x, z, HARBOUR_PARK);
  const parkRing = harbourWays.w37057434.pts;
  const parkEdge = pathDistance(x, z, parkRing).d;
  const landwardEdge = Array.from(
    { length: HARBOUR_BOUNDARY.length / 2 - HARBOUR_COAST.length + 1 },
    (_, i) => {
      const j = (i + HARBOUR_COAST.length - 1) * 2;
      return [HARBOUR_BOUNDARY[j], HARBOUR_BOUNDARY[j + 1]] as Point;
    },
  );
  const apronDepth = pathDistance(x, z, landwardEdge).d;
  const parkGrade = 1.55 + (4.59 * cycle) / (cycle + upper + 0.001);
  // The mapped park edge is a land-use boundary, not a retaining wall. Extend
  // its grade across the landward apron to the city datum. The former separate
  // outside formula jumped roughly four metres at the Cordova frontage.
  let y = inPark
    ? parkGrade
    : coast < cycle + 3
      ? 1.04
      : (parkGrade * apronDepth) / (apronDepth + parkEdge + 0.001);
  if (inPark && cycle > 5 && upper > 5)
    y +=
      0.8 *
      Math.sin(Math.PI * clamp(cycle / (cycle + upper))) *
      clamp(parkEdge / 12);
  if (coast < 10) y = 1.04 + 0.51 * clamp(coast / 10);
  // The western tip is a shared cycle/upper-path entrance, not a six-metre ridge.
  if (x < -225) y = 1.55 + (y - 1.55) * clamp((x + 274) / 49);
  // Match the already authored Convention Centre approach at the eastern edge.
  if (x > -40) {
    const t = clamp((x + 40) / 70);
    y = y * (1 - t) + jackBaseHeight(x, z) * t;
  }
  return y;
}
const corridors: {
  pts: Point[];
  width: number;
  height: (x: number, z: number) => number;
}[] = [];
const controls: number[][] = [];
const slots = new Map<string, number>();
function add(x: number, z: number, y: number) {
  const key = x.toFixed(4) + "," + z.toFixed(4),
    i = slots.get(key);
  if (i !== undefined) {
    controls[i][2] = y;
    return;
  }
  slots.set(key, controls.length);
  controls.push([x, z, y]);
}
for (let x = -343; x < 84; x += 4)
  for (let z = -936; z < -607; z += 4)
    if (pointInPoly(x, z, HARBOUR_BOUNDARY)) add(x, z, seedHeight(x, z));
function edgeSamples(
  p: Point[],
  height: (x: number, z: number, i: number, t: number) => number,
  spacing = 2,
) {
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing);
    for (let j = 0; j <= n; j++) {
      const t = j / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      add(x, z, height(x, z, i, t));
    }
  }
}
const boundary = Array.from(
  { length: HARBOUR_BOUNDARY.length / 2 },
  (_, i) => [HARBOUR_BOUNDARY[i * 2], HARBOUR_BOUNDARY[i * 2 + 1]] as Point,
);
edgeSamples(
  [...boundary, boundary[0]],
  (x, z, i) =>
    i < HARBOUR_COAST.length - 1 ? (x > 20 ? jackBaseHeight(x, z) : 1.04) : 0,
  3,
);
edgeSamples(HARBOUR_CYCLE, (x, z) => (x > -40 ? seedHeight(x, z) : 1.55), 3);
edgeSamples(
  HARBOUR_UPPER,
  (x, z) => (x > -40 ? seedHeight(x, z) : 1.55 + 4.59 * clamp((x + 274) / 49)),
  3,
);
edgeSamples(harbourWays.w85240508.pts, () => HARBOUR_POOL_LEVEL, 1);
corridors.push({
  pts: harbourWays.w85240508.pts,
  width: 3.6,
  height: () => HARBOUR_POOL_LEVEL,
});
// The 27-riser central stair and its three connected paths share landing datums.
for (const f of HARBOUR_FLIGHTS) {
  for (const side of [-1, 0, 1]) {
    const dx = f.b[0] - f.a[0],
      dz = f.b[1] - f.a[1],
      l = Math.hypot(dx, dz),
      ox = (((dz / l) * f.width) / 2) * side,
      oz = (((-dx / l) * f.width) / 2) * side;
    edgeSamples(
      [
        [f.a[0] + ox, f.a[1] + oz],
        [f.b[0] + ox, f.b[1] + oz],
      ],
      (_x, _z, _i, t) => f.low + (f.high - f.low) * t,
      1.5,
    );
  }
}
for (const id of ["w1104112434", "w1105669953"]) {
  const source = harbourWays[id].pts,
    p = id === "w1105669953" ? [...source].reverse() : source,
    lengths = p
      .slice(1)
      .map((b, i) => Math.hypot(b[0] - p[i][0], b[1] - p[i][1])),
    total = lengths.reduce((a, b) => a + b, 0),
    end = seedHeight(...p.at(-1)!);
  const height = (x: number, z: number) => {
    const { index: i, t } = pathDistance(x, z, p),
      distance =
        lengths.slice(0, i).reduce((a, b) => a + b, 0) + lengths[i] * t;
    return 3.08 + ((end - 3.08) * distance) / total;
  };
  edgeSamples(p, height, 1);
  corridors.push({ pts: p, width: 2.4, height });
}
edgeSamples(harbourWays.w48271069.pts, () => 6.14, 1);
const pool = Array.from(
  { length: HARBOUR_POOL.length / 2 },
  (_, i) => [HARBOUR_POOL[i * 2], HARBOUR_POOL[i * 2 + 1]] as Point,
);
edgeSamples([...pool, pool[0]], () => HARBOUR_POOL_LEVEL, 1.5);
for (let u = 0; u < 14; u += 2)
  for (let v = 0; v < 22; v += 2) {
    const [x, z] = fountainWorld(u, v);
    if (pointInPoly(x, z, HARBOUR_POOL)) add(x, z, HARBOUR_POOL_LEVEL);
  }
// The wet granite apron includes the fountain notch and the foot of the stairs.
// Keeping this whole platform level avoids a spurious triangular mound between jets.
export const HARBOUR_APRON = [
  [-5, -5],
  [19, -5],
  [19, 38],
  [-5, 38],
].flatMap(([u, v]) => fountainWorld(u, v));
for (const p of controls)
  if (pointInPoly(p[0], p[1], HARBOUR_APRON)) p[2] = HARBOUR_POOL_LEVEL;
for (let u = -5; u <= 19; u += 2)
  for (let v = -5; v <= 38; v += 2) {
    const [x, z] = fountainWorld(u, v);
    if (!HARBOUR_FLIGHTS.some((f) => pointInPoly(x, z, f.pts)))
      add(x, z, HARBOUR_POOL_LEVEL);
  }
// Give the full walking width its intended grade, not just its centreline.
for (const corridor of corridors) {
  const inFlight = (x: number, z: number) =>
    HARBOUR_FLIGHTS.some((f) => pointInPoly(x, z, f.pts));
  for (const p of controls) {
    if (
      inFlight(p[0], p[1]) ||
      pointInPoly(p[0], p[1], HARBOUR_APRON) ||
      corridors.some(
        (q) =>
          q !== corridor &&
          pathDistance(p[0], p[1], q.pts).d < q.width / 2 + 0.6,
      )
    )
      continue;
    const distance = pathDistance(p[0], p[1], corridor.pts).d,
      t = clamp((distance - corridor.width / 2 - 0.6) / 12),
      blend = t * t * (3 - 2 * t),
      target = corridor.height(p[0], p[1]);
    p[2] = target + (p[2] - target) * blend;
  }
  for (let i = 0; i < corridor.pts.length - 1; i++) {
    const a = corridor.pts[i],
      b = corridor.pts[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    for (const side of [-1, 0, 1]) {
      const offset = side * (corridor.width / 2 + 0.3),
        ox = (dz / length) * offset,
        oz = (-dx / length) * offset;
      for (let d = 0; d <= length; d += 0.8) {
        const x = a[0] + (dx * d) / length + ox,
          z = a[1] + (dz * d) / length + oz;
        if (!inFlight(x, z)) add(x, z, corridor.height(x, z));
      }
    }
  }
}
for (let x = stairCentre[0] - 7; x <= stairCentre[0] + 7; x += 0.5)
  for (let z = stairCentre[1] - 7; z <= stairCentre[1] + 7; z += 0.5)
    if (pointInPoly(x, z, HARBOUR_LANDING.pts))
      add(x, z, HARBOUR_LANDING.height);
const landingRing = Array.from(
  { length: HARBOUR_LANDING.pts.length / 2 },
  (_, i) =>
    [HARBOUR_LANDING.pts[i * 2], HARBOUR_LANDING.pts[i * 2 + 1]] as Point,
);
edgeSamples(
  [...landingRing, landingRing[0]],
  () => HARBOUR_LANDING.height,
  0.5,
);
for (const p of controls)
  if (pointInPoly(p[0], p[1], HARBOUR_LANDING.pts))
    p[2] = HARBOUR_LANDING.height;
const jack = Array.from(
  { length: JACK_BOUNDARY.length / 2 },
  (_, i) => [JACK_BOUNDARY[i * 2], JACK_BOUNDARY[i * 2 + 1]] as Point,
);
edgeSamples([...jack, jack[0]], (x, z) => jackBaseHeight(x, z), 2);
// Delaunay edges are unconstrained. Give the shared seam a collar using the
// neighbouring surface, so an upper-path control cannot create a narrow spike.
for (const p of controls)
  if (pathDistance(p[0], p[1], [...jack, jack[0]]).d < 4)
    p[2] = jackBaseHeight(p[0], p[1]);
const westernEdge = boundary.slice(-3);
for (const p of controls)
  if (p[0] < -280)
    p[2] *= pointInPoly(p[0], p[1], HARBOUR_BOUNDARY)
      ? clamp(pathDistance(p[0], p[1], westernEdge).d / 20)
      : 0;
const delaunay = Delaunator.from(controls);
export const HARBOUR_TRIANGLES: JackTriangle[] = [];
for (let i = 0; i < delaunay.triangles.length; i += 3) {
  const q = [0, 1, 2].map((j) => controls[delaunay.triangles[i + j]]);
  HARBOUR_TRIANGLES.push({
    p: q.map((p) => [p[0], p[1]]) as JackTriangle["p"],
    h: q.map((p) => p[2]) as JackTriangle["h"],
  });
}
const cells = new Map<string, JackTriangle[]>();
for (const t of HARBOUR_TRIANGLES) {
  const xs = t.p.map((p) => p[0]),
    zs = t.p.map((p) => p[1]);
  for (
    let x = Math.floor(Math.min(...xs) / 16);
    x <= Math.floor(Math.max(...xs) / 16);
    x++
  )
    for (
      let z = Math.floor(Math.min(...zs) / 16);
      z <= Math.floor(Math.max(...zs) / 16);
      z++
    ) {
      const key = x + "," + z;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(t);
    }
}
export function harbourBaseHeight(x: number, z: number) {
  for (const t of cells.get(Math.floor(x / 16) + "," + Math.floor(z / 16)) ??
    []) {
    const v = jackTriangleHeight(t, x, z);
    if (v.inside) return v.height;
  }
  return 0;
}
export function harbourGroundHeight(x: number, z: number) {
  if (!harbourContains(x, z)) return;
  if (pointInPoly(x, z, HARBOUR_LANDING.pts)) return HARBOUR_LANDING.height;
  const f = HARBOUR_FLIGHTS.find((f) => pointInPoly(x, z, f.pts));
  if (f) return harbourFlightHeight(f, x, z);
  return pointInPoly(x, z, HARBOUR_POOL)
    ? HARBOUR_POOL_LEVEL
    : harbourBaseHeight(x, z);
}
