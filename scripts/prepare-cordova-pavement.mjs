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
  const cropMean = means(region.data, region.info.channels, kind === "color");
  const side = crop.width * 2;
  const output = Buffer.alloc(side * side * 3);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const flipX = x >= crop.width,
        flipY = y >= crop.height;
      const sx = flipX ? side - x - 1 : x,
        sy = flipY ? side - y - 1 : y;
      for (let c = 0; c < 3; c++) {
        let value =
          region.data[
            (sy * crop.width + sx) * region.info.channels +
              Math.min(c, region.info.channels - 1)
          ];
        if (kind === "color")
          value = Math.round(
            255 *
              encode(
                clamp((linear(value / 255) * targetMean[c]) / cropMean[c]),
              ),
          );
        if (kind === "roughness")
          value = Math.round(
            255 * clamp(value / 255 + targetMean[c] - cropMean[c]),
          );
        if (kind === "normal" && ((c === 0 && flipX) || (c === 1 && flipY)))
          value = 255 - value;
        output[(y * side + x) * 3 + c] = value;
      }
    }
  const file = `textures/cordova-pavement/${kind}.webp`;
  await sharp(output, { raw: { width: side, height: side, channels: 3 } })
    .resize(512, 512)
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
  scaleInterpretation:
    "Visual aggregate scale estimate; the committed source manifest has no surveyed physical dimensions. The 600px mirrored source region repeats over 1.2m, approximately 2mm per source pixel before output resizing.",
  changes:
    "Matched existing 1K albedo/OpenGL-normal/roughness crop excludes the source's full-height cracks. Mirrored with normal R/G sign correction. Per-channel albedo linear means and linear roughness mean match the existing full source. 512px WebP triplet; no invented repair seam, generated grain, downloaded source, light or road geometry change.",
  preparation: "node scripts/prepare-cordova-pavement.mjs",
  roads: ["w50162809", "w232195213", "w1153403243", "w1255588459"],
  files,
};
await fs.writeFile(
  `${directory}/SOURCES.json`,
  JSON.stringify(provenance, null, 2) + "\n",
);
console.log(JSON.stringify(provenance, null, 2));
