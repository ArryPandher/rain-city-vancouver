import fs from "node:fs/promises";
import sharp from "sharp";
const root = "public/textures/harbour-green";
await fs.mkdir(root, { recursive: true });
const sources = [];
for (const id of ["grass_ground", "granite_tile"]) {
  const read = async (k) => {
    const r = await fetch("https://api.polyhaven.com/" + k + "/" + id);
    if (!r.ok) throw Error(r.status + " " + id);
    return r.json();
  };
  const [info, files] = await Promise.all([read("info"), read("files")]);
  for (const [key, suffix] of [
    ["Diffuse", "color"],
    ["nor_gl", "normal"],
    ["Rough", "roughness"],
  ]) {
    const a = files[key]["2k"].jpg ?? files[key]["2k"].png;
    const r = await fetch(a.url);
    if (!r.ok) throw Error(r.status + " " + a.url);
    let pipeline = sharp(Buffer.from(await r.arrayBuffer())).resize(2048, 2048);
    if (id === "grass_ground" && suffix === "color")
      pipeline = pipeline.modulate({
        hue: 27,
        saturation: 1.12,
        brightness: 1.06,
      });
    const file = `textures/harbour-green/${id}-${suffix}.webp`;
    await pipeline
      .webp({ quality: suffix === "normal" ? 94 : 90 })
      .toFile("public/" + file);
    sources.push({
      file,
      source: "https://polyhaven.com/a/" + id,
      download: a.url,
      authors: info.authors,
      license: "CC0-1.0",
      dimensionsMetres: info.dimensions.map((n) => n / 1000),
      changes:
        "Converted to 2K WebP. " +
        (id === "grass_ground" && suffix === "color"
          ? "Colour shifted toward green for maintained Vancouver park lawns. "
          : "") +
        "Source photography is generic, not a park scan.",
    });
  }
}
await fs.writeFile(
  root + "/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((x) => !x.file.startsWith("textures/harbour-green/")),
      ...sources.map((x) => ({
        file: x.file,
        source: x.source,
        license: x.license,
        credit: "Charlotte Baglioni / Poly Haven",
        changes: x.changes,
      })),
    ],
    null,
    2,
  ) + "\n",
);
console.log("Prepared six grass/granite maps and CC0 provenance");

await import("./generate-harbour-sign.mjs");
