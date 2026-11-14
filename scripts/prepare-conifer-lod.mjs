import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  compactPrimitive,
  dedup,
  getBounds,
  joinPrimitives,
  prune,
  quantize,
  simplify,
  weld,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

// Needles are disconnected, thin folded strips. Global decimation erases them.
// Retain a stable sample, widen only across each needle's long axis, then reduce wood.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [
  source = "public/models/forest/fir_tree_01.glb",
  output = "public/models/forest/fir_tree_01-medium.glb",
  strideArg = "6",
  widthArg = "3.3",
  woodArg = "0.18",
  packing = "float",
] = process.argv.slice(2);
const stride = Number(strideArg),
  needleWidth = Number(widthArg),
  woodRatio = Number(woodArg);
const flatNeedles = output.includes("-medium");
if (!(stride >= 1 && needleWidth >= 1 && woodRatio > 0 && woodRatio <= 1))
  throw Error("Invalid reduction settings");
const doc = await io.read(source);
const referenceBounds = getBounds(doc.getRoot().listScenes()[0]);
const held = [];
let originalNeedles = 0,
  retainedNeedles = 0;
const hash = (n) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
};
for (const mesh of doc.getRoot().listMeshes()) {
  for (const p of mesh.listPrimitives()) {
    if (!p.getMaterial().getName().includes("twig")) continue;
    const pos = p.getAttribute("POSITION").getArray();
    const idx = p.getIndices().getArray();
    const count = pos.length / 3;
    const parent = Int32Array.from({ length: count }, (_, i) => i);
    const root = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = root(idx[i]);
      parent[root(idx[i + 1])] = a;
      parent[root(idx[i + 2])] = a;
    }
    const groups = new Map();
    for (let i = 0; i < count; i++) {
      const r = root(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    const needles = doc.createPrimitive().setMaterial(p.getMaterial());
    for (const semantic of p.listSemantics())
      needles.setAttribute(
        semantic,
        p
          .getAttribute(semantic)
          .clone()
          .setArray(p.getAttribute(semantic).getArray().slice()),
      );
    const np = needles.getAttribute("POSITION").getArray();
    const nn = needles.getAttribute("NORMAL").getArray();
    const quads = [],
      flattened = new Set();
    const selected = new Set(),
      wood = new Set();
    for (const [r, points] of groups) {
      if (points.length > 6) {
        wood.add(r);
        continue;
      }
      originalNeedles++;
      if (hash(r) % stride !== 0) continue;
      retainedNeedles++;
      selected.add(r);
      let length = -1,
        axis = [0, 1, 0];
      for (const a of points)
        for (const b of points) {
          const d = [0, 1, 2].map((k) => pos[b * 3 + k] - pos[a * 3 + k]);
          const l = Math.hypot(...d);
          if (l > length) {
            length = l;
            axis = d.map((v) => v / (l || 1));
          }
        }
      const centre = [0, 1, 2].map(
        (k) => points.reduce((s, i) => s + pos[i * 3 + k], 0) / points.length,
      );
      for (const i of points) {
        const delta = [0, 1, 2].map((k) => pos[i * 3 + k] - centre[k]);
        const along = delta.reduce((s, v, k) => s + v * axis[k], 0);
        const normalAlong = axis.reduce((s, v, k) => s + v * nn[i * 3 + k], 0);
        const normal = axis.map(
          (v, k) =>
            v * normalAlong + (nn[i * 3 + k] - v * normalAlong) / needleWidth,
        );
        const normalLength = Math.hypot(...normal);
        for (let k = 0; k < 3; k++) {
          np[i * 3 + k] =
            centre[k] +
            axis[k] * along +
            (delta[k] - axis[k] * along) * needleWidth;
          nn[i * 3 + k] = normal[k] / (normalLength || 1);
        }
      }
      if (flatNeedles && points.length === 6) {
        const along = (i) =>
          axis.reduce((s, v, k) => s + v * pos[i * 3 + k], 0);
        const ordered = [...points].sort((a, b) => along(a) - along(b));
        const distance = (a, b) =>
          [0, 1, 2].reduce(
            (s, k) => s + (pos[a * 3 + k] - pos[b * 3 + k]) ** 2,
            0,
          );
        const outer = (end) => {
          let pair = [end[0], end[1]],
            width = -1;
          for (const a of end)
            for (const b of end)
              if (distance(a, b) > width) {
                width = distance(a, b);
                pair = [a, b];
              }
          return pair;
        };
        const lo = outer(ordered.slice(0, 3)),
          hi = outer(ordered.slice(3));
        if (
          distance(lo[0], hi[0]) + distance(lo[1], hi[1]) >
          distance(lo[0], hi[1]) + distance(lo[1], hi[0])
        )
          hi.reverse();
        const face = (a, b, c) => {
          const ab = [0, 1, 2].map((k) => np[b * 3 + k] - np[a * 3 + k]);
          const ac = [0, 1, 2].map((k) => np[c * 3 + k] - np[a * 3 + k]);
          const cross = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
          ];
          const facing = cross.reduce(
            (s, v, k) =>
              s + v * (nn[a * 3 + k] + nn[b * 3 + k] + nn[c * 3 + k]),
            0,
          );
          return facing < 0 ? [a, c, b] : [a, b, c];
        };
        quads.push(...face(lo[0], hi[0], lo[1]), ...face(hi[0], hi[1], lo[1]));
        flattened.add(r);
      }
    }
    const keep = quads,
      branch = [];
    for (let i = 0; i < idx.length; i += 3) {
      const r = root(idx[i]);
      const out =
        selected.has(r) && !flattened.has(r)
          ? keep
          : wood.has(r)
            ? branch
            : null;
      if (out) out.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    needles.setIndices(p.getIndices().clone().setArray(new Uint32Array(keep)));
    p.setIndices(p.getIndices().clone().setArray(new Uint32Array(branch)));
    compactPrimitive(needles);
    compactPrimitive(p);
    held.push({ mesh, p, needles });
  }
}
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: woodRatio, error: 0.008 }),
);
// Decimation changes the branch faces. Refit their smooth normals to those faces.
for (const p of doc
  .getRoot()
  .listMeshes()
  .flatMap((m) => m.listPrimitives())) {
  const positions = p.getAttribute("POSITION").getArray(),
    indices = p.getIndices().getArray();
  const old = p.getAttribute("NORMAL").getArray(),
    normal = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
    const ab = [0, 1, 2].map(
      (k) => positions[ids[1] + k] - positions[ids[0] + k],
    );
    const ac = [0, 1, 2].map(
      (k) => positions[ids[2] + k] - positions[ids[0] + k],
    );
    const n = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    for (const id of ids) for (let k = 0; k < 3; k++) normal[id + k] += n[k];
  }
  for (let i = 0; i < normal.length; i += 3) {
    const length = Math.hypot(normal[i], normal[i + 1], normal[i + 2]);
    for (let k = 0; k < 3; k++)
      normal[i + k] = length > 1e-12 ? normal[i + k] / length : old[i + k];
  }
  p.setAttribute("NORMAL", p.getAttribute("NORMAL").clone().setArray(normal));
  p.setAttribute("TANGENT", null);
}
for (const { mesh, p, needles } of held) {
  const joined = joinPrimitives([p, needles]);
  mesh.removePrimitive(p).addPrimitive(joined);
}
await doc.transform(prune(), dedup());
if (packing === "quantize")
  await doc.transform(
    quantize({
      quantizePosition: 16,
      quantizeNormal: 10,
      quantizeTexcoord: 14,
    }),
  );
