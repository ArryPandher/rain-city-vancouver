import fs from "node:fs/promises";
const base = "https://3d-assets.codriver.io";
const catalog = await (await fetch(base + "/asset-catalog.json")).json();
const wanted = catalog.assets.filter(
  (a) => a.city === "Vancouver" && a.kind === "building",
);
const saved = [];
await fs.mkdir("public/models/vancouver", { recursive: true });
await fs.mkdir("docs/sources", { recursive: true });
for (const a of wanted) {
  const file = a.id + ".glb";
  const asset = a.model.assets.near;
  const response = await fetch(base + asset.url);
  if (!response.ok) throw new Error(`${response.status} ${file}`);
  await fs.writeFile(
    "public/models/vancouver/" + file,
    Buffer.from(await response.arrayBuffer()),
  );
  const manifest = await (await fetch(base + a.manifest)).json();
  await fs.writeFile(
    "docs/sources/" + a.id + ".json",
    JSON.stringify(manifest, null, 2),
  );
  saved.push({
    id: a.id,
    name: a.name,
    origin: a.model.origin,
    height: a.model.height,
    bounds: asset.bounds,
    file: "models/vancouver/" + file,
    source: base + asset.url,
    sourceCode: a.source.url,
    license: a.license,
    attribution: a.attribution,
    copyright: a.copyright,
    notes: a.notes,
    references: a.source.references,
  });
  console.log(a.id, asset.bytes);
}
await fs.writeFile(
  "public/data/vancouver-landmarks.json",
  JSON.stringify(saved, null, 2),
);
await fs.writeFile(
  "docs/sources/CODRIVER-MODEL-LICENSE.md",
  await (
    await fetch(
      "https://raw.githubusercontent.com/codriver-io/codriver-3d-assets/main/LICENSE-MODELS.txt",
    )
  ).text(),
);
