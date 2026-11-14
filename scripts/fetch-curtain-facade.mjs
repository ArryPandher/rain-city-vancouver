import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const id = "Facade006",
  resolution = "2K-JPG";
const source = "artifacts/local/tower-source";
const output = "public/textures/curtain-wall";
await fs.mkdir(source, { recursive: true });
await fs.mkdir(output, { recursive: true });
const url = `https://ambientcg.com/get?file=${id}_${resolution}.zip`;
const archive = `${source}/${id}.zip`;
if (!(await fs.stat(archive).catch(() => null))) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  await fs.writeFile(archive, Buffer.from(await response.arrayBuffer()));
}
const names = ["Color", "NormalGL", "Roughness", "Metalness"];
execFileSync("python3", [
  "-c",
  `
import zipfile,pathlib
p=pathlib.Path(${JSON.stringify(source)})/${JSON.stringify(id)}
p.mkdir(exist_ok=True)
with zipfile.ZipFile(${JSON.stringify(archive)}) as z:
 for name in ${JSON.stringify(names)}:
  f=${JSON.stringify(`${id}_${resolution}_`)}+name+'.jpg'
  (p/f).write_bytes(z.read(f))
`,
]);
for (const name of names)
  await sharp(`${source}/${id}/${id}_${resolution}_${name}.jpg`)
    .webp({ quality: name === "NormalGL" ? 96 : 92 })
    .toFile(`${output}/${name.toLowerCase()}.webp`);

// Fit a sparse night mask to the source's fourteen panes across eight floors.
// The metalness image masks out mullions so only glass emits light.
const { data, info } = await sharp(
  `${source}/${id}/${id}_${resolution}_Metalness.jpg`,
)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const emission = Buffer.alloc(info.width * info.height * 3);
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    const col = Math.floor((x / info.width) * 14),
      row = Math.floor((y / info.height) * 8);
    const n = ((col * 7919 + row * 104729 + 3793) >>> 0) % 100;
    if (n > 18) continue;
    const pixel = y * info.width + x;
    const glass = data[pixel * info.channels] / 255;
    const blinds = 0.75 + 0.25 * Math.sin(y * 0.42) ** 2;
    const colour = n % 3 === 0 ? [169, 185, 169] : [211, 183, 131];
    for (let c = 0; c < 3; c++)
      emission[pixel * 3 + c] = Math.round(colour[c] * glass * blinds);
  }
await sharp(emission, {
  raw: { width: info.width, height: info.height, channels: 3 },
})
  .webp({ quality: 92 })
  .toFile(`${output}/emission.webp`);
await fs.writeFile(
  `${output}/SOURCES.json`,
  JSON.stringify(
    {
      title: id,
      credit: "ambientCG",
      source: `https://ambientcg.com/view?id=${id}`,
      download: url,
      license: "CC0-1.0",
      licenseUrl: "https://docs.ambientcg.com/license/",
      technique: "Artist-authored procedural PBR material; not photography",
      changes:
        "2K WebP conversion; sparse night mask derived from glass metalness. Runtime blue/green tint, physical reflectance, normal strength and 22.4 × 25.6 m tile calibration (14 panes / 8 floors).",
    },
    null,
    2,
  ) + "\n",
);
console.log("Prepared PBR curtain-wall maps and aligned night mask.");
const night = JSON.parse(
  await fs.readFile("docs/sources/night-reflections.json", "utf8"),
);
const nightFile = "public/textures/night-reflections.hdr";
if (!(await fs.stat(nightFile).catch(() => null))) {
  const response = await fetch(night.download);
  if (!response.ok) throw Error(`${response.status}: ${night.download}`);
  await fs.writeFile(nightFile, Buffer.from(await response.arrayBuffer()));
}
