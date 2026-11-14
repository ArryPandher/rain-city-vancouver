import sharp from "sharp";
await sharp({
  create: { width: 4096, height: 2048, channels: 4, background: "#00000000" },
})
  .composite(
    ["c-0", "c-1", "b-0", "b-1"].map((view, i) => ({
      input: `artifacts/local/forest-conifer-${view}.png`,
      left: i * 1024,
      top: 0,
    })),
  )
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile("public/textures/forest/conifer-atlas-pair.webp");
console.log(
  "Packed two views of each conifer variant into the distant-tree atlas.",
);

// Match the padded atlas width to the exact geometry used by the close model.
// Recording this removes a hand-tuned scale mismatch whenever a canopy is rebuilt.
const { NodeIO } = await import("@gltf-transform/core");
const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
const { getBounds } = await import("@gltf-transform/functions");
const fs = await import("node:fs/promises");
const { createHash } = await import("node:crypto");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  shapes = [];
for (const suffix of ["", "-b"]) {
  const file = `public/models/forest/fir_tree_01${suffix}.glb`;
  const doc = await io.read(file),
    bounds = getBounds(doc.getRoot().listScenes()[0]);
  const height = bounds.max[1] - bounds.min[1],
    width = Math.max(
      bounds.max[0] - bounds.min[0],
      bounds.max[2] - bounds.min[2],
    );
  shapes.push({
    height,
    width,
    atlasWidth: height / (2 * width),
    source: file.slice(7),
    sha256: createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex"),
  });
}
await fs.writeFile(
  "src/world/conifer-shapes.json",
  JSON.stringify(shapes, null, 2) + "\n",
);