const triangles = doc
  .getRoot()
  .listMeshes()
  .flatMap((m) => m.listPrimitives())
  .reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
const metadata = {
  source: source.replace(/^public\//, ""),
  output: output.replace(/^public\//, ""),
  originalNeedles,
  retainedNeedles,
  needleStride: stride,
  needleWidthMultiplier: needleWidth,
  flatNeedles,
  woodRatio,
  packing,
  triangles,
  referenceBounds,
  bounds: getBounds(doc.getRoot().listScenes()[0]),
  changes: `Deterministic needle component sampling; transverse-only coverage compensation; ${flatNeedles ? "medium needles flattened from folded strips to two triangles with corrected winding; " : ""}wood/branch simplification with 0.008 error and recomputed branch normals. Original UVs, alpha and textures retained${packing === "quantize" ? "; 16-bit positions, 10-bit normals and 14-bit bounded UVs (tiling UVs remain floating-point)" : ""}. Runtime normalization uses near-detail reference dimensions.`,
};
doc.getRoot().setExtras({ rainCityLod: metadata });
await io.write(output, doc);
await fs.writeFile(
  `docs/sources/${process.argv.length > 2 ? path.basename(output, ".glb") : "stanley-conifer"}-lod.json`,
  JSON.stringify(metadata, null, 2) + "\n",
);
console.log(JSON.stringify(metadata));
