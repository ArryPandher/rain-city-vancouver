// Source-guided image-space mask refinement, not geographic terrain registration.
// No network calls; exact licensed original must already be available locally.
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
const sourcePath =
  process.argv.find((arg) => arg.endsWith(".JPG")) ??
  "artifacts/local/north-shore-horizon-refinement/North_shore_pan.JPG";
const verify = process.argv.includes("--verify");
const outputPath = "public/textures/vancouver/north-shore-ridge.webp";
const recordPath = "docs/sources/north-shore-photo-ridge.json";
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const original = fs.readFileSync(sourcePath);
const sourceSha =
  "3706fe1551a0d7e07aff6953e5b524daef59b153ff4a222a4003fb6e88b7611b";
if (sha(original) !== sourceSha) throw Error("Panorama source bytes changed");
const controls = JSON.parse(
  fs.readFileSync(
    "scripts/source-data/north-shore-ridge-controls.json",
    "utf8",
  ),
);
const { data, info } = await sharp(original)
  .resize(8192)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = info.width,
  h = info.height,
  scale = w / 1400;
if (w !== 8192 || h !== 982) throw Error("Unexpected source dimensions");
function prior(x) {
  const q = x / scale;
  let i = 0;
  while (i < controls.length - 2 && controls[i + 1][0] < q) i++;
  const [a, b] = [controls[i], controls[i + 1]];
  return (a[1] + ((b[1] - a[1]) * (q - a[0])) / (b[0] - a[0])) * scale;
}
const minY = 150,
  maxY = 650,
  n = maxY - minY + 1;
const back = new Int16Array(w * n);
let previous = new Float64Array(n).fill(Infinity),
  next = new Float64Array(n);
function luminance(x, y) {
  const i =
    (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 3;
  return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
}
for (let x = 0; x < w; x++) {
  next.fill(Infinity);
  const p = prior(x),
    overviewX = x / scale;
  // Visible cloud obscures a hard land/sky boundary here. Keep these explicitly
  // authored approximate envelopes instead of following the bottom of cloud bands.
  const cloudy =
    (overviewX >= 350 && overviewX <= 510) ||
    (overviewX >= 835 && overviewX <= 880);
  for (let j = 0; j < n; j++) {
    const y = j + minY;
    if (Math.abs(y - p) > 5 * scale) continue;
    const above =
      (luminance(x - 1, y - 3) +
        luminance(x, y - 3) +
        luminance(x + 1, y - 3)) /
      3;
    const below =
      (luminance(x - 1, y + 3) +
        luminance(x, y + 3) +
        luminance(x + 1, y + 3)) /
      3;
    const cost =
      -Math.log1p(Math.max(0, above - below)) * (cloudy ? 0.25 : 5) +
      Math.abs(y - p) / (cloudy ? 1 : 8);
    if (x === 0) {
      next[j] = cost;
      continue;
    }
    let best = Infinity,
      bestK = j;
    for (let k = Math.max(0, j - 5); k <= Math.min(n - 1, j + 5); k++) {
      const d = k - j,
        value = previous[k] + 0.1 * Math.abs(d) + 0.055 * d * d;
      if (value < best) {
        best = value;
        bestK = k;
      }
    }
    next[j] = best + cost;
    back[x * n + j] = bestK;
  }
  [previous, next] = [next, previous];
}
let j = 0;
for (let k = 1; k < n; k++) if (previous[k] < previous[j]) j = k;
const ridge = new Array(w);
for (let x = w - 1; x >= 0; x--) {
  ridge[x] = j + minY;
  j = back[x * n + j];
}
const clamp = (v) => Math.max(0, Math.min(1, v));
const rgba = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const i = y * w + x;
    data.copy(rgba, i * 4, i * 3, i * 3 + 3);
    // Same existing bottom22overview-pixel fade and160source-pixel side fades.
    const alpha =
      clamp((y - ridge[x] + 1) / 2) *
      clamp((148 * scale - y) / (22 * scale)) *
      clamp(x / 160) *
      clamp((8191 - x) / 160);
    rgba[i * 4 + 3] = Math.floor(alpha * 255);
  }
const encoded = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
  .webp({ quality: 92, alphaQuality: 100 })
  .toBuffer();
const record = {
  version: 1,
  source:
    "https://upload.wikimedia.org/wikipedia/commons/7/71/North_shore_pan.JPG",
  sourceSha256: sourceSha,
  sourceBytes: original.length,
  author: "Selmo",
  license: "CC BY-SA 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  sourceView: "Canada Place, 2007; not a calibrated Ironworkers viewpoint",
  changes:
    "Source-guided dense ridge alpha with manually constrained low-contrast cloud intervals; original photographic colour, snow and baked lighting retained. Existing bottom/side fade formulas retained. No terrain projection or invented heights.",
  width: w,
  height: h,
  output: outputPath,
  outputBytes: encoded.length,
  outputSha256: sha(encoded),
  controlsOverviewWidth: 1400,
  controls,
  cloudyOverviewIntervals: [
    [350, 510],
    [835, 880],
  ],
  ridge,
};
const recordText = JSON.stringify(record) + "\n";
if (verify) {
  if (!encoded.equals(fs.readFileSync(outputPath)))
    throw Error("Derivative bytes differ");
  if (recordText !== fs.readFileSync(recordPath, "utf8"))
    throw Error("Trace record differs");
  console.log("Verified exact panorama derivative and source-guided trace");
} else {
  fs.writeFileSync(outputPath, encoded);
  fs.writeFileSync(recordPath, recordText);
  console.log(
    JSON.stringify({
      output: outputPath,
      bytes: encoded.length,
      sha256: sha(encoded),
      columns: ridge.length,
    }),
  );
}
