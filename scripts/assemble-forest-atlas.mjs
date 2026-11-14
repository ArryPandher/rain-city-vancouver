import sharp from "sharp";
await sharp({
  create: { width: 4096, height: 2048, channels: 4, background: "#00000000" },
})
  .composite(
    ["c-0", "c-1", "b-0", "b-1"].map((view, i) => ({
      input: `artifacts/local/forest-conifer-${view}.png`,
      left: i * 1024,
      top: 0,
    })),
  )
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile("public/textures/forest/conifer-atlas-pair.webp");
console.log("Packed two views of each conifer variant into the distant-tree atlas.");
