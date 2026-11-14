import fs from "node:fs/promises";
import sharp from "sharp";
await fs.mkdir("public/textures/forest/volume", { recursive: true });
const sources = [];
const cuts = { c: [], b: [] };
for (const variant of ["c", "b"])
  for (const pass of ["color", "normal"]) {
    const atlas = Buffer.alloc(4096 * 2048 * 4);
    for (const [row, axis] of ["z", "x"].entries())
      for (let i = 0; i < 8; i++) {
        const rgba = await sharp(
            `artifacts/local/conifer-volume/${variant}-${axis}-${i}-${pass}.png`,
          )
            .raw()
            .toBuffer(),
          count = 512 * 1024,
          dist = new Uint8Array(count).fill(255),
          queue = new Int32Array(count);
        if (pass === "color") {
          const bands = [];
          for (let band = 0; band < 16; band++) {
            let left = 512,
              right = -1;
            for (
              let y = Math.max(0, band * 64 - 8);
              y < Math.min(1024, (band + 1) * 64 + 8);
              y++
            )
              for (let x = 0; x < 512; x++)
                if (rgba[(y * 512 + x) * 4 + 3] > 4) {
                  left = Math.min(left, x);
                  right = Math.max(right, x);
                }
            if (right >= left)
              bands.push([
                Math.max(0, left - 8),
                band * 64,
                Math.min(512, right + 9),
                (band + 1) * 64,
              ]);
          }
          cuts[variant].push(bands);
        }
        let head = 0,
          tail = 0;
        // Multisample resolve produced premultiplied edge colours. Undo that
        // before padding RGB beneath the transparent edge for mip filtering.
        for (let p = 0; p < count; p++)
          if (rgba[p * 4 + 3]) {
            for (let c = 0; c < 3; c++)
              rgba[p * 4 + c] = Math.min(
                255,
                Math.round((rgba[p * 4 + c] * 255) / rgba[p * 4 + 3]),
              );
            dist[p] = 0;
            queue[tail++] = p;
          }
        while (head < tail) {
          const p = queue[head++];
          if (dist[p] >= 8) continue;
          const x = p % 512,
            y = Math.floor(p / 512);
          for (const q of [
            x ? p - 1 : -1,
            x < 511 ? p + 1 : -1,
            y ? p - 512 : -1,
            y < 1023 ? p + 512 : -1,
          ]) {
            if (q < 0 || dist[q] !== 255) continue;
            dist[q] = dist[p] + 1;
            queue[tail++] = q;
            for (let c = 0; c < 3; c++) rgba[q * 4 + c] = rgba[p * 4 + c];
            // WebP preserves RGB in nonzero-alpha pixels; this is far below
            // the draw cutoff and does not make the padded area visible.
            rgba[q * 4 + 3] = 1;
          }
        }
        for (let y = 0; y < 1024; y++)
          rgba.copy(
            atlas,
            ((row * 1024 + y) * 4096 + i * 512) * 4,
            y * 512 * 4,
            (y + 1) * 512 * 4,
          );
      }
    const file = `textures/forest/volume/${variant}-${pass}.webp`;
    let image = sharp(atlas, {
      raw: { width: 4096, height: 2048, channels: 4 },
    });
    if (pass === "normal") image = image.removeAlpha();
    await image
      .webp({ quality: pass === "color" ? 94 : 97, alphaQuality: 100 })
      .toFile(`public/${file}`);
    sources.push({
      file,
      source: "https://polyhaven.com/a/fir_tree_01",
      authors: { "Rob Tuytel": "photography", "Rico Cilliers": "modeling" },
      license: "CC0-1.0",
      changes: `Eight depth slices in each of two perpendicular views, baked from the committed ${variant.toUpperCase()} near model with a 0.12 foliage cutoff; ${pass === "color" ? "unlit colour and alpha" : "model-space normals including the source twig normal map and GLTFLoader tangent convention"}. Premultiplied edges corrected and padded for filtering. Original runtime slice geometry/shader is MIT. Generic conifer, not a Vancouver scan.`,
    });
  }
await fs.writeFile(
  "public/textures/forest/volume/SOURCES.json",
  JSON.stringify(sources, null, 2) + "\n",
);
await fs.writeFile(
  "src/world/conifer-volume-cuts.json",
  JSON.stringify(cuts) + "\n",
);
const manifest = JSON.parse(
  await fs.readFile("public/asset-manifest.json", "utf8"),
);
await fs.writeFile(
  "public/asset-manifest.json",
  JSON.stringify(
    [
      ...manifest.filter((x) => !x.file.startsWith("textures/forest/volume/")),
      ...sources.map((s) => ({
        ...s,
        credit: "Poly Haven — Rob Tuytel and Rico Cilliers",
      })),
    ],
    null,
    2,
  ) + "\n",
);
console.log("Assembled conifer foliage color and model-space normal slices.");
