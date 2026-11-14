import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import Delaunator from "delaunator";

// The City describes these 2002 photogrammetric contours as approximate.
// Keep the original export cached for reproducibility; it is not shipped.
const endpoint =
  "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/elevation-contour-lines-1-metre-contours";
const url = new URL(`${endpoint}/exports/json`);
url.searchParams.set(
  "where",
  "intersects(geom, geom'POLYGON((-123.169 49.288,-123.110 49.288,-123.110 49.317,-123.169 49.317,-123.169 49.288))')",
);
await mkdir("artifacts/local", { recursive: true });
const cache = "artifacts/local/stanley-terrain-contours.json";
let raw;
if (process.argv.includes("--cached")) raw = await readFile(cache);
else {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Contour export HTTP ${response.status}`);
  raw = Buffer.from(await response.arrayBuffer());
  await writeFile(cache, raw);
}
const rows = JSON.parse(raw);
if (!Array.isArray(rows) || rows.length < 200)
  throw new Error("Incomplete contour export");
const kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
const project = ([lon, lat]) => [(lon + 123.12) * kx, (49.283 - lat) * 110540];
const base = JSON.parse(await readFile("public/data/vancouver.json", "utf8"));
const ox = (-123.12 - base.meta.bbox[1]) * kx,
  oz = (base.meta.bbox[2] - 49.283) * 110540;
const convert = (p) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
const park = convert(
  base.areas.find((a) => a.name === "Stanley Park" && a.kind === "forest").pts,
);
const lakes = base.areas
  .filter(
    (a) => a.kind === "water" && /^(Lost Lagoon|Beaver Lake)$/.test(a.name),
  )
  .map((a) => ({ name: a.name, pts: convert(a.pts) }));
const config = {
  minX: -2944,
  minZ: -3552,
  step: 4,
  columns: 833,
  rows: 729,
  scale: 0.01,
};
const maxX = config.minX + (config.columns - 1) * config.step,
  maxZ = config.minZ + (config.rows - 1) * config.step;
const within = (x, z, margin = 0) =>
  x >= config.minX - margin &&
  x <= maxX + margin &&
  z >= config.minZ - margin &&
  z <= maxZ + margin;
const pointIn = (x, z, p) => {
  let yes = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
    if (
      p[i + 1] > z !== p[j + 1] > z &&
      x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]
    )
      yes = !yes;
  return yes;
};
const distance = (x, z, ax, az, bx, bz) => {
  const dx = bx - ax,
    dz = bz - az,
    t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)),
    );
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
};
const boundaryDistance = (x, z, p) => {
  let d = Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    d = Math.min(d, distance(x, z, p[i], p[i + 1], p[j], p[j + 1]));
  }
  return d;
};
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const points = [],
  elevations = [],
  keys = new Set();
function add(x, z, h) {
  if (!within(x, z, 160)) return;
  const key = `${Math.round(x * 10)},${Math.round(z * 10)}`;
  if (keys.has(key)) return;
  keys.add(key);
  points.push([x, z]);
  elevations.push(h);
}
let originalPoints = 0;
for (const row of rows) {
  const coords = row.geom.geometry.coordinates.map(project),
    h = row.elevation;
  originalPoints += coords.length;
  if (!Number.isFinite(h)) continue;
  for (let i = 1; i < coords.length; i++) {
    const [ax, az] = coords[i - 1],
      [bx, bz] = coords[i],
      n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
    for (let j = 0; j < n; j++)
      add(ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n, h);
  }
  const last = coords.at(-1);
  add(...last, h);
}
const tin = Delaunator.from(points),
  cells = new Map(),
  cellSize = 32;
for (let ti = 0; ti < tin.triangles.length; ti += 3) {
  const p = [0, 1, 2].map((j) => points[tin.triangles[ti + j]]),
    minx = Math.floor(Math.min(...p.map((p) => p[0])) / cellSize),
    maxx = Math.floor(Math.max(...p.map((p) => p[0])) / cellSize),
    minz = Math.floor(Math.min(...p.map((p) => p[1])) / cellSize),
    maxz = Math.floor(Math.max(...p.map((p) => p[1])) / cellSize);
  for (let x = minx; x <= maxx; x++)
    for (let z = minz; z <= maxz; z++) {
      const key = `${x},${z}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(ti);
    }
}
let misses = 0;
function sample(x, z) {
  for (const ti of cells.get(
    `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`,
  ) || []) {
    const ia = tin.triangles[ti],
      ib = tin.triangles[ti + 1],
      ic = tin.triangles[ti + 2],
      [ax, az] = points[ia],
      [bx, bz] = points[ib],
      [cx, cz] = points[ic];
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue;
    const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det,
      b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det,
      c = 1 - a - b;
    if (a >= -1e-7 && b >= -1e-7 && c >= -1e-7)
      return Math.max(
        0,
        a * elevations[ia] + b * elevations[ib] + c * elevations[ic],
      );
  }
  misses++;
  return 0;
}
// A lake is one horizontal surface. Infer its level from the median of the
// surrounding contours, then recess its bed; these are not bathymetric data.
for (const lake of lakes) {
  const heights = [];
  for (let i = 0; i < lake.pts.length; i += 2)
    heights.push(sample(lake.pts[i], lake.pts[i + 1]));
  heights.sort((a, b) => a - b);
  lake.height = Math.round(heights[Math.floor(heights.length / 2)] * 10) / 10;
}
const values = new Uint16Array(config.columns * config.rows);
let peak = 0,
  peakAt;
