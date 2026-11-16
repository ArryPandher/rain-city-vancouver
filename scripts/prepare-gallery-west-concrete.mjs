import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const root = "public/textures/gallery-west-concrete";
const source = JSON.parse(
  await fs.readFile("public/textures/cast-concrete/SOURCES.json", "utf8"),
);
await fs.mkdir(root, { recursive: true });
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const meanRGB = async (path) => {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [0, 1, 2].map((c) => {
    let sum = 0;
    for (let i = c; i < data.length; i += info.channels)
      sum += linear(data[i] / 255);
    return sum / (info.width * info.height);
  });
};
const files = [];
for (const kind of ["color", "normal", "roughness"]) {
  const bytes = await fs.readFile(`public/textures/cast-concrete/${kind}.jpg`);
  if (createHash("md5").update(bytes).digest("hex") !== source.files[kind].md5)
    throw Error("Source changed");
  const { data, info } = await sharp(bytes)
    .extract({ left: 300, top: 380, width: 200, height: 200 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(400 * 400 * 3);
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 400; x++) {
      const fx = x >= 200,
        fy = y >= 200,
        i = ((fy ? 399 - y : y) * 200 + (fx ? 399 - x : x)) * info.channels;
      for (let c = 0; c < 3; c++) {
        let v = data[i + c];
        if (kind === "normal" && ((c === 0 && fx) || (c === 1 && fy)))
          v = 255 - v;
        if (kind === "roughness")
          v = Math.round(255 * (0.82 + (0.16 * v) / 255));
        out[(y * 400 + x) * 3 + c] = v;
      }
    }
  const path = `${root}/${kind}.webp`;
  await sharp(out, { raw: { width: 400, height: 400, channels: 3 } })
    .webp({ lossless: true })
    .toFile(path);
  const output = await fs.readFile(path);
  files.push({
    kind,
    file: path,
    source: source.files[kind],
    bytes: output.length,
    sha256: createHash("sha256").update(output).digest("hex"),
  });
}
const oldMean = await meanRGB("public/textures/landmarks/mineral-color.webp"),
  newMean = await meanRGB(`${root}/color.webp`);
const meanCompensation = oldMean.map((v, i) => v / newMean[i]);
await fs.writeFile(
  `${root}/SOURCES.json`,
  JSON.stringify(
    {
      title: "Gallery west cast-concrete grain",
      author: "Charlotte Baglioni / Poly Haven",
      source: source.source,
      license: source.license,
      licenseUrl: source.licenseUrl,
      crop: { left: 300, top: 380, width: 200, height: 200 },
      changes:
        "Joint/tie-hole-free crop from committed 1K maps, mirrored to 400px with normal X/Y sign corrections; original color retained, source roughness remapped to dry range .82–.98; lossless WebP. Not a Gallery scan.",
      repeatMetres: 0.6,
      scaleStatus:
        "Authored plausible grain scale, not surveyed. Original crop covers .3m; several-pixel surface marks become millimetres, not wall-sized holes.",
      oldMeanLinearRGB: oldMean,
      newMeanLinearRGB: newMean,
      meanCompensation,
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log({ meanCompensation, files });
