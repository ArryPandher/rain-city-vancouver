/** Texture-only derivative of the credited Martin Trafas E30. No network I/O.
 * node scripts/prepare-e30-coupe.mjs [path/to/audited/bmw-m3-e30.glb]
 * Repackages PNGs while retaining the original meshopt payload byte-for-byte.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const sourcePath =
  process.argv[2] ?? "artifacts/local/vehicle-candidates/bmw-m3-e30.glb";
const outputPath = "public/models/e30-coupe.glb";
const reportPath = "docs/sources/e30-coupe-preparation.json";
const sourceHash =
  "35cad98e89e6f1e54ccd238a3df049d29f20ecec3fc0aa2a85e0ad6c2663d330";
const derivativeCommit = "2d18dfd9db96bbf0d9cffa949deaf7f571388cbf";
const sourceUrl = `https://raw.githubusercontent.com/pedrosoandre/carros/${derivativeCommit}/assets/bmw-m3-e30.glb`;
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
const align4 = (n) => (n + 3) & ~3;
const highResolution = new Set([6, 8, 11]); // Rim color/normal, tire normal.
const normalImages = new Set([5, 8, 11, 14, 17]);
const colorImages = new Set([1, 2, 4, 6, 9, 12, 15]);

function unpack(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const start = 20 + jsonLength;
  assert.equal(bytes.readUInt32LE(start + 4), 0x004e4942);
  return {
    json,
    bin: bytes.subarray(start + 8, start + 8 + bytes.readUInt32LE(start)),
  };
}

function pack(json, bin) {
  const text = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(align4(text.length), 0x20);
  text.copy(jsonChunk);
  const paddedBin = Buffer.alloc(align4(bin.length));
  bin.copy(paddedBin);
  const result = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + paddedBin.length);
  [0x46546c67, 2, result.length, jsonChunk.length, 0x4e4f534a].forEach((n, i) =>
    result.writeUInt32LE(n, i * 4),
  );
  jsonChunk.copy(result, 20);
  result.writeUInt32LE(paddedBin.length, 20 + jsonChunk.length);
  result.writeUInt32LE(0x004e4942, 24 + jsonChunk.length);
  paddedBin.copy(result, 28 + jsonChunk.length);
  return result;
}

const bytes = await fs.readFile(sourcePath);
assert.equal(
  hash(bytes),
  sourceHash,
  "Only the independently audited derivative is accepted",
);
const original = unpack(bytes),
  json = structuredClone(original.json);
assert.match(json.asset.extras.license, /CC-BY-4.0/);
assert.match(json.asset.extras.author, /Martin Trafas/);
assert.equal(json.images.length, 18);
const imageViews = new Set(json.images.map((image) => image.bufferView));
const geometryStart = Math.max(
  ...json.images.map((image) => {
    const view = json.bufferViews[image.bufferView];
    assert.equal(view.buffer, 0);
    return align4((view.byteOffset ?? 0) + view.byteLength);
  }),
);
const parts = [],
  images = [];
let offset = 0;
for (const [index, image] of json.images.entries()) {
  const view = json.bufferViews[image.bufferView];
  const input = original.bin.subarray(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  );
  const metadata = await sharp(input).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  const resolution = highResolution.has(index) ? 1024 : 512;
  let output = input;
  if (resolution === 512) {
    if (normalImages.has(index)) {
      // Linear encoded vectors: resize without gamma, then restore unit length.
      const { data, info } = await sharp(input)
        .removeAlpha()
        .resize(512, 512, { kernel: "lanczos3" })
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(info.channels, 3);
      for (let i = 0; i < data.length; i += 3) {
        const x = data[i] / 127.5 - 1,
          y = data[i + 1] / 127.5 - 1,
          z = data[i + 2] / 127.5 - 1;
        const length = Math.hypot(x, y, z) || 1;
        data[i] = Math.round((x / length + 1) * 127.5);
        data[i + 1] = Math.round((y / length + 1) * 127.5);
        data[i + 2] = Math.round((z / length + 1) * 127.5);
      }
      output = await sharp(data, {
        raw: { width: 512, height: 512, channels: 3 },
      })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else {
      let pipeline = sharp(input);
      // Sharp applies pre-resize decoding and post-resize encoding. ORM/data
      // maps do not enter this color path; no palette/photographic lossy codec.
      if (colorImages.has(index)) pipeline = pipeline.gamma(2.2);
      output = await pipeline
        .resize(512, 512, { kernel: "lanczos3" })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
  }
  const users = json.materials.flatMap((material) => {
    const result = [];
    const visit = (value, path = "") => {
      if (!value || typeof value !== "object") return;
      if (
        Number.isInteger(value.index) &&
        json.textures[value.index]?.source === index
      )
        result.push(`${material.name}:${path}`);
      for (const [key, child] of Object.entries(value))
        visit(child, path ? `${path}.${key}` : key);
    };
    visit(material);
    return result;
  });
  images.push({
    index,
    resolution,
    role: normalImages.has(index)
      ? "normal"
      : colorImages.has(index)
        ? "color"
        : "linear-data",
    users,
    sourceBytes: input.length,
    bytes: output.length,
    sourceSha256: hash(input),
    sha256: hash(output),
    unchanged: output.equals(input),
  });
  view.byteOffset = offset;
  view.byteLength = output.length;
  parts.push(output, Buffer.alloc(align4(output.length) - output.length));
  offset += align4(output.length);
}
const shift = offset - geometryStart;
for (const [index, view] of json.bufferViews.entries()) {
  if (imageViews.has(index)) continue;
  if (view.buffer === 0) {
    assert.ok(view.byteOffset >= geometryStart);
    view.byteOffset += shift;
  }
  const compressed = view.extensions?.EXT_meshopt_compression;
  if (compressed) {
    assert.equal(compressed.buffer, 0);
    assert.ok(compressed.byteOffset >= geometryStart);
    compressed.byteOffset += shift;
  }
}
const geometryPayload = original.bin.subarray(
  geometryStart,
  original.json.buffers[0].byteLength,
);
parts.push(geometryPayload);
const bin = Buffer.concat(parts);
json.buffers[0].byteLength = bin.length;
json.asset.extras.rainCityDerivative = {
  sourceUrl,
  sourceSha256: sourceHash,
  derivativeAuthor: "pedrosoandre/carros",
  derivativeCommit,
  priorModifications:
    "weld, simplify, prune and meshopt compression (declared by redistributor)",
  modifications:
    "Rain City: rim color/normal and tire normal retained at 1024; other 15 maps resized to 512; resized normal vectors renormalized; PNG repacking. Geometry, transforms, nodes, material names and physical settings unchanged.",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};
const prepared = pack(json, bin);

// Decode both files through the actual installed meshopt decoder. Byte-for-byte
// compressed preservation alone would not catch incorrect repacked offsets.
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const sourceDoc = await io.readBinary(new Uint8Array(bytes));
const preparedDoc = await io.readBinary(new Uint8Array(prepared));
const sourceAccessors = sourceDoc.getRoot().listAccessors(),
  outputAccessors = preparedDoc.getRoot().listAccessors();
assert.equal(sourceAccessors.length, outputAccessors.length);
for (let i = 0; i < sourceAccessors.length; i++)
  assert.deepEqual(
    outputAccessors[i].getArray(),
    sourceAccessors[i].getArray(),
    `Decoded accessor ${i} changed`,
  );
for (const key of [
  "nodes",
  "meshes",
  "accessors",
  "materials",
  "textures",
  "samplers",
  "scenes",
  "extensionsUsed",
  "extensionsRequired",
])
  assert.deepEqual(json[key], original.json[key], `${key} changed`);
for (const [index, texture] of preparedDoc.getRoot().listTextures().entries()) {
  const data = texture.getImage();
  assert.ok(data);
  const meta = await sharp(data).metadata();
  assert.equal(meta.width, images[index].resolution);
  assert.equal(meta.height, images[index].resolution);
  if (highResolution.has(index))
    assert.equal(hash(data), images[index].sourceSha256);
  if (normalImages.has(index) && !highResolution.has(index)) {
    const raw = await sharp(data).raw().toBuffer();
    let maxError = 0;
    for (let i = 0; i < raw.length; i += 3)
      maxError = Math.max(
        maxError,
        Math.abs(
          Math.hypot(
            raw[i] / 127.5 - 1,
            raw[i + 1] / 127.5 - 1,
            raw[i + 2] / 127.5 - 1,
          ) - 1,
        ),
      );
    assert.ok(maxError < 0.007, `Normal map ${index} has non-unit vectors`);
    images[index].maximumUnitVectorError = maxError;
  }
}
const triangles = json.meshes.reduce(
  (sum, mesh) =>
    sum +
    mesh.primitives.reduce(
      (n, p) => n + json.accessors[p.indices].count / 3,
      0,
    ),
  0,
);
assert.equal(triangles, 52728);
const report = {
  version: 1,
  output: outputPath,
  source: { url: sourceUrl, sha256: sourceHash, bytes: bytes.length },
  outputSha256: hash(prepared),
  outputBytes: prepared.length,
  preparation: json.asset.extras.rainCityDerivative,
  tools: {
    node: process.version,
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
    gltfTransform: "4.5.1",
  },
  geometry: {
    triangles,
    meshes: json.meshes.length,
    materials: json.materials.length,
    decodedAccessorsVerifiedIdentical: sourceAccessors.length,
    retainedCompressedPayloadBytes: geometryPayload.length,
    retainedCompressedPayloadSha256: hash(geometryPayload),
  },
  extensionsRequired: json.extensionsRequired,
  extensionsUsed: json.extensionsUsed,
  textureBudget: {
    images: images.length,
    retained1024: 3,
    resized512: 15,
    sourceRGBA8MipMiB: 96,
    preparedRGBA8MipMiB:
      images.reduce((n, image) => n + (image.resolution ** 2 * 4 * 4) / 3, 0) /
      1048576,
    currentCarConceptUniqueImageRGBA8MipMiB: 38.265625,
    note: "Unique embedded images as RGBA8 with full mip chains; excludes duplicate uploads, driver storage, geometry, texture samplers and CPU copies. Not measured runtime VRAM.",
  },
  images,
};
await fs.writeFile(outputPath, prepared);
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      output: outputPath,
      bytes: prepared.length,
      sha256: report.outputSha256,
      triangles,
      decodedAccessorsVerifiedIdentical: sourceAccessors.length,
      textureMiB: report.textureBudget.preparedRGBA8MipMiB,
    },
    null,
    2,
  ),
);
