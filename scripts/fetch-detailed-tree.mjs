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
import { simplifyLeaves } from "./lib/street-leaves.mjs";
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
const medium = process.argv.includes("--medium");
const output = `public/models/vancouver-street-tree${medium ? "-medium" : ""}.glb`;
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
// Keep all source leaves. Simplify each surface in 3D and retain the source's
// normals and UVs; UV-space hulls reverse faces and erase folded leaf surfaces.
const leafParts = [];
let leafStats;
for (const mesh of doc.getRoot().listMeshes())
  for (const primitive of [...mesh.listPrimitives()]) {
    if (!primitive.getMaterial()?.getName().includes("leaves")) continue;
    const result = await simplifyLeaves(
      primitive,
      medium ? 6 : 12,
      medium ? 0.16 : 0.025,
    );
    leafStats = result.stats;
    const buffer = doc.getRoot().listBuffers()[0];
    const acc = (type, data) =>
      doc.createAccessor().setType(type).setArray(data).setBuffer(buffer);
    primitive
      .setAttribute("POSITION", acc("VEC3", result.positions))
      .setAttribute("NORMAL", acc("VEC3", result.normals))
      .setAttribute("TEXCOORD_0", acc("VEC2", result.uvs))
      .setIndices(acc("SCALAR", result.indices));
    primitive.setAttribute("TEXCOORD_1", null);
    primitive.getMaterial().setAlphaMode("OPAQUE").setDoubleSided(true);
    mesh.removePrimitive(primitive);
    leafParts.push([mesh, primitive]);
    console.log("Source-surface leaves", leafStats);
  }
await doc.transform(
  weld(),
  simplify({
    simplifier: MeshoptSimplifier,
    ratio: medium ? 0.06 : 0.12,
    error: medium ? 0.025 : 0.012,
  }),
);
for (const [mesh, primitive] of leafParts) mesh.addPrimitive(primitive);
await doc.transform(
  dedup(),
  prune(),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    resize: [1024, 1024],
  }),
);
await io.write(output, doc);
console.log("Optimized triangles", tri());
await fs.writeFile(
  `docs/sources/vancouver-street-tree${medium ? "-medium" : ""}.json`,
  JSON.stringify(
    {
      title: "Tree Small 02",
      author: "Poly Haven",
      source: "https://polyhaven.com/a/tree_small_02",
      download: model.url,
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      changes:
        "All 30,250 source leaves retained; per-leaf 3D surface simplification with original normals/UVs, corrected face winding, bounded branch simplification and WebP texture conversion. No UV hull reconstruction.",
      leafStats,
    },
    null,
    2,
  ),
);
