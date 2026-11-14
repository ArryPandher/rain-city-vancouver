import { Vector2 } from "three";
import type { PublicTreeLayer } from "./tree-profile";
export type Point = [number, number];
export interface Road {
  id?: string;
  name?: string;
  kind: string;
  pts: number[];
  sourceKind?: string;
  oneway?: boolean;
  lanes?: number;
  lanesForward?: number;
  lanesBackward?: number;
  lanesBothWays?: number;
  width?: number;
  sidewalk?: "both" | "left" | "right" | "none";
  foot?: boolean;
  walkway?: boolean;
  crossing?: boolean;
  crossingMarkings?: string;
  surface?: string;
}
export interface Area {
  name?: string;
  kind: string;
  pts: number[];
  holes?: number[][];
}
export interface Building {
  id: string;
  name?: string;
  kind?: string;
  levels?: number;
  height?: number;
  roofShape?: string;
  roofHeight?: number;
  roofMaterial?: string;
  roofColor?: string;
  wallMaterial?: string;
  wallColor?: string;
  startYear?: number;
  pts: number[];
}
export interface CityData {
  meta: {
    bbox: number[];
    latC: number;
    pxPerMeter: number;
    w: number;
    h: number;
    fetched: string;
  };
  roads: Road[];
  areas: Area[];
  buildings: Building[];
  trees: number[];
  publicTrees?: PublicTreeLayer;
  ocean: number[][];
  pois: { name: string; kind: string; x: number; y: number }[];
}
export const ORIGIN = { lat: 49.283, lon: -123.12 };
export const KX = Math.cos((49.2935 * Math.PI) / 180) * 111320;
export function geo(lat: number, lon: number): Point {
  return [(lon - ORIGIN.lon) * KX, (ORIGIN.lat - lat) * 110540];
}
export function ungeo(x: number, z: number): Point {
  return [ORIGIN.lat - z / 110540, ORIGIN.lon + x / KX];
}
export const bounds = {
  minX: geo(49.3175, -123.164)[0],
  maxX: geo(49.2695, -123.0945)[0],
  minZ: geo(49.3175, -123.164)[1],
  maxZ: geo(49.2695, -123.0945)[1],
};
export function pairs(pts: number[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push([pts[i], pts[i + 1]]);
  return out;
}
export function centroid(pts: number[]): Point {
  let x = 0,
    z = 0;
  for (let i = 0; i < pts.length; i += 2) {
    x += pts[i];
    z += pts[i + 1];
  }
  return [x / (pts.length / 2), z / (pts.length / 2)];
}
export function pointInPoly(x: number, z: number, p: number[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i],
      zi = p[i + 1],
      xj = p[j],
      zj = p[j + 1];
    if (zi > z != zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}
export function segmentPoint(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = bx - ax,
    dz = bz - az;
  const t = Math.max(
    0,
    Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)),
  );
  return {
    x: ax + t * dx,
    z: az + t * dz,
    t,
    d: Math.hypot(x - ax - t * dx, z - az - t * dz),
  };
}
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string) {
  let n = 0;
  for (const c of s) n = (Math.imul(31, n) + c.charCodeAt(0)) | 0;
  return n >>> 0;
}
export function vecs(p: number[]) {
  return pairs(p).map(([x, z]) => new Vector2(x, -z));
}
export async function loadCity(): Promise<CityData> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/vancouver.json`);
  if (!r.ok)
    throw new Error("Vancouver map could not be loaded. Reload to retry.");
  const d: CityData = await r.json();
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  d.roads.forEach((r) => (r.pts = convert(r.pts)));
  d.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  d.buildings.forEach((b) => (b.pts = convert(b.pts)));
  d.trees = convert(d.trees);
  d.ocean = d.ocean.map(convert);
  d.pois.forEach((p) => {
    p.x = p.x / 2 - ox;
    p.y = p.y / 2 - oz;
  });
  try {
    const e = await (
      await fetch(`${import.meta.env.BASE_URL}data/vancouver-east.json`)
    ).json();
    const edge = bounds.maxX;
    const outside = (p: number[]) => {
      const [x, z] = centroid(p);
      return x > edge || z < bounds.minZ || z > bounds.maxZ;
    };
    const ids = new Set(d.buildings.map((b) => b.id));
    d.buildings.push(
      ...e.buildings.filter((b: Building) => !ids.has(b.id) && outside(b.pts)),
    );
    d.roads.push(...e.roads.filter((r: Road) => outside(r.pts)));
    d.areas.push(...e.areas.filter((a: Area) => outside(a.pts)));
    d.ocean.push(...e.ocean);
    bounds.maxX = 8200;
    bounds.minZ = -5600;
    bounds.maxZ = 2200;
  } catch (e) {
    console.warn("Eastern map unavailable; downtown remains playable", e);
  }
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/vancouver-roads.json`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const roads = await response.json();
    if (!Array.isArray(roads.roads) || !roads.roads.length)
      throw new Error("Empty road layer");
    d.roads = roads.roads;
  } catch (e) {
    console.warn("Detailed road layer unavailable; using the base map", e);
  }
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/vancouver-building-tags.json`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const metadata = await response.json();
    for (const building of d.buildings) {
      const attrs = metadata.buildings?.[building.id];
      if (!attrs) continue;
      const levels = building.levels ?? attrs.levels;
      Object.assign(building, attrs, { levels });
    }
  } catch (e) {
    console.warn("Building metadata unavailable; using the base map", e);
  }
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/vancouver-public-trees.json`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const layer = await response.json();
    if (
      !Array.isArray(layer.trees) ||
      !Array.isArray(layer.species) ||
      !Array.isArray(layer.plantingSites)
    )
      throw new Error("Invalid public-tree layer");
    d.publicTrees = layer;
  } catch (e) {
    console.warn("City tree inventory unavailable; using mapped trees", e);
  }
  return d;
}
export const roadWidth = (r: Road) => {
  if (r.width && Number.isFinite(r.width))
    return Math.max(isStreet(r) ? 2.8 : 0.6, Math.min(40, r.width));
  if (r.lanes && Number.isFinite(r.lanes) && isStreet(r))
    return (
      Math.max(1, Math.min(10, r.lanes)) *
        (r.sourceKind?.startsWith("motorway") ? 3.6 : 3.2) +
      0.6
    );
  if (r.oneway && isStreet(r)) return 6.8;
  return (
    {
      primary: 14,
      secondary: 13.4,
      tertiary: 8,
      residential: 9,
      unclassified: 7,
      service: 4.4,
      pedestrian: 6,
      cycleway: 3,
      footway: 1.8,
      path: 2.5,
      track: 4,
      steps: 2,
    }[r.kind] ?? 5
  );
};
export const isStreet = (r: Road) =>
  ["primary", "secondary", "tertiary", "residential", "unclassified"].includes(
    r.kind,
  );
