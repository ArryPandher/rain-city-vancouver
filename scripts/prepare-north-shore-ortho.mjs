import { boundedFetch } from "./lib/bounded-fetch.mjs";
import fs from "node:fs/promises";
import sharp from "sharp";
import crypto from "node:crypto";
import proj4 from "../artifacts/local/north-shore-dem/tools/node_modules/proj4/dist/proj4-src.js";
const dir = "artifacts/local/north-shore-dem/dnv-2013-tiles";
await fs.mkdir(dir, { recursive: true });
const bounds = { west: -123.128, east: -122.876, south: 49.352, north: 49.414 },
  width = 2048,
  height = 504;
// Exact published cache registration from Basemap_Ortho2013/MapServer?f=pjson.
const info = { origin: { x: 474584, y: 5480125 } },
  level = 1,
  res = 10.583354500042335,
  tile = 256;
const utm = "+proj=utm +zone=10 +datum=NAD83 +units=m +no_defs";
const project = (lon, lat) => proj4("EPSG:4326", utm, [lon, lat]);
const cs = [
  project(bounds.west, bounds.north),
  project(bounds.east, bounds.north),
  project(bounds.west, bounds.south),
  project(bounds.east, bounds.south),
];
const col0 = Math.floor(
    (Math.min(...cs.map((x) => x[0])) - info.origin.x) / res / tile,
  ),
  col1 = Math.floor(
    (Math.max(...cs.map((x) => x[0])) - info.origin.x) / res / tile,
  ),
  row0 = Math.floor(
    (info.origin.y - Math.max(...cs.map((x) => x[1]))) / res / tile,
  ),
  row1 = Math.floor(
    (info.origin.y - Math.min(...cs.map((x) => x[1]))) / res / tile,
  );
const tw = (col1 - col0 + 1) * tile,
  th = (row1 - row0 + 1) * tile,
  raster = Buffer.alloc(tw * th * 4),
  records = [];
let transferred = 0;
const budget = { limit: 20 * 1024 * 1024, used: 0 };
for (let row = row0; row <= row1; row++)
  for (let col = col0; col <= col1; col++) {
    const url = `https://geoweb.dnv.org/arcgis/rest/services/Basemap_Ortho2013/MapServer/tile/${level}/${row}/${col}`,
      file = `${dir}/${level}-${row}-${col}.img`;
    let bytes;
    try {
      bytes = await fs.readFile(file);
      budget.used += bytes.length;
      if (budget.used > budget.limit)
        throw Error("Cached source budget exceeded");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      bytes = await boundedFetch(url, {
        maxBytes: 1024 * 1024,
        budget,
        allowedTypes: ["image/jpeg", "image/png"],
      });
      transferred += bytes.length;
      await fs.writeFile(file, bytes);
    }
    const { data, info: image } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (image.width !== tile || image.height !== tile)
      throw Error("Wrong tile size");
    for (let y = 0; y < tile; y++)
      data.copy(
        raster,
        (((row - row0) * tile + y) * tw + (col - col0) * tile) * 4,
        y * tile * 4,
        (y + 1) * tile * 4,
      );
    records.push({
      url,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      row,
      col,
    });
  }
const pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const lon = bounds.west + ((x + 0.5) / width) * (bounds.east - bounds.west),
      lat = bounds.north - ((y + 0.5) / height) * (bounds.north - bounds.south),
      [e, n] = project(lon, lat),
      u = (e - info.origin.x) / res - col0 * tile - 0.5,
      v = (info.origin.y - n) / res - row0 * tile - 0.5,
      a = Math.floor(u),
      b = Math.floor(v),
      fx = u - a,
      fy = v - b;
    if (a < 0 || b < 0 || a + 1 >= tw || b + 1 >= th)
      throw Error("Outside padded tiles");
    for (let c = 0; c < 4; c++)
      pixels[(y * width + x) * 4 + c] = Math.round(
        (raster[(b * tw + a) * 4 + c] * (1 - fx) +
          raster[(b * tw + a + 1) * 4 + c] * fx) *
          (1 - fy) +
          (raster[((b + 1) * tw + a) * 4 + c] * (1 - fx) +
            raster[((b + 1) * tw + a + 1) * 4 + c] * fx) *
            fy,
      );
  }

// Cached imagery is RGB; mask only near-white exterior connected to its border.
// Enclosed photographed snow is retained. This conservatively excludes missing
// exterior pixels; no inferred colour is generated beyond source coverage.
const invalid = new Uint8Array(width * height),
  queue = new Int32Array(width * height);
