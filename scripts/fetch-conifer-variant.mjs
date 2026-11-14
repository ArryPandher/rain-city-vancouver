import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, textureCompress } from "@gltf-transform/functions";
import sharp from "sharp";

// Run fetch-forest-assets.mjs first for the shared source metadata and 1K textures.
const dir = "artifacts/local/forest-source/fir_tree_01";
const g = JSON.parse(await fs.readFile(`${dir}/source.gltf`, "utf8"));
const mesh = g.meshes[1];
const accessors = [
  ...new Set(
    mesh.primitives.flatMap((p) => [p.indices, ...Object.values(p.attributes)]),
  ),
];
const views = [...new Set(accessors.map((i) => g.accessors[i].bufferView))];
const start = Math.min(...views.map((i) => g.bufferViews[i].byteOffset || 0));
const end = Math.max(
  ...views.map(
    (i) => (g.bufferViews[i].byteOffset || 0) + g.bufferViews[i].byteLength,
  ),
);
if (!(await fs.stat(`${dir}/variant-b.bin`).catch(() => null))) {
  const info = await (
    await fetch("https://api.polyhaven.com/files/fir_tree_01")
  ).json();
  const url = info.gltf["1k"].gltf.include["fir_tree_01.bin"].url;
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end - 1}` },
  });
  if (response.status !== 206) {
    await response.body?.cancel();
    throw Error(`Expected ranged download: ${response.status}`);
  }
  await fs.writeFile(
    `${dir}/variant-b.bin`,
    Buffer.from(await response.arrayBuffer()),
  );
}
if ((await fs.stat(`${dir}/variant-b.bin`)).size !== end - start)
  throw Error("Incomplete variant B buffer");
g.accessors = accessors.map((i) => ({
  ...g.accessors[i],
  bufferView: views.indexOf(g.accessors[i].bufferView),
}));
g.bufferViews = views.map((i) => ({
  ...g.bufferViews[i],
  buffer: 0,
  byteOffset: (g.bufferViews[i].byteOffset || 0) - start,
}));
for (const p of mesh.primitives) {
  p.indices = accessors.indexOf(p.indices);
  for (const k in p.attributes)
    p.attributes[k] = accessors.indexOf(p.attributes[k]);
}
g.meshes = [mesh];
g.nodes = [{ mesh: 0 }];
g.scenes = [{ nodes: [0] }];
g.scene = 0;
g.buffers = [{ uri: "variant-b.bin", byteLength: end - start }];
await fs.writeFile(`${dir}/variant-b.gltf`, JSON.stringify(g));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read(`${dir}/variant-b.gltf`);
const mask = await sharp(`${dir}/alpha-source`)
  .resize(1024, 1024)
  .greyscale()
  .raw()
  .toBuffer();
for (const mat of doc.getRoot().listMaterials()) {
  if (!mat.getName().includes("twig")) continue;
  const tex = mat.getBaseColorTexture();
  const rgb = await sharp(tex.getImage())
    .resize(1024, 1024)
    .removeAlpha()
    .raw()
    .toBuffer();
  tex
    .setImage(
      await sharp(rgb, { raw: { width: 1024, height: 1024, channels: 3 } })
        .joinChannel(mask, { raw: { width: 1024, height: 1024, channels: 1 } })
        .png()
        .toBuffer(),
    )
    .setMimeType("image/png");
  mat.setAlphaMode("MASK").setAlphaCutoff(0.42).setDoubleSided(true);
}
for (const p of doc
  .getRoot()
  .listMeshes()
  .flatMap((m) => m.listPrimitives())) {
  if (p.getAttribute("TEXCOORD_0")) continue;
  const pos = p.getAttribute("POSITION").getArray(),
    uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    uv[i * 2] = Math.atan2(pos[i * 3 + 2], pos[i * 3]) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = pos[i * 3 + 1] / 2.2;
  }
  p.setAttribute(
    "TEXCOORD_0",
    doc
      .createAccessor()
      .setType("VEC2")
      .setArray(uv)
      .setBuffer(doc.getRoot().listBuffers()[0]),
  );
}
await doc.transform(
  prune(),
  dedup(),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    resize: [1024, 1024],
  }),
);
await io.write(`${dir}/variant-b.glb`, doc);
console.log(
  JSON.stringify({
    variant: "B",
    downloadedBytes: end - start,
    range: [start, end - 1],
    originalTriangles: doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((s, p) => s + p.getIndices().getCount() / 3, 0),
  }),
);
