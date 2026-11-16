/** No network fallback: produces/validates a small source-aligned lower ground study. */
import fs from "node:fs/promises";
import { createCachedTerrariumSampler } from "./lib/cached-terrarium.mjs";
const dem = JSON.parse(
  await fs.readFile("src/world/north-shore-dem-data.json", "utf8"),
);
const sampler = createCachedTerrariumSampler(
  dem,
  "artifacts/local/north-shore-dem",
);
const cells = { minCol: 201, maxCol: 270, minRow: 208, maxRow: 290 };
const halo = 1;
const elevations = [];
for (let row = cells.minRow - halo; row <= cells.maxRow + halo; row++) {
  for (let col = cells.minCol - halo; col <= cells.maxCol + halo; col++) {
    const lat =
      dem.bounds.north +
      ((dem.bounds.south - dem.bounds.north) * row) / (dem.height - 1);
    const lon =
      dem.bounds.west +
      ((dem.bounds.east - dem.bounds.west) * col) / (dem.width - 1);
    const value = Math.round(
      (await sampler.sample(lat, lon)) / dem.metresPerUnit,
    );
    if (row < dem.height && value !== dem.elevations[row * dem.width + col])
      throw Error(`Overlap source differs at ${col},${row}`);
    elevations.push(value);
  }
}
const result = {
  format: 1,
  scope:
    "Unattached lower North Shore diagnostic ground study; open integration perimeter, not playable support",
  parentGrid: { bounds: dem.bounds, width: dem.width, height: dem.height },
  cells,
  halo,
  width: cells.maxCol - cells.minCol + 1,
  height: cells.maxRow - cells.minRow + 1,
  metresPerUnit: dem.metresPerUnit,
  projection: dem.projection,
  encoding: dem.encoding,
  attribution: dem.attribution,
  licence: dem.licence,
  sourceDocumentation: dem.sourceDocumentation,
  zoom: dem.zoom,
  sources: sampler.sources(),
  elevations,
};
const serialized = JSON.stringify(result) + "\n";
const output = "src/world/north-shore-ground-data.json";
if (process.argv.includes("--verify")) {
  if ((await fs.readFile(output, "utf8")) !== serialized)
    throw Error("Ground derivative differs from cached source");
} else await fs.writeFile(output, serialized);
console.log(
  JSON.stringify({
    output,
    bytes: serialized.length,
    tiles: result.sources.length,
    vertices: result.width * result.height,
    triangles: (result.width - 1) * (result.height - 1) * 2,
    heightRange: [
      Math.min(...elevations) * 0.25,
      Math.max(...elevations) * 0.25,
    ],
  }),
);
