import fs from "node:fs/promises";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { leafCards } from "./lib/leaf-cards.mjs";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read("public/models/vancouver-street-tree.glb");
const source = "public/models/vancouver-street-tree.glb";
const output = "public/models/vancouver-street-tree-medium.glb";
await fs.mkdir("artifacts/local", { recursive: true });
let stats, maskTriangles;
for (const mesh of doc.getRoot().listMeshes())
  for (const primitive of mesh.listPrimitives()) {
    if (!primitive.getMaterial()?.getName().includes("leaves")) continue;
    const uv = primitive.getAttribute("TEXCOORD_0").getArray(),
      ix = primitive.getIndices().getArray();
    const seen = new Set(),
      paths = [];
    const point = (i) =>
      `${(uv[i * 2] * 1024).toFixed(3)},${(uv[i * 2 + 1] * 1024).toFixed(3)}`;
    for (let i = 0; i < ix.length; i += 3) {
      const q = [point(ix[i]), point(ix[i + 1]), point(ix[i + 2])];
      const key = [...q].sort().join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push(`<path d="M${q.join("L")}Z"/>`);
    }
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="black"/><g fill="white">${paths.join("")}</g></svg>`,
    );
    const mask = await sharp(svg).removeAlpha().greyscale().raw().toBuffer();
    const material = primitive.getMaterial();
    const inputImage = material.getBaseColorTexture().getImage();
    const imageInfo = await sharp(inputImage).metadata();
    if (
      imageInfo.width !== 1024 ||
      imageInfo.height !== 1024 ||
      imageInfo.channels !== 3
    )
      throw new Error("Expected the committed 1024² RGB leaf atlas");
    const rgba = await sharp(inputImage)
      .joinChannel(mask, { raw: { width: 1024, height: 1024, channels: 1 } })
      .webp({ quality: 100, alphaQuality: 100 })
      .toBuffer();
    material
      .setBaseColorTexture(
        doc
          .createTexture("leaf-cards-source-mask")
          .setImage(rgba)
          .setMimeType("image/webp"),
      )
      .setAlphaMode("MASK")
      .setAlphaCutoff(0.18);
    await fs.writeFile("artifacts/local/leaf-card-mask.webp", rgba);
    maskTriangles = seen.size;
    console.log("Unique UV triangles", seen.size);
    const r = leafCards(primitive, 0.2);
    stats = r.stats;
    const buffer = doc.getRoot().listBuffers()[0],
      acc = (type, array) =>
        doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    primitive
      .setAttribute("POSITION", acc("VEC3", r.positions))
      .setAttribute("NORMAL", acc("VEC3", r.normals))
      .setAttribute("TEXCOORD_0", acc("VEC2", r.uvs))
      .setIndices(acc("SCALAR", r.indices));
  }
if (!stats) throw new Error("No source leaf primitive found");
await doc.transform(dedup(), prune());
await io.write(output, doc);
const totalTriangles = doc
  .getRoot()
  .listMeshes()
  .flatMap((m) => m.listPrimitives())
  .reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);
const sourceHash = createHash("sha256")
  .update(await fs.readFile(source))
  .digest("hex");
const bytes = await fs.readFile(output);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const changes =
  "All connected leaf patches retained: 27,813 fitted alpha-masked cards plus 3,744 original patches. Leaf-mask UV triangles baked from the committed near model, area-compensated fits and source normals; unchanged near-model trunk/branches. 95,375 total triangles. Generic broadleaf, not a Vancouver species scan.";
const provenance = {
  title: "Tree Small 02",
  author: "Poly Haven",
  source: "https://polyhaven.com/a/tree_small_02",
  license: "CC0-1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  input: { file: source, sha256: sourceHash },
  changes,
  leafStats: stats,
  totalTriangles,
  maskTriangles,
  alphaCutoff: 0.18,
  bytes: bytes.length,
  sha256,
};
await fs.writeFile(
  "docs/sources/vancouver-street-tree-medium.json",
  JSON.stringify(provenance, null, 2) + "\n",
);
const manifestPath = "public/asset-manifest.json";
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
Object.assign(
  manifest.find((a) => a.file === "models/vancouver-street-tree-medium.glb"),
  { changes, bytes: bytes.length, sha256 },
);
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(
  "artifacts/local/leaf-cards-stats.json",
  JSON.stringify(stats, null, 2),
);
console.log(JSON.stringify(stats));
