# Harbour Green Park exterior reconstruction

2026-11-14. Original game geometry for the waterfront park at the foot of Bute Street, guided by mapped paths and reference photographs. The outdoor park, walking, cycling and driving surfaces are the focus; no building interiors were added.

## Sources

- [OpenStreetMap extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.126,49.2879,-123.1177,49.2915): park way **37057434**, spray pool **223936055**, Bute stair **48271068** (27 steps), six mapped three-step shore flights, upper path **85240514**, seawall cycleway **85240509**, connecting paths, two garden rectangles, coastline and furniture points. Source outlines and tags are in `src/world/harbour-green-map.json` (38 ways). © OpenStreetMap contributors, ODbL 1.0.
- [City of Vancouver park listing](https://app.vancouver.ca/ParkFinder/parks/21?redirect): Harbour Green Park. The old ParkFinder address redirects here. The City description identifies the rolling lawns, Bute Street entrance and water feature.
- [Vincent Helton — Harbour Green Park](https://www.vincenthelton.com/harbour-green-park): owner **City of Vancouver**, landscape architect **PWL Partnership**, 2003; seasonal spray-pool/reflecting-water operation. Three designer photographs were viewed for the granite wet paving, vertical and arcing jets, paired stone piers and pyramid caps.
- [Darwin Construction — Harbour Green Park](https://www.darwinconstruction.ca/projects/development/harbour-green-park-1): five contractor photographs were viewed for lawn mounds, curving paths, steps, paving bands, dark metal/wood benches, waterfront lamps, the low seawall and green-and-white park sign. These are historical photographs, used for stable park features rather than current business names.
- [PWL Partnership — Vancouver Convention Centre](https://www.pwlpartnership.com/projects/vancouver-convention-centre): the adjacent landscape and connection to Harbour Green, including a stated twelve-metre grade difference. This does not supply surveyed absolute elevations for the game.
- [Poly Haven Grass Ground](https://polyhaven.com/a/grass_ground) and [Granite Tile](https://polyhaven.com/a/granite_tile), **Charlotte Baglioni**, CC0: generic photographic diffuse, OpenGL normal and roughness maps. Converted to 2K WebP at their stated 2.51 m and 2.3 m scales; the lawn colour is shifted greener. These are not scans of Harbour Green. Exact downloads and changes: `public/textures/harbour-green/SOURCES.json`.

No reference photographs are distributed. The City marina guideline PDF could not be retrieved during this pass; it is not treated as an inspected drawing source.

## Construction and reproduction

`node scripts/fetch-harbour-green.mjs` rebuilds the map extract from cached XML; `--refresh` requests the public OSM API. `node scripts/fetch-harbour-materials.mjs` downloads/converts the six CC0 maps and generates the original park sign. The sign is also reproducible with `node scripts/generate-harbour-sign.mjs`. Original geometry, sign artwork and code are MIT. Reused stone, paving, concrete, wood and shrub maps retain the existing Poly Haven CC0 credits.

A triangulated, shared height surface grounds the terraced lawns, paths, buildings, trees, walking and vehicles. The 27-riser Bute stair is interpreted as flights of 9 and 18 with an open middle landing; the mapped branch paths join there. A level fountain apron surrounds the shallow wet granite pad. Stone piers, nozzles and animated parabolic droplets recreate the water-feature character. Short grass uses spatial instances; garden shrubs reuse the coastal plant asset. Mapped benches have timber slats and curved metal arms; lanterns, shore coping and an original park sign complete the close detail. Piers, benches, lamps and stair sides participate in collision. Fountain water is shallow and walkable.

The older Jack Poole terrain apron is trimmed back so Harbour Green owns the entire fountain and park. The eastern join samples the existing plaza surface; the western connection tapers to the city's ground. Building skirts close gaps created by the new interpreted grades. The maintained lawns and path widths, fountain level (1.55 m), middle landing (3.08 m), upper Bute landing (6.14 m), piers, furniture and planting are game-scale interpretations, not a survey. The cycleway is widened from its mapped 2 m to 2.8 m for the game.

Startup shoreline clipping now triangulates water/cutout polygons once and queries nearby triangles instead of repeatedly processing the entire coastline for each terrain cell. Tests compare the new subtraction against independent polygon booleans for concave, overlapping, reversed and narrow shapes; existing terrain-area/slope tests remain in place.

## Limits and validation

This remains an independent playable prototype below AAA production fidelity. Fountain hardware/jet counts, stone dimensions, park-sign position, grass, plant species and local elevations are approximate. The memorial artwork, detailed pergolas and restaurant frontage are not reconstructed in this pass. Surrounding generic buildings need further architectural work. There is no photogrammetry or Rockstar asset reuse.

Automated checks raycast all tread centres, sample the park surface for gaps, check fountain walkability and solid piers, keep the connected stair approaches open, and measure the eastern terrain join. Browser checks use native keys/mouse for walking, driving, cycling and all three weapons, plus actual day/night rendering and animated-water checks. Checkpoint results are recorded in `docs/PLAYTEST.md`.
