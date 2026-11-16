import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Offline derivative of the already committed CC0 granite photograph. Keep the
// same joint-free crop and mirror registration as landmarks/mineral-normal.
const input = "public/textures/harbour-green/granite_tile-color.webp";
const reference = "public/textures/landmarks/mineral-color.webp";
const directory = "public/textures/pacific-coast";
const outputFile = "textures/pacific-coast/mineral-color.webp";
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const inputBytes = await fs.readFile(input);
const referenceBytes = await fs.readFile(reference);
if (
  hash(inputBytes) !==
    "8ed283cda936258cb70c1e469ef05558ffea6845fb37d3118f96723f4c7f2375" ||
  hash(referenceBytes) !==
    "9bc5467d9b00d9d11aeb63d8bf78db144acf121cc81e173d9bcb049bc9faeae3"
)
  throw Error("325 Howe mineral source or mean-reference hash changed");
const manifest = JSON.parse(
  await fs.readFile("public/textures/harbour-green/SOURCES.json", "utf8"),
);
const source = manifest.find((entry) => `public/${entry.file}` === input);
if (source?.license !== "CC0-1.0")
  throw Error("325 Howe mineral requires the recorded CC0 source");

const linear = (value) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const encode = (value) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
const luminances = (data, channels) => {
  const values = new Float64Array(data.length / channels);
  for (let i = 0; i < values.length; i++)
    values[i] =
      0.2126 * linear(data[i * channels] / 255) +
      0.7152 * linear(data[i * channels + 1] / 255) +
      0.0722 * linear(data[i * channels + 2] / 255);
  return values;
};
const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const crop = { left: 32, top: 32, width: 448, height: 448 };
const { data, info } = await sharp(inputBytes)
  .extract(crop)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const referencePixels = await sharp(referenceBytes)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const sourceLuminance = luminances(data, info.channels);
const sourceMean = mean(sourceLuminance);
const targetMean = mean(
  luminances(referencePixels.data, referencePixels.info.channels),
);
// Preserve the source ordering and spatial grain, with a smooth ±8% bound in
// linear light. Recenter this restrained modulation around the previous mean.
const modulation = sourceLuminance.map(
  (value) => 1 + 0.08 * Math.tanh((value / sourceMean - 1) / 0.08),
);
const modulationMean = mean(modulation);
const side = crop.width * 2;
const mirrored = Buffer.alloc(side * side * 3);
for (let y = 0; y < side; y++)
  for (let x = 0; x < side; x++) {
    const sx = x >= crop.width ? side - x - 1 : x;
    const sy = y >= crop.height ? side - y - 1 : y;
    const value = Math.round(
      255 *
        encode(
          (targetMean * modulation[sy * crop.width + sx]) / modulationMean,
        ),
    );
    mirrored.fill(value, (y * side + x) * 3, (y * side + x) * 3 + 3);
  }
await fs.mkdir(directory, { recursive: true });
await sharp(mirrored, { raw: { width: side, height: side, channels: 3 } })
  .resize(512, 512)
  .webp({ quality: 96 })
  .toFile(`public/${outputFile}`);
const output = await fs.readFile(`public/${outputFile}`);
const decoded = await sharp(output).raw().toBuffer({ resolveWithObject: true });
const stats = await sharp(output).stats();
const provenance = {
  title: "325 Howe restrained mineral albedo",
  source: source.source,
  download: source.download,
  authors: source.authors,
  license: source.license,
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  input,
  inputSha256: hash(inputBytes),
  meanReference: reference,
  meanReferenceSha256: hash(referenceBytes),
  crop,
  sourceDimensionsMetres: source.dimensionsMetres,
  mirroredSourceSpanMetres: (source.dimensionsMetres[0] * side) / 2048,
  runtimeRepeatMetres: [0.85, 0.85],
  changes:
    "Existing converted CC0 granite diffuse, not a Vancouver stone scan. Joint-free crop mirrored in registration with the existing landmark mineral normal. Original-relative linear luminance is smoothly bounded to +/-8% then mean-normalized to the previous albedo. Neutral sRGB output resized to 512px WebP quality96. No downloads, reference-photo texture, generated dirt, new normal or roughness map.",
  preparation: "node scripts/prepare-pacific-coast-mineral.mjs",
  file: outputFile,
  outputSha256: hash(output),
  bytes: output.length,
  decoded: {
    width: decoded.info.width,
    height: decoded.info.height,
    channels: decoded.info.channels,
    targetMeanLinear: targetMean,
    meanLinear: mean(luminances(decoded.data, decoded.info.channels)),
    meanByte: stats.channels[0].mean,
    stdevByte: stats.channels[0].stdev,
    rangeByte: [stats.channels[0].min, stats.channels[0].max],
  },
};
await fs.writeFile(
  `${directory}/SOURCES.json`,
  JSON.stringify(provenance, null, 2) + "\n",
);
console.log(JSON.stringify(provenance, null, 2));
