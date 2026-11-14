import fs from "node:fs/promises";

const directory = "public/textures/cast-concrete";
const manifest = JSON.parse(
  await fs.readFile(`${directory}/SOURCES.json`, "utf8"),
);
await fs.mkdir(directory, { recursive: true });
for (const [name, source] of Object.entries(manifest.files)) {
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`${response.status}: ${source.url}`);
  await fs.writeFile(
    `${directory}/${name}.jpg`,
    Buffer.from(await response.arrayBuffer()),
  );
}
console.log("Restored the licensed cast-concrete maps.");
