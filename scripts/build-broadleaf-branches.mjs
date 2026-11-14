import fs from "node:fs/promises";
import crypto from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  weld,
  simplify,
  prune,
  dedup,
  getBounds,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read("public/models/vancouver-street-tree.glb");
const rootY = getBounds(doc.getRoot().listScenes()[0]).min[1];
function anchorRoot() {
  const shift = rootY - getBounds(doc.getRoot().listScenes()[0]).min[1];
  const positions = new Set(
    doc
      .getRoot()
      .listMeshes()
      .flatMap((m) =>
        m.listPrimitives().map((p) => p.getAttribute("POSITION")),
      ),
  );
  for (const position of positions) {
    const a = position.getArray();
    for (let i = 1; i < a.length; i += 3) a[i] += shift;
  }
}
for (const mesh of doc.getRoot().listMeshes())
  for (const p of [...mesh.listPrimitives()])
    if (p.getMaterial()?.getName().includes("leaves")) mesh.removePrimitive(p);
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.1, error: 0.02 }),
  dedup(),
  prune(),
);
const file = "models/vancouver-street-tree-branches.glb";
anchorRoot();
await io.write("public/" + file, doc);
const buffer = await fs.readFile("public/" + file),
  triangles = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
const record = {
  file,
  credit: "Poly Haven — Tree Small 02",
  source: "https://polyhaven.com/a/tree_small_02",
  license: "CC0-1.0",
  bytes: buffer.length,
  sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  changes: `Woody geometry derived from committed near model with meshoptimizer reduction to ${triangles} triangles, retained normals/UVs and a small vertical correction to preserve the original root anchor. Used with layered leaf geometry.`,
};
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [...manifest.filter((x) => x.file !== file), record],
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ triangles, record }));
await doc.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.15, error: 0.06 }),
  prune(),
);
const distantFile = "models/vancouver-street-tree-branches-distant.glb";
anchorRoot();
await io.write("public/" + distantFile, doc);
const distantBuffer = await fs.readFile("public/" + distantFile),
  distantTriangles = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
const distantRecord = {
  ...record,
  file: distantFile,
  bytes: distantBuffer.length,
  sha256: crypto.createHash("sha256").update(distantBuffer).digest("hex"),
  changes: `Woody geometry reduced further to ${distantTriangles} triangles for tree groups beyond 600 m; original root anchor restored after simplification, with shared materials and stem calibration.`,
};
const updated = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [...updated.filter((x) => x.file !== distantFile), distantRecord],
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ distantTriangles, distantRecord }));
