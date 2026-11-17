// Reuse existing licensed maps only: no downloads or generated plant imagery.
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const doc = await new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .read("public/models/forest/shrub_04.glb");
const material = doc.getRoot().listMaterials()[0],
  rows = [];
await fs.mkdir("public/textures/gallery-hedge", { recursive: true });
for (const [name, texture] of [
  ["color", material.getBaseColorTexture()],
  ["normal", material.getNormalTexture()],
]) {
  const file = `textures/gallery-hedge/${name}.webp`,
    source = texture.getImage();
  const dense = `public/textures/coastal/leaf-cover-${name}.webp`;
  const parts = await Promise.all([
    sharp(source).resize(512, 512).ensureAlpha().raw().toBuffer(),
    sharp(dense).resize(512, 512).ensureAlpha().raw().toBuffer(),
  ]);
  const atlas = Buffer.alloc(1024 * 512 * 4);
  for (let y = 0; y < 512; y++)
    for (let i = 0; i < 2; i++)
      parts[i].copy(
        atlas,
        (y * 1024 + i * 512) * 4,
        y * 512 * 4,
        (y + 1) * 512 * 4,
      );
  const bytes = await sharp(atlas, {
    raw: { width: 1024, height: 512, channels: 4 },
  })
    .webp({ lossless: true })
    .toBuffer();
  await fs.writeFile(`public/${file}`, bytes);
  rows.push({
    file,
    source: "https://polyhaven.com/a/shrub_04",
    author: "Rico Cilliers",
    license: "CC0-1.0",
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    inputs: ["public/models/forest/shrub_04.glb", dense],
    changes:
      "1024x512 atlas: original retained leaf map resampled into left512px; existing dense coastal leaf tile into right512px. Edge geometry uses only five green leaf regions. No recoloring in this image; shader tint/leaf size are documented authored calibration.",
  });
}
await fs.writeFile(
  "public/textures/gallery-hedge/SOURCES.json",
  JSON.stringify(rows, null, 2) + "\n",
);
