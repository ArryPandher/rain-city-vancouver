import fs from "node:fs/promises";
import sharp from "sharp";

// Original photographed panoramas are CC0. They provide fictional shop interiors,
// not reconstructions of the Vancouver businesses behind these façades.
const ids = ["comfy_cafe", "decor_shop", "phone_shop"];
const source = "artifacts/local/interior-source";
const output = "public/textures/interiors";
await fs.mkdir(source, { recursive: true });
await fs.mkdir(output, { recursive: true });
const records = [];
for (const id of ids) {
  const [info, files] = await Promise.all(
    ["info", "files"].map(async (kind) => {
      const response = await fetch(`https://api.polyhaven.com/${kind}/${id}`);
      if (!response.ok) throw Error(`${response.status}: ${id}`);
      return response.json();
    }),
  );
  const original = `${source}/${id}.jpg`;
  if (!(await fs.stat(original).catch(() => null))) {
    const response = await fetch(files.tonemapped.url);
    if (!response.ok) throw Error(`${response.status}: ${id}`);
    await fs.writeFile(original, Buffer.from(await response.arrayBuffer()));
  }
  await sharp(original)
    .resize({ width: 4096 })
    .webp({ quality: 87 })
    .toFile(`${output}/${id}.webp`);
  records.push({
    id,
    title: info.name,
    authors: info.authors,
    source: `https://polyhaven.com/a/${id}`,
    download: files.tonemapped.url,
    license: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    changes:
      "Resized to 4096 × 2048 WebP; box-projected behind fictional shop windows.",
  });
}
await fs.writeFile(
  `${output}/SOURCES.json`,
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Prepared three photographed shop interiors.");
