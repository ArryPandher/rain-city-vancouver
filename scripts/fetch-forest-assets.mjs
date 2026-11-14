import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  prune,
  dedup,
  weld,
  simplify,
  textureCompress,
  getBounds,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ids = [
  "fir_tree_01",
  "fern_02",
  "moss_01",
  "rock_moss_set_01",
  "tree_stump_01",
  "shrub_04",
  "nettle_plant",
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
await fs.mkdir("public/models/forest", { recursive: true });
const sources = [];
async function download(url, dest, headers) {
  if (await fs.stat(dest).catch(() => null)) return;
  const r = await fetch(url, { headers });
  if (!r.ok || (headers?.Range && r.status !== 206)) {
    await r.body?.cancel();
    throw new Error(`${r.status} ${url}`);
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
}
for (const id of ids) {
  const info = await (
    await fetch(`https://api.polyhaven.com/files/${id}`)
  ).json();
  const metadata = await (
    await fetch(`https://api.polyhaven.com/info/${id}`)
  ).json();
  const model = info.gltf["1k"].gltf,
    dir = `artifacts/local/forest-source/${id}`;
  await download(model.url, `${dir}/source.gltf`);
  const g = JSON.parse(await fs.readFile(`${dir}/source.gltf`, "utf8"));
  if (id === "fir_tree_01") {
    const mesh = g.meshes[2],
      accessors = [
        ...new Set(
          mesh.primitives.flatMap((p) => [
            ...Object.values(p.attributes),
            p.indices,
          ]),
        ),
      ];
    const views = [...new Set(accessors.map((a) => g.accessors[a].bufferView))];
    const min = Math.min(...views.map((i) => g.bufferViews[i].byteOffset ?? 0));
    const max = Math.max(
      ...views.map(
        (i) => (g.bufferViews[i].byteOffset ?? 0) + g.bufferViews[i].byteLength,
      ),
    );
    await download(
      model.include["fir_tree_01.bin"].url,
      `${dir}/selected.bin`,
      { Range: `bytes=${min}-${max - 1}` },
    );
    if ((await fs.stat(`${dir}/selected.bin`)).size !== max - min)
      throw new Error("Incomplete conifer byte range");
    g.accessors = accessors.map((i) => ({
      ...g.accessors[i],
      bufferView: views.indexOf(g.accessors[i].bufferView),
    }));
    g.bufferViews = views.map((i) => ({
      ...g.bufferViews[i],
      buffer: 0,
      byteOffset: (g.bufferViews[i].byteOffset ?? 0) - min,
    }));
    for (const p of mesh.primitives) {
      p.indices = accessors.indexOf(p.indices);
      for (const k in p.attributes)
        p.attributes[k] = accessors.indexOf(p.attributes[k]);
    }
    g.meshes = [mesh];
    g.nodes = [{ name: "Stanley conifer", mesh: 0 }];
    g.scenes = [{ nodes: [0] }];
    g.scene = 0;
    g.buffers = [{ uri: "selected.bin", byteLength: max - min }];
  }
  for (const [file, asset] of Object.entries(model.include)) {
    if (id === "fir_tree_01" && file.endsWith(".bin")) continue;
    await download(asset.url, `${dir}/${file}`);
  }
  await fs.writeFile(`${dir}/model.gltf`, JSON.stringify(g));
  const doc = await io.read(`${dir}/model.gltf`);
  // The glTF JPEG exports omit alpha; restore the licensed source mask before packing.
  const alphaKey =
    id === "fir_tree_01"
      ? "twig_alpha"
      : ["fern_02", "moss_01", "shrub_04", "nettle_plant"].includes(id)
        ? "Alpha"
        : null;
  if (alphaKey) {
    const formats = info[alphaKey]["1k"],
      alpha = formats.png ?? formats.jpg;
    await download(alpha.url, `${dir}/alpha-source`);
    const mask = await sharp(`${dir}/alpha-source`)
      .resize(1024, 1024)
      .greyscale()
      .raw()
      .toBuffer();
    for (const mat of doc.getRoot().listMaterials()) {
      if (id === "fir_tree_01" && !mat.getName().includes("twig")) continue;
      const tex = mat.getBaseColorTexture();
      if (!tex) continue;
      const rgb = await sharp(tex.getImage())
        .resize(1024, 1024)
        .removeAlpha()
        .raw()
        .toBuffer();
      const rgba = await sharp(rgb, {
        raw: { width: 1024, height: 1024, channels: 3 },
      })
        .joinChannel(mask, { raw: { width: 1024, height: 1024, channels: 1 } })
        .png()
        .toBuffer();
      tex.setImage(rgba).setMimeType("image/png");
      mat.setAlphaMode("MASK").setAlphaCutoff(0.42).setDoubleSided(true);
    }
  }
  if (id === "fir_tree_01") {
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        if (p.getAttribute("TEXCOORD_0")) continue;
        const positions = p.getAttribute("POSITION").getArray(),
          uv = new Float32Array((positions.length / 3) * 2);
        for (let i = 0; i < positions.length / 3; i++) {
          uv[i * 2] =
            Math.atan2(positions[i * 3 + 2], positions[i * 3]) / (Math.PI * 2) +
            0.5;
          uv[i * 2 + 1] = positions[i * 3 + 1] / 2.2;
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
  }
  if (id === "fir_tree_01") {
    // Keep every photographed twig, simplifying only the solid trunk/branch geometry.
    const twigs = [];
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of [...mesh.listPrimitives()])
        if (p.getMaterial()?.getName().includes("twig")) {
          mesh.removePrimitive(p);
          twigs.push([mesh, p]);
        }
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.002 }),
    );
    for (const [mesh, p] of twigs) mesh.addPrimitive(p);
  }
  if (["shrub_04", "nettle_plant"].includes(id))
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.22, error: 0.005 }),
    );
  await doc.transform(
    prune(),
    dedup(),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [1024, 1024],
    }),
  );
  const file = `models/forest/${id}.glb`;
  await io.write(`public/${file}`, doc);
  const triangles = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  const bounds = getBounds(doc.getRoot().listScenes()[0]);
  sources.push({
    file,
    title: metadata.name,
    authors: metadata.authors,
    source: `https://polyhaven.com/a/${id}`,
    download: model.url,
    license: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    triangles,
    bounds,
    changes:
      id === "fir_tree_01"
        ? "Extracted variant C using a bounded byte range; added missing cylindrical trunk UVs, simplified solid wood, retained every twig and restored source alpha. WebP textures at 1K. Runtime scaling and instancing."
        : "Restored source alpha for vegetation; shrubs/nettles simplified with a bounded 0.005 error; packed with 1K WebP textures. Runtime scaling, pivot normalization and instancing.",
  });
  console.log(id, triangles, (await fs.stat(`public/${file}`)).size, bounds);
}
await fs.writeFile(
  "docs/sources/stanley-forest-assets.json",
  JSON.stringify(sources, null, 2) + "\n",
);
