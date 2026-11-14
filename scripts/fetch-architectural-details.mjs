import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  getBounds,
  prune,
  dedup,
  textureCompress,
  transformPrimitive,
} from "@gltf-transform/functions";
import sharp from "sharp";

const id = "modular_urban_apartments_facade";
const files = await (
  await fetch(`https://api.polyhaven.com/files/${id}`)
).json();
const model = files.gltf["1k"].gltf;
const dir = "artifacts/local/facade-source";
for (const [file, asset] of [
  ["facade.gltf", model],
  ...Object.entries(model.include),
]) {
  const dest = path.join(dir, file);
  if (await fs.stat(dest).catch(() => null)) continue;
  const response = await fetch(asset.url);
  if (!response.ok) throw Error(`${response.status}: ${asset.url}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await response.arrayBuffer()));
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(`${dir}/facade.gltf`);
const names = [
  "window_centered_small_01",
  "door_centered_small_01",
  "door_centered_small_02",
];
for (const node of [...document.getRoot().listNodes()])
  if (!names.includes(node.getName())) node.dispose();
for (const node of document.getRoot().listNodes()) {
  node.setTranslation([0, 0, 0]);
  const { min, max } = getBounds(node);
  const x = -(min[0] + max[0]) / 2,
    y = -min[1],
    z = -min[2] + 0.015;
  for (const primitive of node.getMesh().listPrimitives())
    transformPrimitive(primitive, [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      x,
      y,
      z,
      1,
    ]);
}
await document.transform(
  prune(),
  dedup(),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    resize: [1024, 1024],
  }),
);
await io.write("public/models/architectural-details.glb", document);
await fs.writeFile(
  "docs/sources/architectural-details.json",
  JSON.stringify(
    {
      title: "Modular Urban Apartments Facade",
      author: "James Ray Cock",
      source: `https://polyhaven.com/a/${id}`,
      download: model.url,
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      selectedParts: names,
      changes:
        "Extracted two doors and one window; normalized pivots, removed unused geometry/textures, converted textures to 1024 px WebP. Runtime bounded instancing, scaling and glass material adaptation.",
    },
    null,
    2,
  ) + "\n",
);
console.log("Prepared modeled residential doors and windows.");
