# Vancouver road layer

Source: OpenStreetMap via Overpass, base timestamp **2026-11-14T10:48:21Z**. © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

Reproduction: `node scripts/fetch-roads.mjs`. The raw request is cached under ignored `artifacts/local/road-metadata-osm.json`; the derived database is `public/data/vancouver-roads.json`. Existing downtown and eastern land/building layers remain separate. If the new road file cannot load, the original road layers remain playable.

The extract retains 30,063 outdoor road/path ways, including 3,155 one-way ways, 3,930 tagged lane counts, 461 width tags and 6,500 sidewalk ways. Foot access, sidewalk sides, surface, crossing status and original highway type are retained. Ways marked indoor, underground, construction or proposed are omitted from the visible ground road layer. Geometry is rounded to 0.1 m and reverse one-way ways are reoriented to the permitted direction.

Mapped widths take priority; otherwise width is estimated from lane count (3.2 m per city lane, 3.6 m on motorway ways, plus 0.6 m total edge allowance). Missing lane counts/widths use class defaults. Lane dividers distinguish same-direction white lines from opposing yellow lines and account for mapped asymmetric forward/backward counts. Separate mapped sidewalks suppress duplicate generated sidewalks. Street furniture candidates are rejected inside any neighbouring street surface.

These details improve the map interpretation; they do not provide surveyed curbs, traffic signals, lane restrictions or a full road simulation. Bridge elevations remain the existing authored approximations.

Crossing markings follow tagged crossing ways: paired boundary lines for `lines`, transverse bars for `zebra`/`ladder`, and no paint for `no` or missing markings. The older arbitrary crosswalks at the first segment of named streets have been removed. The Ironworkers fast-travel point is on the northbound approach.
