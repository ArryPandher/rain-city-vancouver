import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Offline, matched CC0 photograph crop. The source's two strong full-height
// cracks fall outside this region; no repair line or procedural grain is added.
const directory = "public/textures/cordova-pavement";
const crop = { left: 205, top: 45, width: 300, height: 300 };
const sourceHashes = {
  color: "1aa5ce99f58a625c71d48cfc3e68b65ca85ccb00f39e045c0a928608a0ea25ed",
  normal: "42a1c381b53204e83a982db2864479a30bc127bbdeebb1006f8ee51bff099df3",
  roughness: "70ba3edc65525eb4dc366cf010ca7ae0bd34e0251ff0225c2dad627a873d0712",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encode = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const clamp = (v) => Math.max(0, Math.min(1, v));
const means = (data, channels, color) => {
  const result = [0, 0, 0];
  for (let i = 0; i < data.length; i += channels)
    for (let c = 0; c < 3; c++) {
      const value = data[i + Math.min(c, channels - 1)] / 255;
      result[c] += color ? linear(value) : value;
    }
  return result.map((v) => v / (data.length / channels));
};
// Remove only photographed broad gradients before mirroring. A 16px sigma is
// ~32mm at the documented source scale, larger than the fine aggregate grains.
// The residual is never multiplied: no contrast/noise amplification is applied.
const gradientSigmaPixels = 16;
const broadGradient = (values, width, height) => {
  const radius = Math.ceil(gradientSigmaPixels * 3);
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, i) =>
    Math.exp(-((i - radius) ** 2) / (2 * gradientSigmaPixels ** 2)),
  );
  const sum = kernel.reduce((a, b) => a + b, 0);
  kernel.forEach((value, i) => (kernel[i] = value / sum));
  const reflect = (i, size) => {
    while (i < 0 || i >= size) i = i < 0 ? -i - 1 : 2 * size - i - 1;
    return i;
  };
  const temporary = new Float64Array(values.length);
  const output = new Float64Array(values.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 3; c++) {
        let value = 0;
        for (let k = -radius; k <= radius; k++)
          value += values[(y * width + reflect(x + k, width)) * 3 + c] * kernel[k + radius];
        temporary[(y * width + x) * 3 + c] = value;
      }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 3; c++) {
        let value = 0;
        for (let k = -radius; k <= radius; k++)
          value += temporary[(reflect(y + k, height) * width + x) * 3 + c] * kernel[k + radius];
        output[(y * width + x) * 3 + c] = value;
      }
  return output;
};
const flattenCrop = (region, kind, targetMean) => {
  const { width, height, channels } = region.info;
  const values = new Float64Array(width * height * 3);
  for (let i = 0; i < width * height; i++)
    for (let c = 0; c < 3; c++) {
      const value = region.data[i * channels + Math.min(c, channels - 1)] / 255;
      values[i * 3 + c] = kind === "color" ? linear(value) : value;
    }
  const gradient = broadGradient(values, width, height);
  const centered = new Float64Array(values.length);
  const residualMean = [0, 0, 0];
  for (let i = 0; i < values.length; i++) {
    centered[i] = values[i] - gradient[i];
    residualMean[i % 3] += centered[i] / (width * height);
  }
  let clipped = 0;
  for (let i = 0; i < centered.length; i++) {
    const c = i % 3;
    const value = centered[i] - residualMean[c] + (kind === "normal" ? 0.5 : targetMean[c]);
    if (kind !== "normal" && (value < 0 || value > 1)) clipped++;
    centered[i] = clamp(value);
  }
  if (kind === "normal")
    for (let i = 0; i < centered.length; i += 3) {
      let nx = 2 * centered[i] - 1, ny = 2 * centered[i + 1] - 1;
      const xy = nx * nx + ny * ny;
      if (xy > 1) { nx /= Math.sqrt(xy); ny /= Math.sqrt(xy); }
      centered[i] = nx * 0.5 + 0.5;
      centered[i + 1] = ny * 0.5 + 0.5;
      centered[i + 2] = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.5 + 0.5;
    }
  return { data: centered, clipped };
};
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.mkdir(directory, { recursive: true });
const files = [];
for (const kind of ["color", "normal", "roughness"]) {
  const input = `public/textures/asphalt_02-${kind}.jpg`;
  const bytes = await fs.readFile(input);
  if (hash(bytes) !== sourceHashes[kind])
    throw Error(`Asphalt source changed: ${input}`);
  const source = manifest.find((entry) => `public/${entry.file}` === input);
  if (!source || !/^CC0(?:-1\.0)?$/.test(source.license))
    throw Error(`Missing existing CC0 source record: ${input}`);
  const full = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const region = await sharp(bytes)
    .extract(crop)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const targetMean = means(full.data, full.info.channels, kind === "color");
  const flattened = flattenCrop(region, kind, targetMean);
  const side = crop.width * 2;
  const output = Buffer.alloc(side * side * 3);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const flipX = x >= crop.width,
        flipY = y >= crop.height;
      const sx = flipX ? side - x - 1 : x,
        sy = flipY ? side - y - 1 : y;
      for (let c = 0; c < 3; c++) {
        let value = flattened.data[(sy * crop.width + sx) * 3 + c];
        value = Math.round(255 * (kind === "color" ? encode(value) : value));
        if (kind === "normal" && ((c === 0 && flipX) || (c === 1 && flipY)))
          value = 255 - value;
        output[(y * side + x) * 3 + c] = value;
      }
    }
  const file = `textures/cordova-pavement/${kind}.webp`;
  const resized = await sharp(output, { raw: { width: side, height: side, channels: 3 } })
    .resize(512, 512)
    .raw()
    .toBuffer();
  // Resampling encoded sRGB can lower the linear mean. Recenter after resize
  // with an additive correction, retaining the residual's unity gain.
  if (kind !== "normal") {
    const resizedMean = means(resized, 3, kind === "color");
    for (let i = 0; i < resized.length; i++) {
      const value = kind === "color" ? linear(resized[i] / 255) : resized[i] / 255;
      const corrected = clamp(value + targetMean[i % 3] - resizedMean[i % 3]);
      resized[i] = Math.round(255 * (kind === "color" ? encode(corrected) : corrected));
    }
  }
  await sharp(resized, { raw: { width: 512, height: 512, channels: 3 } })
    .webp({ quality: kind === "normal" ? 98 : 96 })
    .toFile(`public/${file}`);
  const encoded = await fs.readFile(`public/${file}`);
  const decoded = await sharp(encoded)
    .raw()
    .toBuffer({ resolveWithObject: true });
  files.push({
    kind,
    file,
    source: source.source,
    credit: source.credit,
    input,
    inputSha256: hash(bytes),
    outputSha256: hash(encoded),
    bytes: encoded.length,
    preparationClippedChannels: flattened.clipped,
    decoded: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: decoded.info.channels,
      mean: means(decoded.data, decoded.info.channels, kind === "color"),
      targetMean: kind === "normal" ? undefined : targetMean,
      meanConvention: kind === "color" ? "linear RGB" : "linear data",
    },
  });
}
const provenance = {
  title: "Howe/Cordova local road aggregate",
  source: "https://polyhaven.com/a/asphalt_02",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  credit: "Poly Haven",
  crop,
  runtimeRepeatMetres: [1.2, 1.2],
  broadGradientRemoval: {
    gaussianSigmaSourcePixels: gradientSigmaPixels,
    gaussianRadiusSourcePixels: gradientSigmaPixels * 3,
    estimatedSigmaMetres: gradientSigmaPixels * 0.002,
    treatment: "Subtract reflected-boundary Gaussian gradient in linear albedo/data space before mirroring; retain fine residual at unity gain, recenter albedo and roughness to original full-source means. Remove normal XY broad tilt, recenter XY to neutral, rebuild unit normal Z. No generated texture detail.",
  },
  scaleInterpretation:
    "Visual aggregate scale estimate; the committed source manifest has no surveyed physical dimensions. The 600px mirrored source region repeats over 1.2m, approximately 2mm per source pixel before output resizing.",
  changes:
    "Matched existing 1K albedo/OpenGL-normal/roughness crop excludes the source's full-height cracks. Broad source gradients removed before mirroring to prevent repeated dark bands; fine aggregate amplitude is unchanged. Mirrored with normal R/G sign correction. Per-channel albedo linear means and linear roughness mean match the existing full source. 512px WebP triplet; no invented repair seam, generated grain, downloaded source, light or road geometry change.",
  preparation: "node scripts/prepare-cordova-pavement.mjs",
  roads: ["w50162809", "w232195213", "w1153403243", "w1255588459"],
  files,
};
await fs.writeFile(
  `${directory}/SOURCES.json`,
  JSON.stringify(provenance, null, 2) + "\n",
);
console.log(JSON.stringify(provenance, null, 2));
