import fs from "node:fs/promises";
import sharp from "sharp";
const directory = "public/textures/houses";
await fs.mkdir(directory, { recursive: true });
const sources = [];
for (const [id, label] of [
  ["white_planks_clean", "painted-wood"],
  ["grey_roof_01", "grey-roof"],
]) {
  const info = await (
    await fetch("https://api.polyhaven.com/info/" + id)
  ).json();
  const files = await (
    await fetch("https://api.polyhaven.com/files/" + id)
  ).json();
  const record = {
    id,
    title: info.name,
    source: "https://polyhaven.com/a/" + id,
    license: "CC0",
    licenseUrl: "https://polyhaven.com/license",
    authors: info.authors,
    files: {},
  };
  for (const [key, name] of [
    ["Diffuse", "color"],
    ["nor_gl", "normal"],
    ["Rough", "roughness"],
  ]) {
    const file = files[key]["1k"].jpg;
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`${response.status}: ${file.url}`);
    const raw = Buffer.from(await response.arrayBuffer());
    const filename = `${label}-${name}.webp`;
    await sharp(raw)
      .webp({ quality: 94, effort: 6 })
      .toFile(`${directory}/${filename}`);
    record.files[filename] = {
      source: file.url,
      sourceMd5: file.md5,
      modification: "1K JPEG converted to WebP at quality 94",
    };
  }
  sources.push(record);
}
await fs.writeFile(
  `${directory}/SOURCES.json`,
  JSON.stringify(sources, null, 2) + "\n",
);
console.log("Prepared licensed painted wood and grey roof photography.");
