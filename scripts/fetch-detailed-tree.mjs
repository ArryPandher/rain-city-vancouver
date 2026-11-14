import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  weld,
  simplify,
  dedup,
  prune,
  textureCompress,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
const id = "tree_small_02";
const info = await (
  await fetch(`https://api.polyhaven.com/files/${id}`)
).json();
const model = info.gltf["1k"].gltf;
const dir = "artifacts/local/tree-source";
await fs.mkdir(dir, { recursive: true });
for (const [file, asset] of [
  ["tree.gltf", model],
  ...Object.entries(model.include),
]) {
  const dest = path.join(dir, file);
  if (await fs.stat(dest).catch(() => null)) continue;
  const r = await fetch(asset.url);
  if (!r.ok) throw Error(r.status + " " + asset.url);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(dir + "/tree.gltf");
const tri = () =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce(
      (n, p) =>
        n +
        (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) /
          3,
      0,
    );
console.log("Source triangles", tri());
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.012, error: 0.08 }),
  dedup(),
  prune(),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    resize: [1024, 1024],
  }),
);
await io.write("public/models/vancouver-street-tree.glb", doc);
console.log("Optimized triangles", tri());
await fs.writeFile(
  "docs/sources/vancouver-street-tree.json",
  JSON.stringify(
    {
      title: "Tree Small 02",
      author: "Poly Haven",
      source: "https://polyhaven.com/a/tree_small_02",
      download: model.url,
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      changes:
        "Mesh simplification and WebP texture conversion; near-field instancing in Rain City.",
    },
    null,
    2,
  ),
);
