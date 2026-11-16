// Test fixture mirrors loadCity: complete base/east conversion and all optional layers.
// Fetch is supplied by the test from unchanged public files; no network.
import {
  KX,
  ORIGIN,
  bounds,
  centroid,
  type CityData,
  type Road,
  type Building,
  type Area,
} from "../../src/world/data";
import { loadTerrain } from "../../src/world/terrain";
export async function loadCity(): Promise<CityData> {
  const r = await fetch(`${"/"}data/vancouver.json`);
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
    const e = await (await fetch(`${"/"}data/vancouver-east.json`)).json();
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
    const response = await fetch(`${"/"}data/vancouver-roads.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const roads = await response.json();
    if (!Array.isArray(roads.roads) || !roads.roads.length)
      throw new Error("Empty road layer");
    d.roads = roads.roads;
  } catch (e) {
    console.warn("Detailed road layer unavailable; using the base map", e);
  }
  try {
    const response = await fetch(`${"/"}data/vancouver-building-tags.json`);
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
    const response = await fetch(`${"/"}data/vancouver-public-trees.json`);
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
  try {
    d.terrain = await loadTerrain("/");
  } catch (error) {
    console.warn("Park elevation unavailable; using the flat base map", error);
  }
  try {
    const response = await fetch(`${"/"}data/stanley-seawall.json`);
    if (!response.ok) throw new Error(`Seawall HTTP ${response.status}`);
    const layer = await response.json();
    if (!Array.isArray(layer.walls) || !Array.isArray(layer.railings))
      throw new Error("Invalid seawall layer");
    d.seawall = layer;
  } catch (error) {
    console.warn(
      "Seawall detail unavailable; retaining shoreline paths",
      error,
    );
  }
  return d;
}
