import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const source =
  "https://api.openstreetmap.org/api/0.6/map?bbox=-123.1181,49.2875,-123.1153,49.2889";
// Cache the small map extract. --refresh explicitly re-requests the public API.
await fs.mkdir("artifacts/local/fairmont-reference", { recursive: true });
const data = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      `
import json,sys,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
p=Path("artifacts/local/fairmont-reference/osm.xml")
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
  143683979, 360438242, 360607252, 360607253, 360607254, 360607257, 360607258,
  360607259,
];
const kx = Math.cos((49.2935 * Math.PI) / 180) * 111320;
const point = (p) => [
  Math.round((p.lon + 123.12) * kx * 100) / 100,
  Math.round((49.283 - p.lat) * 110540 * 100) / 100,
];
const parts = ids.map((id) => {
  const e = data.elements.find((e) => e.type === "way" && e.id === id);
  if (!e) throw Error(`Missing ${id}`);
  return {
    id: "w" + id,
    height: Number.parseFloat(e.tags.height || "0"),
    minHeight: Number.parseFloat(e.tags.min_height || "0"),
    pts: e.geometry.slice(0, -1).map(point),
  };
});
await fs.writeFile(
  "src/world/fairmont-map.json",
  JSON.stringify({
    source,
    fetched: (await fs.stat("artifacts/local/fairmont-reference/osm.xml")).mtime
      .toISOString()
      .slice(0, 10),
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    parts,
  }) + "\n",
);
console.log("Prepared eight mapped Fairmont footprints and height ranges");
