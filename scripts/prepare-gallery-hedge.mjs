// Re-extract only the retained licensed maps, without re-encoding or downloads.
import fs from "node:fs/promises";
import crypto from "node:crypto";
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
    bytes = texture.getImage();
  await fs.writeFile(`public/${file}`, bytes);
  rows.push({
    file,
    source: "https://polyhaven.com/a/shrub_04",
    author: "Rico Cilliers",
    license: "CC0-1.0",
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    changes:
      "Byte-identical embedded texture extracted from retained shrub_04.glb; seven individual leaf regions reused. No species identity asserted.",
  });
}
await fs.writeFile(
  "public/textures/gallery-hedge/SOURCES.json",
  JSON.stringify(rows, null, 2) + "\n",
);
