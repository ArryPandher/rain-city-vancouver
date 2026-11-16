import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";

/** Offline only. Each tile is decoded once and checked against the retained manifest. */
export function createCachedTerrariumSampler(manifest, cacheDirectory) {
  const tiles = new Map();
  const used = new Map();
  async function pixel(x, y) {
    const tx = Math.floor(x / 256),
      ty = Math.floor(y / 256);
    const key = `${tx}/${ty}`;
    if (!tiles.has(key)) {
      const record = manifest.sources.find((s) => s.x === tx && s.y === ty);
      if (!record) throw Error(`Outside retained Terrarium manifest: ${key}`);
      const pending = (async () => {
        const bytes = await fs.readFile(
          `${cacheDirectory}/${manifest.zoom}-${tx}-${ty}.png`,
        );
        if (
          crypto.createHash("sha256").update(bytes).digest("hex") !==
          record.sha256
        )
          throw Error(`Terrarium checksum mismatch: ${key}`);
        const decoded = await sharp(bytes)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        if (
          decoded.info.width !== 256 ||
          decoded.info.height !== 256 ||
          decoded.info.channels !== 3
        )
          throw Error(`Invalid Terrarium pixels: ${key}`);
        used.set(key, record);
        return decoded.data;
      })();
      tiles.set(key, pending);
    }
    const bytes = await tiles.get(key);
    const i = ((y - ty * 256) * 256 + x - tx * 256) * 3;
    return bytes[i] * 256 + bytes[i + 1] + bytes[i + 2] / 256 - 32768;
  }
  return {
    async sample(lat, lon) {
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) >= 85.051129
      )
        throw Error("Invalid Mercator sample coordinate");
      const scale = 2 ** manifest.zoom * 256;
      const x = ((lon + 180) / 360) * scale - 0.5;
      const y =
        ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) *
          scale -
        0.5;
      const ix = Math.floor(x),
        iy = Math.floor(y),
        u = x - ix,
        v = y - iy;
      const [a, b, c, d] = await Promise.all([
        pixel(ix, iy),
        pixel(ix + 1, iy),
        pixel(ix, iy + 1),
        pixel(ix + 1, iy + 1),
      ]);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    },
    sources: () => [...used.values()].sort((a, b) => a.y - b.y || a.x - b.x),
  };
}
