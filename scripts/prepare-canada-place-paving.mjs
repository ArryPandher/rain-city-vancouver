import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const target = "public/textures/canada-place-paving";
const sources = [
  {
    kind: "color",
    id: "diff",
    md5: "5dfd6dbdb5c0b22ca04505c6209cea9f",
    bytes: 676597,
  },
  {
    kind: "normal",
    id: "nor_gl",
    md5: "e9053333e3db348d10466a781456ec58",
    bytes: 592362,
  },
  {
    kind: "roughness",
    id: "rough",
    md5: "fd4d40cbc28323260038eedb43bc6ff8",
    bytes: 674755,
  },
];
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encoded = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
await fs.mkdir(target, { recursive: true });
const old = await sharp("public/textures/landmarks/mineral-color.webp")
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let oldMean = 0;
for (let i = 0; i < old.data.length; i += old.info.channels)
  oldMean += linear(old.data[i] / 255);
oldMean /= old.info.width * old.info.height;
for (const item of sources) {
  const url = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/granite_tile/granite_tile_${item.id}_1k.jpg`;
  const cache = "/tmp/rain-city-canada-paving-source";
  await fs.mkdir(cache, { recursive: true });
  let raw;
  try {
    raw = await fs.readFile(`${cache}/${item.id}.jpg`);
  } catch {
    const response = await fetch(url);
    if (!response.ok) throw Error(`${response.status}: ${url}`);
    raw = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(`${cache}/${item.id}.jpg`, raw);
  }
  if (
    raw.length !== item.bytes ||
    createHash("md5").update(raw).digest("hex") !== item.md5
  )
    throw Error(`Source changed: ${url}`);
  const { data, info } = await sharp(raw)
    .removeAlpha()
    .extract({ left: 12, top: 12, width: 180, height: 180 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const count = info.width * info.height,
    values = Array.from(
      { length: count },
      (_, i) =>
        (data[i * info.channels] +
          data[i * info.channels + 1] +
          data[i * info.channels + 2]) /
        3,
    );
  const mean = values.reduce((s, v) => s + v, 0) / count;
  let shift = 0;
  if (item.kind === "color") {
    // Recover actual source grain, NOT amplified compression from the facade map.
    // Bounded +/-20% linear modulation keeps quiet mineral tones and the old mean.
    const adjusted = values.map(
      (v) =>
        oldMean *
        Math.max(0.8, Math.min(1.2, linear(v / 255) / linear(mean / 255))),
    );
    shift = oldMean - adjusted.reduce((s, v) => s + v, 0) / count;
    for (let i = 0; i < count; i++)
      values[i] = Math.round(
        encoded(Math.max(0, Math.min(1, adjusted[i] + shift))) * 255,
      );
  }
  const out = Buffer.alloc(360 * 360 * 3);
  for (let y = 0; y < 360; y++)
    for (let x = 0; x < 360; x++) {
      const flipX = x >= 180,
        flipY = y >= 180,
        sx = flipX ? 359 - x : x,
        sy = flipY ? 359 - y : y,
        i = sy * 180 + sx;
      for (let c = 0; c < 3; c++) {
        let v = data[i * info.channels + c];
        if (item.kind === "color") v = values[i];
        if (item.kind === "roughness")
          v = Math.round(
            Math.max(
              0.75,
              Math.min(0.85, 0.8 + ((values[i] - mean) / 255) * 0.25),
            ) * 255,
          );
        if (
          item.kind === "normal" &&
          ((c === 0 && flipX) || (c === 1 && flipY))
        )
          v = 255 - v;
        out[(y * 360 + x) * 3 + c] = v;
      }
    }
  const file = `${item.kind}.webp`;
  await sharp(out, { raw: { width: 360, height: 360, channels: 3 } })
    .resize(512, 512)
    .webp({ quality: item.kind === "normal" ? 98 : 96 })
    .toFile(`${target}/${file}`);
  item.source = url;
  item.file = `textures/canada-place-paving/${file}`;
  item.outputBytes = (await fs.stat(`${target}/${file}`)).size;
  console.log(item.kind, item.outputBytes);
}
await fs.writeFile(
  `${target}/SOURCES.json`,
  JSON.stringify(
    {
      asset: "Granite Tile",
      author: "Charlotte Baglioni / Poly Haven",
      source: "https://polyhaven.com/a/granite_tile",
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      downloadBudgetBytes: 1943714,
      targetLinearColorMean: oldMean,
      changes:
        "One joint-free tile face cropped from original 1K maps and mirrored with normal R/G signs corrected. Original granular albedo modulation retained within ±20% and matched to previous floor mean; roughness recalibrated to 0.75–0.85. 512px WebP maps. Generic mineral reference, not a Vancouver paving scan.",
      sources,
    },
    null,
    2,
  ) + "\n",
);
