import fs from "node:fs/promises";
import sharp from "sharp";
await fs.mkdir("public/textures/seawall", { recursive: true });
const sources = [];
for (const [id, prefix] of [
  ["japanese_stone_wall", "stone"],
  ["herringbone_pavement", "pavers"],
]) {
  const [files, info] = await Promise.all([
    fetch(`https://api.polyhaven.com/files/${id}`).then((r) => r.json()),
    fetch(`https://api.polyhaven.com/info/${id}`).then((r) => r.json()),
  ]);
  for (const [key, suffix] of [
    ["Diffuse", "color"],
    ["nor_gl", "normal"],
    ["Rough", "roughness"],
  ]) {
    const formats = files[key]["2k"],
      asset = formats.jpg ?? formats.png;
    const r = await fetch(asset.url);
    if (!r.ok) throw Error(r.status);
    const file = `textures/seawall/${prefix}-${suffix}.webp`;
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
        prefix === "stone"
          ? "Converted to 2K WebP. Darkened with a damp tidal band at runtime; generic masonry, not a Vancouver scan."
          : "Converted to 2K WebP. World-aligned at a 2 m scale on tagged seawall paving; generic herringbone blocks, not a Vancouver scan.",
    });
  }
}
await fs.writeFile(
  "public/textures/seawall/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((x) => !x.file.startsWith("textures/seawall/")),
      ...sources.map((x) => ({
        file: x.file,
        source: x.source,
        license: x.license,
        credit:
          "Poly Haven — " +
          Object.entries(x.authors)
            .map(([name, role]) => `${name} (${role})`)
            .join(", "),
        changes: x.changes,
      })),
    ],
    null,
    2,
  ) + "\n",
);
console.log("Prepared seawall masonry maps");
