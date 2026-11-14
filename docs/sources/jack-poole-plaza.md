# Jack Poole Plaza — 2026-11-14

Original game geometry reconstructs the upper event plaza, Olympic cauldron and reflecting basin, Cactus Club's planted roof and exterior access, Digital Orca, mapped stairs and waterfront approaches. The site now has connected levels rather than a flat generic block. It remains a reference-guided interpretation, not a surveyed digital twin.

## References inspected

- [Vancouver Convention Centre — outdoor plazas](https://www.vancouverconventioncentre.com/facility/spaces/outdoor-plazas): owner photographs of the plaza, café roof, cauldron, Digital Orca, lighting masts and event paving. Eight views were inspected.
- [Vancouver Convention Centre — Olympic legacy](https://www.vancouverconventioncentre.com/about-us/our-story/olympic-legacy): permanent Olympic cauldron and its approximately ten-metre height.
- [Glotman Simpson — Olympic cauldron](https://glotmansimpson.com/project/olympic-cauldron-at-vancouver-convention-centre/): structural engineer describes a 10 m tall, 12 m wide cauldron with four 16.5 m × 1.2 m arms, steel, polycarbonate and furnace glass. Those dimensions guide the original crossed-arm mesh. The game's frosted reflective material approximates the cladding; it does not simulate the actual layered construction.
- [PWL Partnership — Vancouver Convention Centre](https://www.pwlpartnership.com/projects/vancouver-convention-centre): landscape architect's site photographs, plan and sections; describes a 12 m grade variance and a grand stair with accessible ramp. Eight landscape images and the [full section sheet](https://www.pwlpartnership.com/sites/default/files/2018-10/0314%20Sections%20A%26B.jpg) were inspected. These design-era drawings establish relative levels, not precise as-built survey elevations.

Photographs and drawings were used only as references. They are not distributed in the game or repository. No Rockstar art, mesh or texture is used.

## Map and interpreted elevation

The [OSM API extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.1215,49.2888,-123.1162,49.2907), fetched 2026-11-14, supplies the café and living-roof outlines, pool, cauldron and Orca locations, detailed coastline and paths. Selected data is retained in `src/world/jack-poole-map.json`, © OpenStreetMap contributors, ODbL 1.0. Run `node scripts/fetch-jack-poole.mjs` to reproduce it from the cached XML or fetch the small public map extract if absent; `--refresh` explicitly downloads a current extract. Refreshing a map can change the data and requires a new geometry/play check.

Mapped stair counts are 36 (`w159354908`), 30 (`w159354910`), 30 (`w358443046`), 34 (`w223634905`) and 39 (`w223634907`). Ramp paths use `w89118741` and `w119945024`. Widths, tread allocation between segments, roof access aprons and junction landings are authored for this reconstruction. The northern café stair ends in a short level landing so the ramp does not cross raised treads.

| Game surface | Interpreted height |
| --- | ---: |
| Lower Harbour Green approach | about 0.12 m |
| Intermediate west approach | 7.54 m |
| North Convention Centre / plaza promenade | 6.04 m |
| Main event plaza | 12.04 m |
| Café roof | 17.82 m |

These are relative game levels inferred from photographs, the landscape section and step counts. They are **not measured absolute elevations**. A triangulated control surface blends the local construction into the existing city; mapped surfaces override it for exact walking/tread agreement. The Convention Centre model and its deck move up six metres to connect to the north promenade. A short southern approach blends the Convention Centre cycleway back to the existing city ground, with tapering side shoulders. This transition is authored rather than surveyed. Nearby downtown streets still lack a modern city-wide elevation survey.

Terrain fragments are cut against constructed surfaces with convex triangle partitions, avoiding numerical failure where many collinear stair/ramp edges meet. Shared terrain normals smooth shading across triangle edges. Rails use the same surface heights as collision; openings include walking clearance at junctions. The café interior and Convention Centre hall remain scenery; the café roof and exterior approaches are explorable.

## Original interpretation and materials

The cauldron has four crossed, panelled arms, a central stem, seams and steel trim. It is normally unlit, as the real monument is between special events. The basin has a reflective surface and solid coping. A static local scene probe updates the pool and cauldron reflections when approached or the weather changes; this is an approximation rather than ray tracing.

The neighbouring voxel sculpture is an original game approximation of **Digital Orca (2009), Douglas Coupland**. Its placement is mapped; its voxel silhouette, proportions and simplified thickness are interpreted. The artist's sculpture design is credited here and is not claimed as an original Rain City artwork. No third-party sculpture mesh or photograph is redistributed.

Existing Poly Haven CC0 concrete, grass/rock and painted-wood materials are reused. Thin curved grass blades, café glazing/mullions, timber seats, paving joints, railings and light masts are authored geometry. Delaunator 5.1.0 is used at runtime under its ISC license; the exact notice is in `public/licenses/delaunator-ISC.txt`. Its robust-predicates dependency retains the existing Unlicense notice.

## Limits and verification

Tests cover mapped stair counts, grade bounds, finite geometry, cauldron scale, tread raycasts matching walking heights, solid pool and café boundaries, continuous stair/ramp access, terrain area conservation and Convention Centre connections. Browser play and final visual evidence are recorded separately in `docs/PLAYTEST.md`.

The café lacks a furnished interior. Plant species, paving layout, glass construction, exact light-mast hardware, artwork detail, event furniture, marine habitat and absolute elevation are approximate. The larger city's architecture and interiors remain simplified. This checkpoint improves a playable browser prototype; AAA fidelity is still unfinished.
