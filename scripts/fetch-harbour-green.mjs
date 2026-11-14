import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const source =
  "https://api.openstreetmap.org/api/0.6/map?bbox=-123.126,49.2879,-123.1177,49.2915";
await fs.mkdir("artifacts/local/harbour-green-reference", { recursive: true });
const result = execFileSync(
  "python3",
  [
    "-c",
    `
import sys,json,math,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
p=Path('artifacts/local/harbour-green-reference/osm.xml')
if not p.exists() or sys.argv[2]=='refresh':
 req=urllib.request.Request(sys.argv[1],headers={'User-Agent':'RainCityVancouver/0.1 (https://github.com/ArryPandher/rain-city-vancouver)'})
 p.write_bytes(urllib.request.urlopen(req,timeout=60).read())
kx=math.cos(math.radians(49.2935))*111320;root=ET.fromstring(p.read_bytes())
nodes={n.attrib['id']:[round((float(n.attrib['lon'])+123.12)*kx,2),round((49.283-float(n.attrib['lat']))*110540,2)] for n in root.findall('node')}
ids=[37057434,48271064,48271068,48271069,85240506,85240508,85240509,85240510,85240511,85240512,85240513,85240514,85240518,85240520,85240521,85240523,85240524,85240525,85240526,116527979,116527982,223936051,223936052,223936053,223936054,223936055,223936056,591277605,1020194981,1020194982,1086856958,1086856961,1086856962,1086856963,1104112434,1105669952,1105669953,1216968927]
ways={};pois=[]
for e in root:
 t={v.attrib['k']:v.attrib['v'] for v in e.findall('tag')};id=e.attrib.get('id')
 if e.tag=='way' and int(id) in ids:ways['w'+id]={'pts':[nodes[n.attrib['ref']] for n in e.findall('nd')],'tags':t}
 if e.tag=='node' and t.get('amenity') in ['bench','drinking_water','bicycle_parking']:
  x,z=nodes[id]
  if -310<x<85 and -945<z<-690:pois.append({'id':'n'+id,'point':[x,z],'tags':t})
print(json.dumps({'source':sys.argv[1],'fetched':'2026-11-14','license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','ways':ways,'pois':pois}))
`,
    source,
    process.argv.includes("--refresh") ? "refresh" : "cache",
  ],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
await fs.writeFile("src/world/harbour-green-map.json", result);
console.log(
  "Prepared Harbour Green paths, park, fountain, shore and furniture records",
);
