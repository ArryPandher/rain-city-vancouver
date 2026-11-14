import fs from "node:fs/promises";
import sharp from "sharp";
await fs.mkdir("public/textures/forest", { recursive: true });
const sources = [];
for (const id of ["forest_ground_06", "leaves_forest_ground"]) {
  const [info, files] = await Promise.all([
    fetch(`https://api.polyhaven.com/info/${id}`).then((r) => r.json()),
    fetch(`https://api.polyhaven.com/files/${id}`).then((r) => r.json()),
  ]);
  for (const [key, suffix] of [
    ["Diffuse", "color"],
    ["nor_gl", "normal"],
    ["Rough", "roughness"],
  ]) {
    if (id === "leaves_forest_ground" && suffix !== "color") continue;
    const formats = (files[key] ??
      files[{ Diffuse: "diff", Rough: "rough" }[key]])["2k"];
    const asset = formats.jpg ?? formats.png;
    const r = await fetch(asset.url);
    if (!r.ok) throw Error(r.status);
    const file = `textures/forest/${id}-${suffix}.webp`;
    await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(2048, 2048)
      .webp({ quality: 88 })
      .toFile(`public/${file}`);
    sources.push({
      file,
      source: `https://polyhaven.com/a/${id}`,
      download: asset.url,
      authors: info.authors,
      license: "CC0-1.0",
      dimensionsMetres: info.dimensions.map((n) => n / 1000),
      changes:
        "Resized to 2K WebP; blended at runtime with forest soil and leaf litter.",
    });
  }
}
await fs.writeFile(
  "public/textures/forest/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
console.log("Prepared forest soil and leaf litter maps");
