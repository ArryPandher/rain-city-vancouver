/** Reproduce with geotiff@3.0.5 and proj4@2.23.0 installed in the ignored tools directory.
 * Refuses non-range/full-file responses; total new transfers capped at20MiB. */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { fromUrl } from "../artifacts/local/north-shore-dem/tools/node_modules/geotiff/dist-module/geotiff.js";
import proj4 from "../artifacts/local/north-shore-dem/tools/node_modules/proj4/dist/proj4-src.js";
const url =
  "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/10/U/DV/2024/8/S2A_10UDV_20240830_0_L2A/TCI.tif";
const cache = "artifacts/local/north-shore-dem/sentinel-ranges";
await fs.mkdir(cache, { recursive: true });
const originalFetch = globalThis.fetch,
  records = [];
let transferred = 0;
const limit = 20 * 1024 * 1024;
globalThis.fetch = async (input, options = {}) => {
  const range = new Headers(options.headers).get("Range");
  if (!range || !/^bytes=\d+-\d+$/.test(range))
    throw Error("Bounded single byte-range required");
  const key = range.replace("bytes=", ""),
    file = `${cache}/${key}.bin`;
  let bytes, headers;
  try {
    bytes = await fs.readFile(file);
    headers = JSON.parse(await fs.readFile(file + ".json", "utf8"));
  } catch {
    const response = await originalFetch(input, options);
    const size = Number(response.headers.get("content-length"));
    if (response.status !== 206 || !size || transferred + size > limit) {
      await response.body?.cancel();
      throw Error(`Range budget/status failure ${response.status} ${size}`);
    }
    transferred += size;
    bytes = Buffer.from(await response.arrayBuffer());
    headers = Object.fromEntries(response.headers);
    await fs.writeFile(file, bytes);
    await fs.writeFile(file + ".json", JSON.stringify(headers));
  }
  records.push({
    range,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    contentRange: headers["content-range"],
  });
  return new Response(bytes, { status: 206, headers });
};
const bounds = { west: -123.32, east: -122.93, south: 49.352, north: 49.515 };
const utm = "+proj=utm +zone=10 +datum=WGS84 +units=m +no_defs";
const project = (lon, lat) => proj4("EPSG:4326", utm, [lon, lat]);
const corners = [
  project(bounds.west, bounds.north),
  project(bounds.east, bounds.north),
  project(bounds.west, bounds.south),
  project(bounds.east, bounds.south),
];
const box = [
  Math.min(...corners.map((p) => p[0])),
  Math.min(...corners.map((p) => p[1])),
  Math.max(...corners.map((p) => p[0])),
  Math.max(...corners.map((p) => p[1])),
];
const tiff = await fromUrl(url, {
  allowFullFile: false,
  blockSize: 65536,
  cacheSize: 200,
});
const count = await tiff.getImageCount(),
  first = await tiff.getImage();
let chosen = first,
  index = 0;
for (let i = 1; i < count; i++) {
  let image = await tiff.getImage(i);
  if (Math.abs(image.getResolution(first)[0]) <= 23) {
    chosen = image;
    index = i;
  }
}
const [ox, oy] = first.getOrigin(),
  [rx, ry] = chosen.getResolution(first);
const window = [
  Math.floor((box[0] - ox) / rx) - 1,
  Math.floor((box[3] - oy) / ry) - 1,
  Math.ceil((box[2] - ox) / rx) + 1,
  Math.ceil((box[1] - oy) / ry) + 1,
];
if (
  window[0] < 0 ||
  window[1] < 0 ||
  window[2] > chosen.getWidth() ||
  window[3] > chosen.getHeight()
)
  throw Error("Crop exceeds source image");
const raster = await chosen.readRasters({
  window,
  interleave: true,
  samples: [0, 1, 2],
});
const width = 1280,
  height = Math.round(
    (width * (bounds.north - bounds.south) * 110540) /
      ((bounds.east - bounds.west) *
        Math.cos((49.2935 * Math.PI) / 180) *
        111320),
  );
const pixels = Buffer.alloc(width * height * 4),
  rw = window[2] - window[0],
  rh = window[3] - window[1];
