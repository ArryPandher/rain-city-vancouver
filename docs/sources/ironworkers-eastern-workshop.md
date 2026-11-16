# Ironworkers eastern bridgehead workshop

2026-11-16. One bounded source-registered building replacement, **OSM w23776223**.
The previous generic 12.8m flat block becomes the existing long gabled workshop
seen immediately east of the northern bridge approach. The neighbouring broad
shed, covered berths, roads, railway, shoreline and terrain are unchanged.

## Registration and references

- [District of North Vancouver 2024 orthophoto service](https://geoweb.dnv.org/arcgis/rest/services/Basemap_Ortho2024/MapServer).
  A bounded `export` request uses `bbox=-123.030,49.297,-123.021,49.303`,
  `bboxSR=4326&imageSR=3857&size=1200,1200&format=jpg&f=image`.
  The matching `f=pjson` response supplies the adjusted image envelope:
  x−13695648.143541092..−13694623.885634668,
  y6325407.161206606..6326431.419113029, EPSG3857.
  A second bounded 1200×1080 request at bbox−123.0263,49.3001,−123.0246,49.3011
  resolves the roof ridge and seams. These are research images, not runtime maps.
- [Graham bridge improvements](https://www.grahambuilds.com/ironworkers-memorial-bridge-improvements/)
  supplies the view northward from the eastern bridge edge: the selected long grey
  workshop sits behind the eastern edge of the open yard, left of the railway.
  Its long wall has repeated narrow dark bays and its southern end a large dark
  door. The broad paired-roof structure closer to the bridge is a different ID,
  w23776220, and is preserved. No photograph is redistributed as a game texture.
- Original source: `public/data/vancouver-east.json`, SHA256
  `1977b623c82edabe032b5524e3f951d7ef466a94bae4b0f436cccd0a94a7f295`.
  Exact ring in `src/world/ironworkers-yard-source.json`; four vertices are
  [6884.3,−1921.5], [6903.6,−1929.5], [6884.9,−1971], [6865.6,−1963.5].
  Public original: https://www.openstreetmap.org/way/23776223 .
  The workshop is about20.8m wide and45.8m long; centre[6884.6,−1946.375],
  257m/+19.8° east of north from the recorded crest[6797.68,−1704.90].
- [Lynnwood Marina's location description](https://lynnwoodmarina.com/about-lynnwood-marina/)
  explicitly places its marina west of the bridge. The new model does not assign
  that business name to this eastern workshop. The eastern boat moorings shown
  farther south in the Graham image are separately located, not this land building.

The public DNV data portal publishes under the
[Open Government Licence — North Vancouver](https://geoweb.dnv.org/data/):
**Contains information licensed under the Open Government Licence - North Vancouver.**
OSM footprint: **© OpenStreetMap contributors, ODbL1.0**. Original modeled geometry
and flat materials are authored in this repository. Contractor photography is a
visual reference only; no open redistribution licence is assumed.

## Measured versus estimated

The exact OSM ring and longitudinal roof direction are established by the aerial
registration. The roof is a single gable, not the broad paired roof on w23776220.
Eave6.4m, ridge9.6m,11 long-wall bays, closed end doors and muted mineral/metal
colours are **photo estimates**, not surveyed heights or a structural drawing.
The source itself has no height, levels or roof tags; its old12.8m height was a
randomized generic fallback. There is no business sign, guessed crane, private
interior or water opening. The slightly non-parallel original edges are retained;
triangulated roof planes differ by less than1cm from the ideal bilinear section.

The approximately2km source road/ground architecture remains flat here. The
workshop receives the caller's existing ground offset once. Its visible base is
closed; the original polygon collision continues to block the building at all
query heights, as it did before. This pass creates no new collision rule or
walkable roof. The shoreline is not cut or raised to emulate a guessed boat slip.

## Guard, cost and validation

The assembly requires one unique original ID, exact ordered ring, unchanged kind
and absent height/level metadata before suppressing that one generic shell. Invalid
source retains the generic fallback. Roof and walls form one closed exterior;
shallow closed door/window panels avoid implied playable openings. Roof seams and
wall piers are merged into one trim batch, not separate scene draws.

**2,164 triangles,4 material batches**, no runtime image request/new texture.
Most added geometry is the low roof seam strips visible from the elevated bridge.
Bounds stay within0.2m of the original plan; tests verify all vertices clear the
actual adjacent service-road carriageway w1265138308 by more than1m.

`npx tsx --test tests/ironworkers-yard.test.ts`:3passed. Full `npx tsc --noEmit`
passed. Tests check the actual source digest/ring, fail-closed edits/missing/duplicate
source, exactly one replacement, original-data preservation, one-time ground offset
and culling registration, closed manifold wall/roof edges, front-sided rays across
the complete roof, and the actual nearby road envelope. No full build/browser/native
acceptance or publication was performed in this subtask; the parent owns those.

Reproducible registration overlay and original responses are cached at
`artifacts/local/ironworkers-reference/dnv-yard-registration.png`,
`overlay-yard.mts`, `dnv-bridgehead-2024-export.json` and `dnv-east-workshops-2024.jpg`.
The neighbouring OSM ring w23776232 maps to a small eastern shed; it remains generic.
