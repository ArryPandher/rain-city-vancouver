import fs from "node:fs/promises";
import sharp from "sharp";
import { createHash } from "node:crypto";
const destination = "public/textures/landmarks";
await fs.mkdir(destination, { recursive: true });
const sources = [];
for (const [family, id] of [
  ["brick", "red_brick"],
  ["mineral", "granite_tile"],
  ["patina", "green_metal_rust"],
]) {
  const info = await (
    await fetch(`https://api.polyhaven.com/info/${id}`)
  ).json();
  const files = await (
    await fetch(`https://api.polyhaven.com/files/${id}`)
  ).json();
  for (const [kind, keys] of [
    ["color", ["diff", "Diffuse"]],
    ["normal", ["nor_gl"]],
    ["roughness", ["rough", "Rough"]],
  ]) {
    const key = keys.find((k) => files[k]),
      item = files[key]["2k"].jpg ?? files[key]["2k"].png;
    const response = await fetch(item.url);
    if (!response.ok) throw Error(`${id}: ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    if (createHash("md5").update(source).digest("hex") !== item.md5)
      throw Error(`Checksum mismatch: ${item.url}`);
    let input = sharp(source).removeAlpha();
    if (family === "mineral")
      input = input.extract({ left: 32, top: 32, width: 448, height: 448 });
    const { data, info: meta } = await input
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgb = Buffer.alloc(meta.width * meta.height * 3);
    for (let p = 0; p < meta.width * meta.height; p++) {
      const values = [0, 1, 2].map(
        (c) => data[p * meta.channels + Math.min(c, meta.channels - 1)],
      );
      if (kind === "color" && family !== "brick") {
        const grey = (values[0] + values[1] + values[2]) / 3;
        // Preserve photographed variation while letting each building supply its
        // own stone/terracotta/copper colour. This is not a site material scan.
        const neutral = Math.round(
          218 + Math.min(1, Math.max(0, grey / 170)) * 35,
        );
        rgb.fill(neutral, p * 3, p * 3 + 3);
      } else for (let c = 0; c < 3; c++) rgb[p * 3 + c] = values[c];
    }
    let final = rgb,
      width = meta.width,
      height = meta.height;
    if (family === "mineral") {
      width *= 2;
      height *= 2;
      final = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const flipX = x >= meta.width,
            flipY = y >= meta.height;
          const sx = flipX ? width - x - 1 : x,
            sy = flipY ? height - y - 1 : y;
          for (let c = 0; c < 3; c++) {
            const value = rgb[(sy * meta.width + sx) * 3 + c];
            final[(y * width + x) * 3 + c] =
              kind === "normal" && ((c === 0 && flipX) || (c === 1 && flipY))
                ? 255 - value
                : value;
          }
        }
    }
    const file = `textures/landmarks/${family}-${kind}.webp`;
    await sharp(final, { raw: { width, height, channels: 3 } })
      .resize(family === "brick" ? 2048 : 1024)
      .webp({ quality: kind === "normal" ? 96 : 92 })
      .toFile("public/" + file);
    sources.push({
      file,
      source: `https://polyhaven.com/a/${id}`,
      download: item.url,
      sourceMd5: item.md5,
      authors: info.authors,
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      changes:
        family === "mineral"
          ? "Cropped one granite tile face away from floor joints; mirrored seamlessly with normal R/G signs corrected, neutralized colour and resized to 1K. Generic fine mineral detail, not Haddington Island stone or a Vancouver scan."
          : family === "patina"
            ? "Weathered painted-metal photograph neutralized for authored patina colour and resized to 1K. Surface variation is an approximation, not scanned copper."
            : "2K diffuse/OpenGL-normal/roughness maps converted to WebP. Generic red brick, not a scan of Waterfront Station.",
    });
  }
  console.log(family, {
    authors: info.authors,
    dimensions: info.dimensions,
    scale: info.scale,
  });
}
await fs.writeFile(
  destination + "/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
const manifest = JSON.parse(await fs.readFile("public/asset-manifest.json"));
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((x) => !x.file.startsWith("textures/landmarks/")),
      ...sources.map((x) => ({
        ...x,
        credit: Object.keys(x.authors).join(", ") + " / Poly Haven",
      })),
    ],
    null,
    2,
  ) + "\n",
);