export interface Landmark {
  id: string;
  name: string;
  district: string;
  at: Point;
  spawn: Point;
  heading: number;
  description: string;
}
const lm = (
  id: string,
  name: string,
  district: string,
  at: Point,
  spawn: Point,
  heading: number,
  description: string,
): Landmark => ({
  id,
  name,
  district,
  at: geo(...at),
  spawn: geo(...spawn),
  heading,
  description,
});
export const LANDMARKS: Landmark[] = [
  lm(
    "canada",
    "Canada Place",
    "Coal Harbour",
    [49.2886, -123.1116],
    [49.2871, -123.11415],
    -0.38,
    "Five white sails, the working harbour and the North Shore beyond.",
  ),
  lm(
    "robson",
    "Robson Square",
    "Downtown",
    [49.2825, -123.1207],
    [49.28249, -123.12216],
    -0.75,
    "Terraced gardens, the gallery and the heart of the city.",
  ),
  lm(
    "granville",
    "Granville Street",
    "Entertainment District",
    [49.27955, -123.1224],
    [49.27934, -123.1228],
    -0.6,
    "The neon spine of downtown. Take a late-night cruise.",
  ),
  lm(
    "stanley",
    "Stanley Park",
    "Stanley Park",
    [49.3, -123.14],
    [49.29468, -123.1362],
    -0.25,
    "A coastal forest, winding roads and kilometres of seawall.",
  ),
  lm(
    "prospect",
    "Prospect Point",
    "Stanley Park",
    [49.3125, -123.142],
    [49.31176, -123.1429],
    -0.3,
    "The Lions Gate crossing above the inlet.",
  ),
  lm(
    "english",
    "English Bay",
    "West End",
    [49.2868, -123.1428],
    [49.28705, -123.1407],
    2.35,
    "Sunset on the beach at the edge of the West End.",
  ),
  lm(
    "gastown",
    "Gastown",
    "Gastown",
    [49.2844, -123.1089],
    [49.28455, -123.1091],
    1.0,
    "Brick warehouses, Water Street and the steam clock.",
  ),
  lm(
    "cambie",
    "Cambie Bridge",
    "False Creek",
    [49.2738, -123.1144],
    [49.27545, -123.1171],
    3.0,
    "A long, open crossing with the city behind you.",
  ),
  lm(
    "science",
    "Science World",
    "False Creek",
    [49.2734, -123.1036],
    [49.27428, -123.1034],
    3.0,
    "The geodesic sphere at the head of False Creek.",
  ),
  lm(
    "ironworkers",
    "Ironworkers Memorial Bridge",
    "Burrard Inlet",
    [49.2975, -123.0265],
    [49.29159327, -123.02612961],
    -3.1188,
    "A steel truss crossing. Reach it along the eastern waterfront.",
  ),
];
