import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const source =
  "https://api.openstreetmap.org/api/0.6/map?bbox=-123.1215,49.2888,-123.1162,49.2907";
// Cache the small map extract. --refresh explicitly re-requests the public API.
await fs.mkdir("artifacts/local", { recursive: true });
const data = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      `
import json,sys,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
p=Path("artifacts/local/plaza-osm.xml")
if not p.exists() or sys.argv[2]=="refresh":
 req=urllib.request.Request(sys.argv[1],headers={"User-Agent":"RainCityVancouver/0.1 (https://github.com/ArryPandher/rain-city-vancouver)"})
 with urllib.request.urlopen(req,timeout=60) as r:p.write_bytes(r.read())
root=ET.fromstring(p.read_bytes())
nodes={int(n.attrib["id"]):{"lat":float(n.attrib["lat"]),"lon":float(n.attrib["lon"])} for n in root.findall("node")}
elements=[]
for e in root:
 if e.tag not in ("node","way"):continue
 item={"type":e.tag,"id":int(e.attrib["id"]),"tags":{t.attrib["k"]:t.attrib["v"] for t in e.findall("tag")}}
 if e.tag=="node":item.update(nodes[item["id"]])
 else:item["geometry"]=[nodes[int(n.attrib["ref"])] for n in e.findall("nd")]
 elements.append(item)
print(json.dumps({"elements":elements}))
`,
      source,
      process.argv.includes("--refresh") ? "refresh" : "cache",
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  ),
);
const ids = [
  89118744, 89118742, 223634909, 1070091596, 1216968927, 159354908, 159354910,
  223634905, 223634906, 223634907, 223634908, 223634910, 358443046, 89118741,
  119945024, 159354913, 82249874, 364263627, 116527975, 358443048, 358443049,
];
const kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
const point = (p) => [
  Math.round((p.lon + 123.12) * kx * 100) / 100,
  Math.round((49.283 - p.lat) * 110540 * 100) / 100,
];
const ways = {};
for (const id of ids) {
  const e = data.elements.find((e) => e.type === "way" && e.id === id);
  if (!e) throw Error(`Missing ${id}`);
  const tags = Object.fromEntries(
    Object.entries(e.tags).filter(([k]) =>
      [
        "name",
        "highway",
        "incline",
        "step_count",
        "surface",
        "layer",
        "building",
        "landuse",
        "natural",
        "water",
        "description",
      ].includes(k),
    ),
  );
  ways["w" + id] = { pts: e.geometry.flatMap(point), tags };
}
const nodes = {};
for (const id of [648735254, 2322709550]) {
  const e = data.elements.find((e) => e.type === "node" && e.id === id);
  nodes["n" + id] = { point: point(e), name: e.tags.name };
}
await fs.writeFile(
  "src/world/jack-poole-map.json",
  JSON.stringify({
    source,
    fetched: (await fs.stat("artifacts/local/plaza-osm.xml")).mtime
      .toISOString()
      .slice(0, 10),
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    ways,
    nodes,
  }) + "\n",
);
console.log("Prepared mapped plaza structures, stairs, paths and coastline");
