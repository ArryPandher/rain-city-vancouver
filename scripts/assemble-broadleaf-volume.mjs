import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
const input = "artifacts/local/broadleaf-volume",
  output = "public/textures/broadleaf";
await fs.mkdir(output, { recursive: true });
const shape = JSON.parse(await fs.readFile(input + "/bounds.json", "utf8")),
  cuts = [];
const sources = [];
for (const pass of ["color", "normal"]) {
  const atlas = Buffer.alloc(4096 * 1536 * 4);
  for (const [row, axis] of ["z", "x", "y"].entries())
    for (let i = 0; i < 8; i++) {
      const rgba = await sharp(`${input}/${axis}-${i}-${pass}.png`)
          .raw()
          .toBuffer(),
        count = 512 * 512;
      if (pass === "color") {
        const bands = [];
        for (let band = 0; band < 32; band++) {
          let left = 512,
            right = -1;
          for (
            let y = Math.max(0, band * 16 - 4);
            y < Math.min(512, (band + 1) * 16 + 4);
            y++
          )
            for (let x = 0; x < 512; x++)
              if (rgba[(y * 512 + x) * 4 + 3] > 4) {
                left = Math.min(left, x);
                right = Math.max(right, x);
              }
          if (right >= left)
            bands.push([
              Math.max(0, left - 4),
              band * 16,
              Math.min(512, right + 5),
              (band + 1) * 16,
            ]);
        }
        cuts.push(bands);
      }
      const distance = new Uint8Array(count).fill(255),
        queue = new Int32Array(count);
      let head = 0,
        tail = 0;
      for (let p = 0; p < count; p++)
        if (rgba[p * 4 + 3]) {
          for (let c = 0; c < 3; c++)
            rgba[p * 4 + c] = Math.min(
              255,
              Math.round((rgba[p * 4 + c] * 255) / rgba[p * 4 + 3]),
            );
          distance[p] = 0;
          queue[tail++] = p;
        }
      while (head < tail) {
        const p = queue[head++];
        if (distance[p] >= 8) continue;
        const x = p % 512,
          y = Math.floor(p / 512);
        for (const q of [
          x ? p - 1 : -1,
          x < 511 ? p + 1 : -1,
          y ? p - 512 : -1,
          y < 511 ? p + 512 : -1,
        ]) {
          if (q < 0 || distance[q] !== 255) continue;
          distance[q] = distance[p] + 1;
          queue[tail++] = q;
          for (let c = 0; c < 3; c++) rgba[q * 4 + c] = rgba[p * 4 + c];
          rgba[q * 4 + 3] = 1;
        }
      }
      for (let y = 0; y < 512; y++)
        rgba.copy(
          atlas,
          ((row * 512 + y) * 4096 + i * 512) * 4,
          y * 512 * 4,
          (y + 1) * 512 * 4,
        );
    }
  const file = `textures/broadleaf/${pass}.webp`;
  let image = sharp(atlas, { raw: { width: 4096, height: 1536, channels: 4 } });
  if (pass === "normal") image = image.removeAlpha();
  await image
    .webp({ quality: pass === "color" ? 95 : 98, alphaQuality: 100 })
    .toFile("public/" + file);
  const data = await fs.readFile("public/" + file);
  sources.push({
    file,
    source: "https://polyhaven.com/a/tree_small_02",
    credit: "Poly Haven — Tree Small 02",
    license: "CC0-1.0",
    bytes: data.length,
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
    changes: `Leaf-only: eight depth slices in each of three perpendicular views, including the top; ${pass === "color" ? "unlit colour/alpha" : "model-space normals"}. Source: committed near tree 67a348ff. Corrected and padded multisample edges. Generic broadleaf, not a Vancouver species scan.`,
  });
}
await fs.writeFile(
  "src/world/broadleaf-volume-data.json",
  JSON.stringify({ ...shape, cuts }) + "\n",
);
await fs.writeFile(
  output + "/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((x) => !x.file.startsWith("textures/broadleaf/")),
      ...sources,
    ],
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ triangles: cuts.flat().length * 2, sources }));