let head = 0,
  tail = 0;
function add(i) {
  if (invalid[i]) return;
  const p = i * 4;
  if (pixels[p] >= 250 && pixels[p + 1] >= 250 && pixels[p + 2] >= 250) {
    invalid[i] = 1;
    queue[tail++] = i;
  }
}
for (let x = 0; x < width; x++) {
  add(x);
  add((height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  add(y * width);
  add(y * width + width - 1);
}
while (head < tail) {
  const i = queue[head++],
    x = i % width,
    y = Math.floor(i / width);
  if (x) add(i - 1);
  if (x < width - 1) add(i + 1);
  if (y) add(i - width);
  if (y < height - 1) add(i + width);
}
const dx =
    ((bounds.east - bounds.west) *
      111320 *
      Math.cos(((bounds.north + bounds.south) * Math.PI) / 360)) /
    width,
  dy = ((bounds.north - bounds.south) * 110540) / height,
  diag = Math.hypot(dx, dy),
  distance = new Float32Array(width * height);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++)
    distance[y * width + x] =
      invalid[y * width + x] || !x || !y || x === width - 1 || y === height - 1
        ? 0
        : 1e9;
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    let d = distance[i];
    if (x) d = Math.min(d, distance[i - 1] + dx);
    if (y) d = Math.min(d, distance[i - width] + dy);
    if (x && y) d = Math.min(d, distance[i - width - 1] + diag);
    if (x < width - 1 && y) d = Math.min(d, distance[i - width + 1] + diag);
    distance[i] = d;
  }
for (let y = height - 1; y >= 0; y--)
  for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    let d = distance[i];
    if (x < width - 1) d = Math.min(d, distance[i + 1] + dx);
    if (y < height - 1) d = Math.min(d, distance[i + width] + dy);
    if (x < width - 1 && y < height - 1)
      d = Math.min(d, distance[i + width + 1] + diag);
    if (x && y < height - 1) d = Math.min(d, distance[i + width - 1] + diag);
    distance[i] = d;
    const t = Math.min(1, d / 300);
    pixels[i * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
  }
const texture = "public/textures/north-shore-dem/dnv-2013.webp";
const image = await sharp(pixels, { raw: { width, height, channels: 4 } })
  .webp({ quality: 94, alphaQuality: 100 })
  .toBuffer();
const metadata = {
  version: 1,
  year: 2013,
  scene: "District of North Vancouver Orthoimagery 2013",
  capture: "Urban 2013-05-03; alpine 2013-06-15",
  bounds,
  width,
  height,
  projection:
    "EPSG:4326 north-up pixel-centre resampling from NAD83 UTM10N (EPSG:26910) tile cache",
  level,
  sourceResolution: res,
  tileOrigin: info.origin,
  records,
  sourceBytes: records.reduce((n, r) => n + r.bytes, 0),
  licence: "Open Government Licence - North Vancouver",
  licenceUrl: "https://geoweb.dnv.org/data/",
  metadataUrl:
    "https://geoweb.dnv.org/data/metadata.php?dataset=ImgOrthoimagery2013",
  attribution:
    "Contains information licensed under the Open Government Licence - North Vancouver.",
  edgeBlendMetres: 300,
  exteriorMissingPixels: tail,
  description:
    "Orthophoto-derived colour, not measured albedo. June2013 summit snow and baked lighting retained. Neutral fallback beyond crop and exterior coverage.",
  texture,
  textureBytes: image.length,
  textureSha256: crypto.createHash("sha256").update(image).digest("hex"),
};
const metaPath = "src/world/north-shore-ortho-data.json",
  serialized = JSON.stringify(metadata, null, 2) + "\n";
if (process.argv.includes("--verify")) {
  if (
    !image.equals(await fs.readFile(texture)) ||
    serialized !== (await fs.readFile(metaPath, "utf8"))
  )
    throw Error("Derivative mismatch");
} else {
  await fs.writeFile(texture, image);
  await fs.writeFile(metaPath, serialized);
  await fs.writeFile(
    "public/textures/north-shore-dem/DNV-SOURCES.json",
    serialized,
  );
}
console.log({
  tiles: records.length,
  sourceBytes: metadata.sourceBytes,
  transferred,
  width,
  height,
  textureBytes: image.length,
  textureSha256: metadata.textureSha256,
});