const footprint = [
  [-124.38571352908221, 49.644421246766726],
  [-124.35846461064666, 48.65792929304437],
  [-123.37196581878945, 48.66551914514479],
  [-123.0477994708608, 49.35928648892238],
  [-123.01264330640078, 49.438011917160516],
  [-122.90782022458198, 49.65267712864953],
];
const kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
function coverage(lon, lat) {
  let inside = false,
    distance = Infinity;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
    const [ax, ay] = footprint[j],
      [bx, by] = footprint[i];
    if (ay > lat != by > lat && lon < ((bx - ax) * (lat - ay)) / (by - ay) + ax)
      inside = !inside;
    const dx = (bx - ax) * kx,
      dy = (by - ay) * 110540,
      px = (lon - ax) * kx,
      py = (lat - ay) * 110540;
    const t = Math.max(
      0,
      Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)),
    );
    distance = Math.min(distance, Math.hypot(px - dx * t, py - dy * t));
  }
  if (!inside) return 0;
  distance = Math.min(
    distance,
    (lon - bounds.west) * kx,
    (bounds.east - lon) * kx,
    (lat - bounds.south) * 110540,
    (bounds.north - lat) * 110540,
  );
  const t = Math.max(0, Math.min(1, distance / 600));
  return t * t * (3 - 2 * t);
}
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const lon = bounds.west + ((x + 0.5) / width) * (bounds.east - bounds.west),
      lat = bounds.north - ((y + 0.5) / height) * (bounds.north - bounds.south);
    const [east, north] = project(lon, lat),
      u = (east - ox) / rx - window[0] - 0.5,
      v = (north - oy) / ry - window[1] - 0.5;
    const a = Math.floor(u),
      b = Math.floor(v),
      fx = u - a,
      fy = v - b;
    if (a < 0 || b < 0 || a + 1 >= rw || b + 1 >= rh)
      throw Error("Resample outside range crop");
    for (let c = 0; c < 3; c++)
      pixels[(y * width + x) * 4 + c] = Math.round(
        (raster[(b * rw + a) * 3 + c] * (1 - fx) +
          raster[(b * rw + a + 1) * 3 + c] * fx) *
          (1 - fy) +
          (raster[((b + 1) * rw + a) * 3 + c] * (1 - fx) +
            raster[((b + 1) * rw + a + 1) * 3 + c] * fx) *
            fy,
      );
    const index = (y * width + x) * 4;
    pixels[index + 3] =
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1 ||
      pixels[index] + pixels[index + 1] + pixels[index + 2] === 0
        ? 0
        : Math.round(255 * coverage(lon, lat));
  }
const texture = "public/textures/north-shore-dem/sentinel-2024.webp";
await fs.mkdir("public/textures/north-shore-dem", { recursive: true });
const image = await sharp(pixels, { raw: { width, height, channels: 4 } })
  .webp({ quality: 92, alphaQuality: 100 })
  .toBuffer();
records.sort(
  (a, b) =>
    Number(a.range.split("=")[1].split("-")[0]) -
    Number(b.range.split("=")[1].split("-")[0]),
);
const meta = {
  version: 1,
  year: 2024,
  scene: "S2A_10UDV_20240830_0_L2A",
  datetime: "2024-08-30T19:30:53.893Z",
  cloudCoverPercent: 0.002077,
  url,
  bounds,
  width,
  height,
  projection: "EPSG:4326 north-up, pixel-centre resampling from EPSG:32610",
  footprint,
  edgeBlendMetres: 600,
  overview: index,
  sourceResolution: [rx, ry],
  sourceWindow: window,
  utmBox: box,
  rangeBytesUsed: records.reduce((n, r) => n + r.bytes, 0),
  ranges: records,
  licence: "Copernicus Sentinel Data legal notice",
  licenceUrl:
    "https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice",
  attribution:
    "Contains modified Copernicus Sentinel data 2024. Sentinel-2 Cloud-Optimized GeoTIFFs via Element 84 / AWS Open Data.",
  description:
    "Georeferenced satellite-derived colour, not measured albedo; baked lighting retained. Nodata and source/crop edges blend to neutral material; no invented coverage.",
  texture,
  textureBytes: image.length,
  textureSha256: crypto.createHash("sha256").update(image).digest("hex"),
};
const metadata = "src/world/north-shore-imagery-data.json",
  serialized = JSON.stringify(meta, null, 2) + "\n";
if (process.argv.includes("--verify")) {
  if (
    (await fs.readFile(metadata, "utf8")) !== serialized ||
    !image.equals(await fs.readFile(texture))
  )
    throw Error("Derivative mismatch");
} else {
  await fs.writeFile(texture, image);
  await fs.writeFile(metadata, serialized);
  await fs.writeFile(
    "public/textures/north-shore-dem/SOURCES.json",
    serialized,
  );
}
console.log(
  JSON.stringify({
    ...meta,
    ranges: records.length,
    downloadedBytes: transferred,
  }),
);
