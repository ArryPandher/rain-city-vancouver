import fs from "node:fs/promises";
import sharp from "sharp";
const id = "rock_face_03";
async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return r.json();
}
const [info, files] = await Promise.all([
  json(`https://api.polyhaven.com/info/${id}`),
  json(`https://api.polyhaven.com/files/${id}`),
]);
await fs.mkdir("public/textures/cliffs", { recursive: true });
const sources = [];
for (const [key, suffix] of [
  ["Diffuse", "color"],
  ["nor_gl", "normal"],
  ["Rough", "roughness"],
]) {
  const formats = files[key]["2k"],
    asset = formats.jpg ?? formats.png;
  const r = await fetch(asset.url);
  if (!r.ok) throw Error(`${r.status}: ${asset.url}`);
  const file = `textures/cliffs/${id}-${suffix}.webp`;
  await sharp(Buffer.from(await r.arrayBuffer()))
    .resize(2048, 2048)
    .webp({ quality: suffix === "normal" ? 94 : 90 })
    .toFile(`public/${file}`);
  sources.push({
    file,
    source: `https://polyhaven.com/a/${id}`,
    download: asset.url,
    authors: info.authors,
    license: "CC0-1.0",
    dimensionsMetres: info.dimensions.map((n) => n / 1000),
    changes:
      "Resized to 2K WebP. World-space triplanar projection, slope blending and broad color variation at runtime; generic rock photography, not a Vancouver scan.",
  });
}
await fs.writeFile(
  "public/textures/cliffs/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((item) => !item.file.startsWith("textures/cliffs/")),
      ...sources.map((item) => ({
        file: item.file,
        source: item.source,
        license: item.license,
        credit:
          "Poly Haven — Dario Barresi (photography), Rico Cilliers (processing)",
        changes: item.changes,
      })),
    ],
    null,
    2,
  ) + "\n",
);
console.log("Prepared three 2K cliff maps and source records");
