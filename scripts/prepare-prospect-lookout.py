"""Extract the small mapped lookout from OSM XML; --cached reuses the local source."""
import sys,json,math,hashlib,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
url='https://api.openstreetmap.org/api/0.6/map?bbox=-123.1442,49.3125,-123.1413,49.3142'
cache=Path('artifacts/local/prospect-lookout-osm.xml')
if '--cached' not in sys.argv:
 cache.parent.mkdir(parents=True,exist_ok=True)
 cache.write_bytes(urllib.request.urlopen(url,timeout=45).read())
raw=cache.read_bytes();root=ET.fromstring(raw)
nodes={n.attrib['id']:n for n in root.findall('node')};kx=math.cos(math.radians(49.2935))*111320
ids=['1158086219','361265984','190392418','190392419','190392424','361266150','361266151','361266152','361266153','1158086217']
ways={}
for w in root.findall('way'):
 if w.attrib['id'] not in ids:continue
 pts=[]
 for n in w.findall('nd'):
  p=nodes[n.attrib['ref']];pts += [round((float(p.attrib['lon'])+123.12)*kx,2),round((49.283-float(p.attrib['lat']))*110540,2)]
 ways['w'+w.attrib['id']]={'pts':pts,'tags':{t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}}
assert len(ways)==len(ids)
out={'source':url,'sourceSha256':hashlib.sha256(raw).hexdigest(),'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','ways':ways}
Path('src/world/prospect-lookout-map.json').write_text(json.dumps(out,indent=2)+'\n')
print('Prepared',len(ways),'mapped lookout ways')
