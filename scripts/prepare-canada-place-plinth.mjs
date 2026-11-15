import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const source = JSON.parse(
  await fs.readFile("public/textures/cast-concrete/SOURCES.json", "utf8"),
);
const target = "public/textures/canada-place-plinth";
await fs.mkdir(target, { recursive: true });
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encode = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const files = [];
for (const kind of ["color", "normal", "roughness"]) {
  const input = `public/textures/cast-concrete/${kind}.jpg`;
  const bytes = await fs.readFile(input);
  if (createHash("md5").update(bytes).digest("hex") !== source.files[kind].md5)
    throw Error(`Committed concrete source changed: ${input}`);
  // This part of the middle cast panel excludes form joints and tie holes.
  const { data, info } = await sharp(bytes)
    .extract({ left: 300, top: 380, width: 200, height: 200 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const grey = Array.from(
    { length: 40000 },
    (_, i) =>
      (data[i * info.channels] +
        data[i * info.channels + 1] +
        data[i * info.channels + 2]) /
      (3 * 255),
  );
  const mean =
    grey.reduce((sum, value) => sum + linear(value), 0) / grey.length;
  const output = Buffer.alloc(400 * 400 * 3);
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 400; x++) {
      const flipX = x >= 200,
        flipY = y >= 200;
      const i = (flipY ? 399 - y : y) * 200 + (flipX ? 399 - x : x);
      for (let c = 0; c < 3; c++) {
        let value = data[i * info.channels + c];
        if (kind === "color")
          value = Math.round(
            255 *
              encode(
                0.82 * Math.max(0.92, Math.min(1.08, linear(grey[i]) / mean)),
              ),
          );
        if (kind === "roughness")
          value = Math.round(
            255 * Math.max(0.74, Math.min(0.86, 0.8 + (grey[i] - 0.5) * 0.08)),
          );
        if (kind === "normal" && ((c === 0 && flipX) || (c === 1 && flipY)))
          value = 255 - value;
        output[(y * 400 + x) * 3 + c] = value;
      }
    }
  const file = `textures/canada-place-plinth/${kind}.webp`;
  await sharp(output, { raw: { width: 400, height: 400, channels: 3 } })
    .resize(512, 512)
    .webp({ quality: 96 })
    .toFile(`public/${file}`);
  files.push({
    file,
    source: source.files[kind].url,
    inputMD5: source.files[kind].md5,
    bytes: (await fs.stat(`public/${file}`)).size,
  });
}
await fs.writeFile(
  `${target}/SOURCES.json`,
  JSON.stringify(
    {
      title: "Painted mineral surface for Canada Place protective plinths",
      source: source.source,
      author: "Charlotte Baglioni / Poly Haven",
      license: "CC0-1.0",
      licenseUrl: source.licenseUrl,
      changes:
        "Joint/tie-hole-free 200px crop at (300,380) from committed 1K concrete maps. Mirrored with normal-sign correction, neutralized restrained albedo modulation around linear0.82, roughness bounded0.74–0.86, compressed512pxWebP. Generic mineral texture, not a Vancouver scan. No new source downloads.",
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(files);
