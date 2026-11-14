import { mkdir, readFile, writeFile } from "node:fs/promises";

const endpoint =
  "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-trees";
const bbox = [49.264, -123.164, 49.334, -123.01];
const where =
  "within(geo_point_2d, geom'POLYGON((-123.164 49.264,-123.010 49.264,-123.010 49.334,-123.164 49.334,-123.164 49.264))')";
const fields =
  "asset_id,common_name,genus_name,species_name,cultivar_name,height_m,diameter_cm,geo_point_2d";
const cache = "artifacts/local/public-tree-export.json";
await mkdir("artifacts/local", { recursive: true });
let records, metadata, fetched;
const metadataCache = "artifacts/local/public-tree-export-meta.json";
if (process.argv.includes("--cached")) {
  records = JSON.parse(await readFile(cache, "utf8"));
  ({ metadata, fetched } = JSON.parse(await readFile(metadataCache, "utf8")));
} else {
  const url = new URL(`${endpoint}/exports/json`);
  url.searchParams.set("where", where);
  url.searchParams.set("select", fields);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tree export HTTP ${response.status}`);
  records = await response.json();
  if (!Array.isArray(records) || records.length < 10000)
    throw new Error("Incomplete tree export");
  const metadataResponse = await fetch(endpoint);
  if (!metadataResponse.ok)
    throw new Error(`Tree metadata HTTP ${metadataResponse.status}`);
  metadata = await metadataResponse.json();
  fetched = new Date().toISOString();
  await writeFile(cache, JSON.stringify(records));
  await writeFile(metadataCache, JSON.stringify({ metadata, fetched }));
}
const kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
const round = (n) => Math.round(n * 100) / 100;
const species = [],
  keys = new Map(),
  trees = [],
  plantingSites = [],
  ids = new Set(),
  positions = new Set();
let invalid = 0,
  duplicate = 0;
for (const r of records.sort((a, b) => a.asset_id - b.asset_id)) {
  const { lat, lon } = r.geo_point_2d ?? {};
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < bbox[0] ||
    lat > bbox[2] ||
    lon < bbox[1] ||
    lon > bbox[3]
  ) {
    invalid++;
    continue;
  }
  const x = round((lon + 123.12) * kx),
    z = round((49.283 - lat) * 110540);
  if (/PLANTING SITE|STUMP|REMOVED|VACANT/i.test(r.common_name ?? "")) {
    plantingSites.push(x, z);
    continue;
  }
  const position = `${Math.round(x * 10)},${Math.round(z * 10)}`;
  if (ids.has(r.asset_id) || positions.has(position)) {
    duplicate++;
    continue;
  }
  ids.add(r.asset_id);
  positions.add(position);
  const s = {
    name: r.common_name ?? "",
    genus: r.genus_name ?? "",
    species: r.species_name ?? "",
    cultivar: r.cultivar_name ?? "",
  };
  const key = JSON.stringify(s);
  if (!keys.has(key)) {
    keys.set(key, species.length);
    species.push(s);
  }
  const h = r.height_m > 0 && r.height_m <= 75 ? r.height_m : null;
  const d =
    r.diameter_cm > 0 && r.diameter_cm <= 500 ? r.diameter_cm / 100 : null;
  trees.push([r.asset_id, x, z, h, d, keys.get(key)]);
}
const output = {
  source: "City of Vancouver public-trees",
  url: "https://opendata.vancouver.ca/explore/dataset/public-trees/",
  licence: "https://opendata.vancouver.ca/pages/licence/",
  attribution:
    "Contains information licensed under the Open Government Licence – Vancouver.",
  fetched,
  sourceModified: metadata.metas?.default?.modified,
  bbox,
  projection:
    "Local metres: origin 49.283,-123.12; longitude factor cos(49.2935)*111320, latitude factor 110540; south-positive z.",
  columns: [
    "asset_id",
    "x_m",
    "z_m",
    "height_m_or_null",
    "diameter_m_or_null",
    "species_index",
  ],
  caveat:
    "Public boulevard and park inventory; coordinates and attributes can lag the current landscape. Private trees excluded. Crown widths and forms are interpreted, not measured.",
  audit: {
    sourceRecords: records.length,
    liveTrees: trees.length,
    plantingSites: plantingSites.length / 2,
    invalid,
    duplicate,
  },
  species,
  trees,
  plantingSites,
};
await writeFile(
  "public/data/vancouver-public-trees.json",
  JSON.stringify(output),
);
console.log(
  output.audit,
  "species",
  species.length,
  "sourceModified",
  output.sourceModified,
);
