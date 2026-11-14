import fs from "node:fs/promises";
import sharp from "sharp";
const dir = "public/textures/commodore",
  cache = "artifacts/local/commodore-reference";
await fs.mkdir(dir, { recursive: true });
const sources = [
  {
    file: "facade.jpg",
    source:
      "https://upload.wikimedia.org/wikipedia/commons/5/59/Vancouver_-_Commodore_Building_pano_01.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Vancouver_-_Commodore_Building_pano_01.jpg",
    author: "Joe Mabel",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    file: "neon.jpg",
    source:
      "https://upload.wikimedia.org/wikipedia/commons/3/3d/The_fabulous_commodore_ballroom_neon_%283683353819%29.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:The_fabulous_commodore_ballroom_neon_(3683353819).jpg",
    author: "Ben Aston",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
];
const images = [];
for (const s of sources) {
  try {
    images.push(await fs.readFile(`${cache}/${s.file}`));
  } catch {
    const r = await fetch(s.source);
    if (!r.ok) throw Error(r.status);
    images.push(Buffer.from(await r.arrayBuffer()));
  }
}
const scale = (await sharp(images[0]).metadata()).width / 1600;
const crop = (x, y, w, h) =>
  sharp(images[0]).extract({
    left: Math.round(x * scale),
    top: Math.round(y * scale),
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  });
const manifest = [];
const credit = (file, index, changes) => {
  const { file: sourceFile, ...metadata } = sources[index];
  manifest.push({ file, ...metadata, changes });
};
async function tile(id, rect) {
  const piece = await crop(...rect)
    .resize(512, 224)
    .png()
    .toBuffer();
  const base = await sharp({
    create: { width: 1024, height: 448, channels: 3, background: "#000" },
  })
    .composite([
      { input: piece, left: 0, top: 0 },
      { input: await sharp(piece).flop().png().toBuffer(), left: 512, top: 0 },
      { input: await sharp(piece).flip().png().toBuffer(), left: 0, top: 224 },
      {
        input: await sharp(piece).flip().flop().png().toBuffer(),
        left: 512,
        top: 224,
      },
    ])
    .png()
    .toBuffer();
  await sharp(base).webp({ quality: 95 }).toFile(`${dir}/${id}-color.webp`);
  const { data, info } = await sharp(base)
    .grayscale()
    .blur(0.6)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = Buffer.alloc(info.width * info.height * 3),
    r = Buffer.alloc(info.width * info.height);
  const value = (x, y) =>
    data[
      ((y + info.height) % info.height) * info.width +
        ((x + info.width) % info.width)
    ] / 255;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const dx = (value(x + 1, y) - value(x - 1, y)) * 2,
        dy = (value(x, y + 1) - value(x, y - 1)) * 2,
        l = Math.hypot(dx, dy, 1),
        i = y * info.width + x;
      n[i * 3] = Math.round(((-0.5 * dx) / l + 0.5) * 255);
      n[i * 3 + 1] = Math.round(((0.5 * dy) / l + 0.5) * 255);
      n[i * 3 + 2] = Math.round((0.5 / l + 0.5) * 255);
      r[i] = Math.round(198 + value(x, y) * 35);
    }
  await sharp(n, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .webp({ quality: 95 })
    .toFile(`${dir}/${id}-normal.webp`);
  await sharp(r, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .webp({ quality: 95 })
    .toFile(`${dir}/${id}-roughness.webp`);
  for (const map of ["color", "normal", "roughness"])
    credit(
      `${id}-${map}.webp`,
      0,
      `Cropped masonry at preview rectangle ${rect.join(", ")}; mirrored into a seamless repeat; resized. Normal and roughness are estimated from image contrast, not measured surface data.`,
    );
}
await tile("brick", [817, 147, 69, 30]);
await tile("woven-brick", [961, 301, 72, 25]);
for (const [file, rect, size] of [
  ["tile-frieze.webp", [716, 274, 47, 14], [512, 152]],
  ["rosette.webp", [264, 165, 27, 28], [256, 256]],
]) {
  await crop(...rect)
    .resize(...size)
    .webp({ quality: 95 })
    .toFile(`${dir}/${file}`);
  credit(file, 0, "Cropped ornamental detail, resized and converted to WebP.");
}
// Keep the real tube shapes and their mounts, but remove the dark surrounding margins.
const ns = (await sharp(images[1]).metadata()).width / 1600;
const sign = await sharp(images[1])
  .extract({
    left: Math.round(135 * ns),
    top: Math.round(105 * ns),
    width: Math.round(1395 * ns),
    height: Math.round(963 * ns),
  })
  .resize(1024, 708)
  .png()
  .toBuffer();
await sharp(sign).webp({ quality: 95 }).toFile(`${dir}/neon-color.webp`);
const { data, info } = await sharp(sign)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 3) {
  const peak = Math.max(data[i], data[i + 1], data[i + 2]);
  const f = Math.max(0, Math.min(1, (peak - 65) / 100));
  for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * f);
}
await sharp(data, { raw: info })
  .webp({ quality: 95 })
  .toFile(`${dir}/neon-emission.webp`);
for (const file of ["neon-color.webp", "neon-emission.webp"])
  credit(
    file,
    1,
    "Cropped photographed lettering and mounts; resized; an emission mask suppresses dark surroundings.",
  );
await fs.writeFile(
  `${dir}/SOURCES.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Prepared", manifest.length, "Commodore photo derivatives.");
