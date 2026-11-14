import fs from "node:fs/promises";
import sharp from "sharp";
const dir = "public/textures/theatres";
await fs.mkdir(dir, { recursive: true });
const id = "painted_plaster_wall",
  info = await (await fetch("https://api.polyhaven.com/info/" + id)).json(),
  files = await (await fetch("https://api.polyhaven.com/files/" + id)).json();
const sources = [];
for (const [key, name] of [
  ["Diffuse", "color"],
  ["nor_gl", "normal"],
  ["Rough", "roughness"],
]) {
  const f = files[key]["1k"].jpg,
    r = await fetch(f.url);
  if (!r.ok) throw Error(r.status);
  const file = `plaster-${name}.webp`;
  await sharp(Buffer.from(await r.arrayBuffer()))
    .webp({ quality: 94 })
    .toFile(`${dir}/${file}`);
  sources.push({
    file,
    source: f.url,
    asset: "https://polyhaven.com/a/" + id,
    author: Object.keys(info.authors).join(", "),
    license: "CC0",
    sourceMd5: f.md5,
    changes: "Converted 1K texture to WebP",
  });
}
const source =
    "https://upload.wikimedia.org/wikipedia/commons/5/51/Vogue_Theatre_2026.JPG",
  cache = "artifacts/local/theatre-reference/vogue-2026.jpg";
let photo;
try {
  photo = await fs.readFile(cache);
} catch {
  const r = await fetch(source);
  if (!r.ok) throw Error(r.status);
  photo = Buffer.from(await r.arrayBuffer());
}
// Work in the inspected 1200 x 900 reference coordinates, retaining native detail.
const meta = await sharp(photo).metadata(),
  scale = meta.width / 1200;
const crop = async (x, y, w, h) =>
  sharp(photo).extract({
    left: Math.round(x * scale),
    top: Math.round(y * scale),
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  });
const carving = await crop(309, 196, 60, 71);
const { data: relief, info: reliefInfo } = await carving
  .grayscale()
  .normalize()
  .resize(384, 448)
  .raw()
  .toBuffer({ resolveWithObject: true });
// Relight the night photograph in byte space, retaining shallow stone relief.
for (let i = 0; i < relief.length; i++)
  relief[i] = Math.round(155 + relief[i] * 0.35);
await sharp(relief, { raw: reliefInfo })
  .webp({ quality: 94 })
  .toFile(`${dir}/vogue-carving.webp`);
const symbol = await crop(619, 14, 66, 98),
  { data, info: dim } = await symbol
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const r = data[i],
    g = data[i + 1],
    b = data[i + 2];
  const keep =
    Math.min(1, Math.max(0, (Math.min(r, g) - b - 28) / 45)) *
    Math.min(1, Math.max(0, (g - 45) / 80));
  data[i + 3] = Math.round(keep * 255);
}
await sharp(data, { raw: dim })
  .resize({ height: 512 })
  .webp({ quality: 94 })
  .toFile(`${dir}/vogue-diana.webp`);
for (const [file, changes] of [
  [
    "vogue-carving.webp",
    "Cropped carving detail; grayscale, normalized and relit for daylight, resized to 384 x 448.",
  ],
  [
    "vogue-diana.webp",
    "Cropped neon Diana figure; yellow-light mask removes the night sky; resized to 512 px high.",
  ],
])
  sources.push({
    file,
    source,
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Vogue_Theatre_2026.JPG",
    author: "Canmenwalker",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    changes,
  });
await fs.writeFile(
  `${dir}/SOURCES.json`,
  JSON.stringify(sources, null, 2) + "\n",
);
console.log("Prepared theatre plaster and licensed Vogue decorative details.");
