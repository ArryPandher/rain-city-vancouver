import fs from "node:fs/promises";
import sharp from "sharp";
const root = "public/textures/harbour-green";
await fs.mkdir(root, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><rect width="1600" height="800" fill="#163d36"/><rect x="36" y="36" width="1528" height="728" rx="4" fill="none" stroke="#dae1d6" stroke-width="5"/><text x="800" y="348" text-anchor="middle" font-family="Georgia,serif" font-size="188" fill="#f3f2e3">Harbour Green</text><text x="800" y="571" text-anchor="middle" font-family="Georgia,serif" font-size="182" fill="#f3f2e3">Park</text></svg>`;
await sharp(Buffer.from(svg))
  .webp({ quality: 94 })
  .toFile(root + "/park-sign.webp");
const entry = {
  file: "textures/harbour-green/park-sign.webp",
  source:
    "https://github.com/ArryPandher/rain-city-vancouver/blob/main/scripts/generate-harbour-sign.mjs",
  license: "MIT",
  credit: "Arry Pandher / Rain City Vancouver",
  changes:
    "Original green-and-white serif park sign, informed by reference photography. No photograph or official park logo is reproduced. Location and proportions are interpreted.",
};
for (const path of [root + "/SOURCES.json", "public/asset-manifest.json"]) {
  const entries = JSON.parse(await fs.readFile(path, "utf8"));
  await fs.writeFile(
    path,
    JSON.stringify(
      [...entries.filter((x) => x.file !== entry.file), entry],
      null,
      2,
    ) + "\n",
  );
}
