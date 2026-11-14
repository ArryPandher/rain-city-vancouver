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
// Preserve leaf silhouettes individually. Global decimation erased small leaves.
const leafParts = [];
for (const mesh of doc.getRoot().listMeshes())
  for (const primitive of [...mesh.listPrimitives()]) {
    if (!primitive.getMaterial()?.getName().includes("leaves")) continue;
    const positions = primitive.getAttribute("POSITION").getArray(),
      normals = primitive.getAttribute("NORMAL").getArray(),
      uvs = primitive.getAttribute("TEXCOORD_0").getArray();
    const indices = primitive.getIndices().getArray(),
      count = positions.length / 3;
    const parents = Int32Array.from({ length: count }, (_, i) => i);
    const find = (i) => {
      while (parents[i] !== i) {
        parents[i] = parents[parents[i]];
        i = parents[i];
      }
      return i;
    };
    for (let i = 0; i < indices.length; i += 3) {
      const root = find(indices[i]);
      parents[find(indices[i + 1])] = root;
      parents[find(indices[i + 2])] = root;
    }
    const components = new Map();
    for (let i = 0; i < count; i++) {
      const root = find(i);
      let group = components.get(root);
      if (!group) components.set(root, (group = []));
      group.push(i);
    }
    const cross = (o, a, b) =>
      (uvs[a * 2] - uvs[o * 2]) * (uvs[b * 2 + 1] - uvs[o * 2 + 1]) -
      (uvs[a * 2 + 1] - uvs[o * 2 + 1]) * (uvs[b * 2] - uvs[o * 2]);
    const outP = [],
      outN = [],
      outUV = [],
      outI = [];
    let component = 0;
    for (const points of components.values()) {
      if (component++ % 3 === 0) continue;
      points.sort(
        (a, b) => uvs[a * 2] - uvs[b * 2] || uvs[a * 2 + 1] - uvs[b * 2 + 1],
      );
      const lower = [],
        upper = [];
      for (const p of points) {
        while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0)
          lower.pop();
        lower.push(p);
      }
      for (const p of points.reverse()) {
        while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0)
          upper.pop();
        upper.push(p);
      }
      let hull = lower.slice(0, -1).concat(upper.slice(0, -1));
      if (hull.length < 3) continue;
      if (hull.length > 8)
        hull = Array.from(
          { length: 8 },
          (_, i) => hull[Math.floor((i * hull.length) / 8)],
        );
      const base = outP.length / 3;
      for (const i of hull) {
        outP.push(...positions.subarray(i * 3, i * 3 + 3));
        outN.push(...normals.subarray(i * 3, i * 3 + 3));
        outUV.push(...uvs.subarray(i * 2, i * 2 + 2));
      }
      for (let i = 1; i < hull.length - 1; i++)
        outI.push(base, base + i, base + i + 1);
    }
    const buffer = doc.getRoot().listBuffers()[0];
    const acc = (type, data) =>
      doc.createAccessor().setType(type).setArray(data).setBuffer(buffer);
    primitive
      .setAttribute("POSITION", acc("VEC3", new Float32Array(outP)))
      .setAttribute("NORMAL", acc("VEC3", new Float32Array(outN)))
      .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(outUV)))
      .setIndices(acc("SCALAR", new Uint32Array(outI)));
    primitive.setAttribute("TEXCOORD_1", null);
    primitive.getMaterial().setAlphaMode("OPAQUE").setDoubleSided(true);
    mesh.removePrimitive(primitive);
    leafParts.push([mesh, primitive]);
    console.log("Preserved leaf triangles", outI.length / 3);
  }
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.045, error: 0.025 }),
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
        "Leaf-by-leaf silhouette reduction, branch simplification and WebP texture conversion; near-field instancing in Rain City.",
    },
    null,
    2,
  ),
);
