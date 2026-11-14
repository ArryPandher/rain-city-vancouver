import fs from "node:fs/promises";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const d = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .read("public/models/forest/shrub_04.glb"),
  atlas = d.getRoot().listMaterials()[0].getBaseColorTexture().getImage();
const crops = [
    [132, 96, 104, 240],
    [534, 74, 99, 270],
    [619, 385, 100, 218],
    [229, 643, 115, 294],
    [373, 713, 133, 244],
    [549, 687, 106, 225],
  ],
  size = 1024;
let seed = 51972;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const overlays = [];
for (let i = 0; i < 150; i++) {
  const [left, top, width, height] = crops[i % crops.length],
    w = 70 + Math.floor(random() * 70),
    angle = random() * 360;
  const leaf = await sharp(atlas)
    .extract({ left, top, width, height })
    .resize({ width: w })
    .modulate({ brightness: 0.78, saturation: 1.15 })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const m = await sharp(leaf).metadata(),
    x = Math.floor(random() * size),
    y = Math.floor(random() * size);
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      const xx = x + dx,
        yy = y + dy,
        l = Math.max(0, xx),
        t = Math.max(0, yy),
        r = Math.min(size, xx + m.width),
        b = Math.min(size, yy + m.height);
      if (r <= l || b <= t) continue;
      overlays.push({
        input: await sharp(leaf)
          .extract({ left: l - xx, top: t - yy, width: r - l, height: b - t })
          .png()
          .toBuffer(),
        left: l,
        top: t,
      });
    }
}
await fs.mkdir("public/textures/coastal", { recursive: true });
const color = await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: { r: 27, g: 34, b: 20, alpha: 1 },
  },
})
  .composite(overlays)
  .removeAlpha()
  .raw()
  .toBuffer();
await sharp(color, { raw: { width: size, height: size, channels: 3 } })
  .webp({ quality: 92 })
  .toFile("public/textures/coastal/leaf-cover-color.webp");
const height = await sharp(color, {
    raw: { width: size, height: size, channels: 3 },
  })
    .greyscale()
    .blur(0.6)
    .raw()
    .toBuffer(),
  normal = Buffer.alloc(size * size * 3);
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const h = (xx, yy) =>
      height[((yy + size) % size) * size + ((xx + size) % size)] / 255;
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.5,
      dy = (h(x, y + 1) - h(x, y - 1)) * 2.5,
      len = Math.hypot(dx, dy, 1),
      i = (y * size + x) * 3;
    normal[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
    normal[i + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
    normal[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
  }
await sharp(normal, { raw: { width: size, height: size, channels: 3 } })
  .webp({ quality: 94 })
  .toFile("public/textures/coastal/leaf-cover-normal.webp");
const sources = ["color", "normal"].map((s) => ({
  file: `textures/coastal/leaf-cover-${s}.webp`,
  source: "https://polyhaven.com/a/shrub_04",
  authors: { "Rico Cilliers": "Leaf photography" },
  license: "CC0-1.0",
  changes:
    "Individual licensed leaf crops layered into a seamless 1K groundcover tile; diffuse color moderated and a shallow normal estimated from image gradients. Runtime triplanar projection and an interpreted geographic planting mask. Not a Vancouver scan.",
}));
await fs.writeFile(
  "public/textures/coastal/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((x) => !x.file.startsWith("textures/coastal/")),
      ...sources.map((s) => ({
        ...s,
        credit:
          "Poly Haven — Rico Cilliers (leaf photography); Rain City (tile assembly).",
      })),
    ],
    null,
    2,
  ) + "\n",
);
console.log("Prepared seamless photographed leaf cover");
