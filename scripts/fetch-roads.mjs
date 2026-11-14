import fs from "node:fs/promises";
// One consistent OSM extract replaces the older export's simplified road layer.
const bbox = [49.265, -123.164, 49.334, -123.01];
const cache = "artifacts/local/road-metadata-osm.json";
let data;
try {
  data = JSON.parse(await fs.readFile(cache, "utf8"));
} catch {
  const query = `[out:json][timeout:90];way["highway"](${bbox.join(",")});out geom;`;
  for (const endpoint of [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RainCityVancouver/0.1 (personal open-source game)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(110000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      if (!data.elements?.length) throw new Error("Empty road extract");
      await fs.mkdir("artifacts/local", { recursive: true });
      await fs.writeFile(cache, JSON.stringify(data));
      break;
    } catch (error) {
      console.warn(String(error));
    }
  }
}
if (!data?.elements) throw new Error("Could not load road metadata");
const kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
const project = (p) => [
  Math.round((p.lon + 123.12) * kx * 10) / 10,
  Math.round((49.283 - p.lat) * 110540 * 10) / 10,
];
const inside = (p) =>
  (p.lat >= 49.2695 &&
    p.lat <= 49.3175 &&
    p.lon >= -123.164 &&
    p.lon <= -123.0945) ||
  (p.lat >= 49.265 && p.lat <= 49.334 && p.lon >= -123.098 && p.lon <= -123.01);
const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const widthMetres = (value) => {
  if (!value) return undefined;
  const ft = value.match(/^(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);
  if (ft) return Number(ft[1]) * 0.3048 + Number(ft[2] || 0) * 0.0254;
  return positive(value.replace(/\s*m$/, ""));
};
const roads = [];
for (const way of data.elements) {
  const t = way.tags || {},
    sourceKind = t.highway;
  if (!way.geometry?.length || !way.geometry.some(inside)) continue;
  if (
    ["construction", "proposed", "corridor", "elevator", "platform"].includes(
      sourceKind,
    ) ||
    t.indoor === "yes" ||
    (t.tunnel && t.tunnel !== "no") ||
    Number(t.layer) < 0
  )
    continue;
  if (
    ![
      "motorway",
      "trunk",
      "primary",
      "secondary",
      "tertiary",
      "motorway_link",
      "trunk_link",
      "primary_link",
      "secondary_link",
      "tertiary_link",
      "residential",
      "unclassified",
      "living_street",
      "service",
      "pedestrian",
      "cycleway",
      "footway",
      "path",
      "track",
      "steps",
    ].includes(sourceKind)
  )
    continue;
  const kind = /^(motorway|trunk|primary)/.test(sourceKind)
    ? "primary"
    : sourceKind.replace(/_link$/, "") === "living_street"
      ? "residential"
      : sourceKind.replace(/_link$/, "");
  const reverse = t.oneway === "-1";
  const oneway =
    ["yes", "1", "true", "-1"].includes(t.oneway) ||
    t.junction === "roundabout";
  const side = (which) =>
    t[`sidewalk:${which}`] ?? t["sidewalk:both"] ?? t.sidewalk;
  const included = (value) => !["no", "none", "separate"].includes(value);
  let left = included(side("left")),
    right = included(side("right"));
  if (t.sidewalk === "left") {
    left = true;
    right = false;
  }
  if (t.sidewalk === "right") {
    left = false;
    right = true;
  }
  if (reverse) [left, right] = [right, left];
  if (t.foot === "no" || sourceKind.startsWith("motorway"))
    left = right = false;
  const sidewalk =
    left && right ? "both" : left ? "left" : right ? "right" : "none";
  const points = way.geometry.map(project);
  if (reverse) points.reverse();
  const pts = points
    .filter(
      (p, i) =>
        i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
    )
    .flat();
  if (pts.length < 4) continue;
  const record = {
    id: "w" + way.id,
    name: t.name,
    kind,
    sourceKind,
    pts,
    oneway,
    lanes: positive(t.lanes),
    lanesForward: positive(t[reverse ? "lanes:backward" : "lanes:forward"]),
    lanesBackward: positive(t[reverse ? "lanes:forward" : "lanes:backward"]),
    lanesBothWays: positive(t["lanes:both_ways"]),
    width: widthMetres(t.width),
    sidewalk,
    foot: t.foot !== "no",
    walkway: t.footway === "sidewalk",
    crossing: t.footway === "crossing",
    crossingMarkings:
      t["crossing:markings"] ?? (t.crossing === "unmarked" ? "no" : undefined),
    surface: t.surface,
  };
  roads.push(record);
}
const result = {
  meta: {
    source: "OpenStreetMap via Overpass",
    attribution: "© OpenStreetMap contributors, ODbL",
    fetched: data.osm3s?.timestamp_osm_base,
    bbox,
    coordinates: "Metres east/south from 49.283, -123.12",
    notes:
      "Excludes indoor, underground, construction and proposed ways. Width/lanes are mapped where available; rendering estimates missing widths.",
  },
  roads,
};
await fs.writeFile("public/data/vancouver-roads.json", JSON.stringify(result));
console.log(
  JSON.stringify(
    {
      roads: roads.length,
      oneway: roads.filter((r) => r.oneway).length,
      lanes: roads.filter((r) => r.lanes).length,
      widths: roads.filter((r) => r.width).length,
      sidewalkWays: roads.filter((r) => r.walkway).length,
    },
    null,
    2,
  ),
);
