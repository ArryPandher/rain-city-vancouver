/** Bounded derivative of public Terrain Tiles. Run with --verify to compare cached tiles. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const cache = "artifacts/local/north-shore-dem";
const output = "src/world/north-shore-dem-data.json";
const bounds = { west: -123.32, east: -122.83, south: 49.352, north: 49.515 };
const zoom = 11,
  count = 2 ** zoom,
  tileSize = 256;
const width = 449,
  height = 227;
const globalPixel = (lat, lon) => [
  ((lon + 180) / 360) * count * tileSize - 0.5,
  ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) *
    count *
    tileSize -
    0.5,
];
await fs.mkdir(cache, { recursive: true });
const tiles = new Map(),
  sources = [];
const nw = globalPixel(bounds.north, bounds.west),
  se = globalPixel(bounds.south, bounds.east);
for (let y = Math.floor(nw[1] / 256); y <= Math.floor((se[1] + 1) / 256); y++) {
  for (
    let x = Math.floor(nw[0] / 256);
    x <= Math.floor((se[0] + 1) / 256);
    x++
  ) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
    const file = path.join(cache, `${zoom}-${x}-${y}.png`);
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch {
      if (process.argv.includes("--verify"))
        throw Error(`Missing cached source ${file}`);
      const response = await fetch(url);
      if (!response.ok) throw Error(`${url}: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(file, bytes);
    }
    const { data, info } = await sharp(bytes)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 256 || info.height !== 256 || info.channels !== 3)
      throw Error(`Invalid Terrarium tile ${file}`);
    tiles.set(`${x}/${y}`, data);
    sources.push({
      x,
      y,
      url,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }
}
function pixel(x, y) {
  const t = tiles.get(`${Math.floor(x / 256)}/${Math.floor(y / 256)}`);
  if (!t) throw Error(`Missing sample tile ${x},${y}`);
  const i = ((y % 256) * 256 + (x % 256)) * 3;
  return t[i] * 256 + t[i + 1] + t[i + 2] / 256 - 32768;
}
function sample(lat, lon) {
  const [x, y] = globalPixel(lat, lon),
    ix = Math.floor(x),
    iy = Math.floor(y),
    u = x - ix,
    v = y - iy;
  return (
    (pixel(ix, iy) * (1 - u) + pixel(ix + 1, iy) * u) * (1 - v) +
    (pixel(ix, iy + 1) * (1 - u) + pixel(ix + 1, iy + 1) * u) * v
  );
}
const elevations = [];
for (let row = 0; row < height; row++)
  for (let col = 0; col < width; col++) {
    const lat =
      bounds.north + ((bounds.south - bounds.north) * row) / (height - 1);
    const lon = bounds.west + ((bounds.east - bounds.west) * col) / (width - 1);
    elevations.push(Math.round(sample(lat, lon) * 4));
  }
const controls = [
  ["Grouse Mountain", 49.3796, -123.0817],
  ["Mount Fromme", 49.3802, -123.0575],
  ["Mount Seymour", 49.3933, -122.9445],
  ["Lynn Valley", 49.379, -123.018],
].map(([name, lat, lon]) => ({ name, lat, lon, elevation: sample(lat, lon) }));
const result = {
  format: 1,
  bounds,
  width,
  height,
  metresPerUnit: 0.25,
  zoom,
  projection: {
    originLat: 49.283,
    originLon: -123.12,
    kxLat: 49.2935,
    metresPerLatitudeDegree: 110540,
  },
  attribution:
    "Mapzen Terrain Tiles. Contains information licensed under the Open Government Licence – Canada. Global fallback terrain courtesy of the U.S. Geological Survey.",
  licence: "https://open.canada.ca/en/open-government-licence-canada",
  sourceDocumentation:
    "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
  encoding:
    "Terrarium R*256+G+B/256-32768; bilinear at pixel centres; quarter-metre quantization; row 0 north",
  sources,
  controls,
  elevations,
};
const serialized = JSON.stringify(result) + "\n";
if (process.argv.includes("--verify")) {
  if ((await fs.readFile(output, "utf8")) !== serialized)
    throw Error("Derived DEM differs from cached source");
  console.log("Verified exact derivative against all cached source tiles");
} else await fs.writeFile(output, serialized);
console.log(
  JSON.stringify({
    tiles: sources.length,
    width,
    height,
    bytes: serialized.length,
    min: Math.min(...elevations) / 4,
    max: Math.max(...elevations) / 4,
    controls,
  }),
);
