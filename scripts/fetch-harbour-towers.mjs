import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const source =
  "https://api.openstreetmap.org/api/0.6/map?bbox=-123.126,49.2879,-123.1177,49.2915";
const dir = "artifacts/local/harbour-green-reference";
await fs.mkdir(dir, { recursive: true });
const xml = `${dir}/osm.xml`;
if (
  process.argv.includes("--refresh") ||
  !(await fs.access(xml).then(
    () => true,
    () => false,
  ))
) {
  const r = await fetch(source);
  if (!r.ok) throw Error(`OSM ${r.status}`);
  await fs.writeFile(xml, await r.text());
}
const ways = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      `
import json,xml.etree.ElementTree as E,sys,math
r=E.parse(sys.argv[1]).getroot(); ns={n.attrib['id']:(float(n.attrib['lon']),float(n.attrib['lat'])) for n in r.findall('node')}
def point(n):
 lon,lat=ns[n.attrib['ref']];return [round((lon+123.12)*math.cos(math.radians(49.2935))*111320,2),round((49.283-lat)*110540,2)]
print(json.dumps([{'id':'w'+w.attrib['id'],'tags':{t.attrib['k']:t.attrib['v'] for t in w.findall('tag')},'pts':[point(n) for n in w.findall('nd')][:-1]} for w in r.findall('way')]))
`,
      xml,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  ),
);
const ids = [
  [224131617, 361794723, 361794726, 361794728, 361794731, 361794732],
  [224131618, 361791773, 361791774, 361791775, 361791776, 361791777],
  [224544078, 361790280, 361790281, 361790283, 361790285, 361790286, 361792026],
];
const buildings = ids.map((group, i) => ({
  id: "w" + group[0],
  name: ["One", "Two", "Three"][i] + " Harbour Green",
  height: [80, 105, 116][i],
  levels: [23, 31, 32][i],
  parts: group.map((id) => {
    const w = ways.find((w) => w.id === "w" + id);
    if (!w) throw Error(`Missing ${id}`);
    return {
      id: w.id,
      sourceHeight: Number.parseFloat(w.tags.height),
      minHeight: Number.parseFloat(w.tags.min_height || "0"),
      pts: w.pts,
    };
  }),
}));
await fs.writeFile(
  "src/world/harbour-towers-map.json",
  JSON.stringify({
    source,
    fetched: (await fs.stat(xml)).mtime.toISOString().slice(0, 10),
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    heightSource: "https://aspac.ca/project/harbour-green/",
    buildings,
  }) + "\n",
);
console.log("Prepared 19 Harbour Green podium and tower outlines.");
