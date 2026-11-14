import sharp from "sharp";
await sharp({
  create: { width: 2048, height: 2048, channels: 4, background: "#00000000" },
})
  .composite(
    [0, 1].map((i) => ({
      input: `artifacts/local/forest-conifer-${i}.png`,
      left: i * 1024,
      top: 0,
    })),
  )
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile("public/textures/forest/conifer-atlas.webp");
console.log("Packed the two unlit conifer views into the distant-tree atlas.");
