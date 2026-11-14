import fs from "node:fs/promises";
const query =
  "[out:json][timeout:90];way(id:604043442,604043443,1227211750);out tags geom;";
const cache = "artifacts/local/prospect-osm-coast.json";
let data;
if (process.argv.includes("--cached"))
  data = JSON.parse(await fs.readFile(cache, "utf8"));
else {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw Error(`Overpass ${response.status}`);
  data = await response.json();
  await fs.mkdir("artifacts/local", { recursive: true });
  await fs.writeFile(cache, JSON.stringify(data));
}
const ids = [604043442, 604043443, 1227211750],
  kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
const layer = {
  version: 1,
  source: "https://www.openstreetmap.org/copyright",
  license: "ODbL-1.0",
  attribution: "© OpenStreetMap contributors",
  fetched: new Date().toISOString(),
  walls: [],
  railings: [],
};
for (const id of ids) {
  const e = data.elements.find((e) => e.id === id);
  if (!e?.geometry?.length) throw Error(`Missing way ${id}`);
  const pts = e.geometry.flatMap((p) => [
    Math.round((p.lon + 123.12) * kx * 100) / 100,
    Math.round((49.283 - p.lat) * 110540 * 100) / 100,
  ]);
  layer[e.tags.wall === "seawall" ? "walls" : "railings"].push({
    id: "w" + id,
    pts,
  });
}
await fs.writeFile(
  "public/data/stanley-seawall.json",
  JSON.stringify(layer) + "\n",
);
console.log("Prepared two mapped seawalls and Prospect railing");