for (let iz = 0; iz < config.rows; iz++)
  for (let ix = 0; ix < config.columns; ix++) {
    const x = config.minX + ix * config.step,
      z = config.minZ + iz * config.step;
    const inside = pointIn(x, z, park),
      d = inside ? 0 : boundaryDistance(x, z, park);
    if (!inside && d >= 96) continue;
    let h = sample(x, z);
    // Smoothly join the existing flat city along the park boundary, extending
    // 96 m outside it. No elevation is extrapolated over the remaining city.
    if (!inside) h *= 1 - smooth(d / 96);
    for (const lake of lakes) {
      const d = boundaryDistance(x, z, lake.pts);
      if (pointIn(x, z, lake.pts)) h = lake.height - 0.45;
      else if (d < 12)
        h = (lake.height + 0.1) * (1 - smooth(d / 12)) + h * smooth(d / 12);
    }
    values[iz * config.columns + ix] = Math.round(
      Math.max(0, h) / config.scale,
    );
    if (h > peak) {
      peak = h;
      peakAt = [x, z];
    }
  }
// Contours describe terrain, including old road cuts and retaining walls. Fit
// continuous road grades before baking the shared grid, and keep the coastal
// seawall low. This is gameplay grading, not a claim of surveyed road levels.
const roads = JSON.parse(
  await readFile("public/data/vancouver-roads.json", "utf8"),
).roads;
const nodes = [],
  nodeKeys = new Map(),
  edges = [],
  roadSegments = [],
  roadCells = new Map();
const gridHeight = (x, z) => {
  if (!within(x, z)) return 0;
  const u = (x - config.minX) / config.step,
    v = (z - config.minZ) / config.step,
    ix = Math.min(config.columns - 2, Math.floor(u)),
    iz = Math.min(config.rows - 2, Math.floor(v)),
    a = u - ix,
    b = v - iz,
    i = iz * config.columns + ix;
  return (
    ((values[i] * (1 - a) + values[i + 1] * a) * (1 - b) +
      (values[i + config.columns] * (1 - a) +
        values[i + config.columns + 1] * a) *
        b) *
    config.scale
  );
};
function roadNode(x, z, seawall) {
  const key = `${Math.round(x * 10)},${Math.round(z * 10)},${seawall}`;
  if (nodeKeys.has(key)) return nodeKeys.get(key);
  const i = nodes.length;
  nodes.push({ x, z, h: seawall ? 2 : gridHeight(x, z) });
  nodeKeys.set(key, i);
  return i;
}
for (const road of roads) {
  const seawall = /Seawall/.test(road.name ?? "");
  if (
    !seawall &&
    ![
      "primary",
      "secondary",
      "tertiary",
      "residential",
      "unclassified",
      "service",
    ].includes(road.kind)
  )
    continue;
  if (/Lions Gate Bridge/.test(road.name ?? "")) continue;
  if (
    !road.pts.some(
      (v, i) =>
        i % 2 === 0 &&
        within(v, road.pts[i + 1]) &&
        pointIn(v, road.pts[i + 1], park),
    )
  )
    continue;
  const width = seawall
    ? 5
    : (road.width ??
      (road.lanes
        ? road.lanes * 3.2 + 0.6
        : road.kind === "service"
          ? 4.4
          : 8));
  for (let i = 0; i < road.pts.length - 2; i += 2) {
    const [ax, az, bx, bz] = road.pts.slice(i, i + 4),
      length = Math.hypot(bx - ax, bz - az),
      n = Math.max(1, Math.ceil(length / 4));
    let previous;
    for (let j = 0; j <= n; j++) {
      const x = ax + ((bx - ax) * j) / n,
        z = az + ((bz - az) * j) / n;
      if (!within(x, z)) continue;
      const current = roadNode(x, z, seawall);
      if (previous !== undefined && current !== previous) {
        const a = nodes[previous],
          b = nodes[current],
          l = Math.hypot(a.x - b.x, a.z - b.z);
        edges.push({ a: previous, b: current, max: l * (seawall ? 0 : 0.12) });
        roadSegments.push({ a: previous, b: current, width, seawall });
      }
      previous = current;
    }
  }
}
for (let pass = 0; pass < 400; pass++) {
  let largest = 0;
  for (const e of edges) {
    const a = nodes[e.a],
      b = nodes[e.b],
      d = b.h - a.h,
      excess = Math.abs(d) - e.max;
    if (excess > 0.0001) {
      const delta = (Math.sign(d) * excess) / 2;
      a.h += delta;
      b.h -= delta;
      largest = Math.max(largest, excess);
    }
  }
  if (largest < 0.002) break;
}
for (const seg of roadSegments) {
  const a = nodes[seg.a],
    b = nodes[seg.b],
    r = seg.width / 2 + 10;
  for (
    let x = Math.floor((Math.min(a.x, b.x) - r) / 32);
    x <= Math.floor((Math.max(a.x, b.x) + r) / 32);
    x++
  )
    for (
      let z = Math.floor((Math.min(a.z, b.z) - r) / 32);
      z <= Math.floor((Math.max(a.z, b.z) + r) / 32);
      z++
    ) {
      const key = `${x},${z}`;
      if (!roadCells.has(key)) roadCells.set(key, []);
      roadCells.get(key).push(seg);
    }
}
let gradedCells = 0;
for (let iz = 0; iz < config.rows; iz++)
  for (let ix = 0; ix < config.columns; ix++) {
    const x = config.minX + ix * config.step,
      z = config.minZ + iz * config.step,
      i = iz * config.columns + ix;
    const candidates = roadCells.get(
      `${Math.floor(x / 32)},${Math.floor(z / 32)}`,
    );
    if (!candidates) continue;
    let total = 0,
      weighted = 0,
      influence = 0;
    for (const seg of candidates) {
      const a = nodes[seg.a],
        b = nodes[seg.b],
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = Math.max(
          0,
          Math.min(
            1,
            ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1),
          ),
        ),
        d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz),
        edge = d - seg.width / 2 - 2;
      if (edge >= 8) continue;
      const w = 1 - smooth(edge / 8),
        h = a.h + (b.h - a.h) * t,
        weight = w / (1 + d * d);
      total += weight;
      weighted += h * weight;
      influence = Math.max(influence, w);
    }
    if (total) {
      const outside = pointIn(x, z, park) ? 0 : boundaryDistance(x, z, park),
        fade = 1 - smooth(outside / 96);
      const target = (weighted / total) * fade;
      values[i] = Math.round(
        (values[i] * config.scale * (1 - influence) + target * influence) /
          config.scale,
      );
      gradedCells++;
    }
  }
const binary = Buffer.alloc(values.length * 2);
values.forEach((v, i) => binary.writeUInt16LE(v, i * 2));
const metadata = {
  version: 1,
  source: "City of Vancouver, elevation-contour-lines-1-metre-contours",
  sourceYear: 2002,
  sourceUrl:
    "https://opendata.vancouver.ca/explore/dataset/elevation-contour-lines-1-metre-contours/",
  exportUrl: url.href,
  licence: "https://opendatacommons.org/licenses/odbl/1-0/",
  citySourceLicence: "https://opendata.vancouver.ca/pages/licence/",
  additionalSources:
    "OpenStreetMap park, water and roads; © OpenStreetMap contributors. Source geometry is published in vancouver.json and vancouver-roads.json.",
  attribution:
    "Contains information licensed under the Open Government Licence – Vancouver.",
  fetched: new Date().toISOString(),
  ...config,
  binary: "stanley-height.u16",
  byteOrder: "little-endian",
  projection:
    "Local metres, origin 49.283,-123.12, x east, z south; longitude cos(49.2935)*111320, latitude 110540.",
  method:
    "Delaunay interpolation of approximate 2002 contours resampled at <=4m; 4m height grid quantized to centimetres (storage precision, not survey accuracy). Park boundary extends through a 96m smooth join into the existing flat city. Lake levels use median shoreline contour heights; beds are interpreted 0.45m below level. Roads receive interpreted grades fitted to a 12% segment slope limit; seawall height is interpreted at 2m, with shoulders blended into terrain. Grid interpolation and junction blending can exceed that fitting limit.",
  lakes,
  statistics: {
    sourceRecords: rows.length,
    sourceVertices: originalPoints,
    tinVertices: points.length,
    triangles: tin.triangles.length / 3,
    uncoveredSamples: misses,
    gradedCells,
    roadGradeNodes: nodes.length,
    peak,
    peakAt,
  },
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  binarySha256: createHash("sha256").update(binary).digest("hex"),
};
await writeFile("public/data/stanley-height.u16", binary);
await writeFile("public/data/stanley-terrain.json", JSON.stringify(metadata));
console.log(
  JSON.stringify(
    {
      bytes: binary.length,
      ...metadata.statistics,
      lakes: lakes.map(({ name, height }) => ({ name, height })),
    },
    null,
    2,
  ),
);
