# Fairmont Waterfront hotel exterior

The generic nine-level brick shell at **w363651936** represented the whole Fairmont Waterfront hotel, not a wing of the neighbouring Waterfront Centre office. It omitted most of the real hotel's height, curved tower, stepped lower wing and inset roof crown. This replacement authors that exterior assembly using original geometry and existing CC0 materials. It is distinct from both Waterfront Centre / w143683980 and Fairmont Pacific Rim / w143683979.

## Identity, references and rights

- [MCM Architects, Fairmont Waterfront Hotel](https://www.mcmparchitects.com/projects/fairmont-waterfront-hotel/) identifies the site and describes a 22-storey, 493-room hotel with a two-level restaurant, ballroom and meeting rooms. Three official project photographs were inspected and saved as `mcm-fairmont-overview.jpg`, `mcm-fairmont-tower.jpg` and `mcm-fairmont-base.jpg` under `artifacts/local/canada-approach-buildings-reference/`. The overview independently distinguishes the hotel from the taller Waterfront Centre office. The two street views show pale framed room bays, broad blue glazing, the curved end and lower stepped wing. The 2017 URL path is not a verified capture date; the overview's harbour context is historical. No open photograph licence was established. These images are research-only, never runtime textures.
- [Fairmont / Accor operator listing](https://all.accor.com/hotel/A587/index.en.shtml) gives 900 Canada Place Way and 23 floors. The [hotel's harbour-room page](https://www.fairmont-waterfront.com/accommodations/signature-harbour-view/) lists rooms on floors 10–23. MCM's 22-storey count and the operator's floor numbering are not identical definitions.
- Live [OpenStreetMap extract](https://www.openstreetmap.org/api/0.6/map?bbox=-123.115,49.2861,-123.1113,49.28815), checked 2026-11-15, contains named hotel POI 911592824 inside w363651936, plus the detailed hotel part rings. OSM data is © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright). `osm-map.xml` and `registered-osm-parts.json` retain the research evidence.
- [City building footprints 2009](https://opendata.vancouver.ca/explore/dataset/building-footprints-2009/) group **151150** has nine generalized historical LiDAR roof polygons. The existing match has IoU 0.856 against the retained game footprint. Fresh records are in `city-parts-151150.json`. Contains information licensed under the Open Government Licence – Vancouver. These are generalized historical measurements, not a current construction survey.

The compact reference manifest records photograph URLs, bytes and hashes. No new paid assets, runtime photographs, models or textures were downloaded. The material factory reuses existing CC0 mineral maps from `public/textures/canada-place-plinth/SOURCES.json`; reference images are not distributed with the game.

## Registered mass and height limits

The original game footprint spans x386.55–469.55, z−503.63–−428.13. The source part rings were clipped to that retained envelope, limiting differences from live OSM to the established collision boundary. `fairmont-waterfront-part-plan.jpg` shows their north-up world registration. There is no uniform inward scaling or arbitrary tower rotation.

| Part | Source | Authored top above caller datum | Evidence limit |
| --- | --- | --- | --- |
| Broad podium | OSM 143683941 | 8 m | Generalized OSM height; City low roofs vary with pitched/glazed sections |
| Lower stepped wing | OSM 361497592 | 14 m | City corresponding roof 14.72 m |
| Middle stepped wing | OSM 361497591 | 20 m | City corresponding roof 20.06 m |
| Tall stepped wing | OSM 361497590 | 26 m | City corresponding roof 26.23 m |
| Curved main body | OSM 143683939 | 64 m | City main roof 63.28 m |
| Inset curved crown | OSM 361497589 outline | 69.44 m | City group maximum; OSM's 74 m is not adopted |

The City crown record has top elevation 85.59 m, local base 16.37 m and above-ground height 69.22 m. Group maximum is 69.44 m. The approximately 4.8 m difference from OSM's 74 m cannot be explained by these City ground samples, which range 15.65–16.72 m. The reconstruction uses the lower City-supported upper bound while retaining the OSM crown plan. Absolute City elevations are **not** runtime Y coordinates. The 64/69.44 m choice is a bounded synthesis with explicit uncertainty, not centimetre-level accuracy.

The facade schedule uses two nominal base levels, nineteen room rows from 8 to 64 m and two finer crown bands to 69.44 m. This reconciles the operator's 23 numbered floors with the photograph's room rhythm, but is a modeling interpretation rather than an authoritative slab schedule. The lower wing uses approximately 3 m room divisions and source top anchors at 14/20/26 m. The podium facade has tall continuous glazing across its nominal two-level zone.

## Geometry, datum and integration

The seven material groups separate pale panels, coated blue glazing, slender silver frames, opaque recess backing, roof membrane and modest planted terrace strips. Each room bay has four physical returns, approximately 0.32 m inset glass and an opaque backing another 0.08 m behind it. Lobby glazing is approximately 0.70 m recessed. The finer glass crown remains distinct from the pale main grid. Adjacent higher parts suppress hidden shared facade rows. Roof caps occur at separate source heights; concealed cap area may continue below upper masses, but no duplicate coplanar top slab is emitted.

The factory `fairmontWaterfront(building,batch,library,reflections)` in `src/world/fairmont-waterfront-building.ts` dispatches only w363651936 and adds one exterior reflection capture. It calls `buildFairmontWaterfront` and `createFairmontWaterfrontMaterials`; root integration owns `architecture.ts` dispatch and generic-shell exclusion. The model and reflection probe both honor the caller's `batch.offsetY`.

Using the current base map plus `vancouver-roads.json`, the active Canada Place collision site's hotel centroid is (430.36678,−472.92545) at ground Y=0. The authored model therefore presently starts at zero, consistent with the architecture caller; it does not reset the caller datum. The farther Howe shoulder rises independently, for example to approximately 3.656 m at (472,−447). No whole-building uplift, terrain change, interior opening or new collision route is introduced. Grade-relative facade/road contact still needs the parent's native review. Decorative roof planting is a bounded massing cue, not a current inventory. The small glazed conservatory and furniture are not claimed as a complete current survey reconstruction.

## Howe Street porte-cochère

The MCM street view `mcm-fairmont-base.jpg` shows a continuous projecting glazed fascia beneath the curved hotel facade, a visible fine metal frame and open space below its front edge. City roof part **162733** independently registers that projection along Howe Street. Its 15-point ring is stored in `fairmont-waterfront-parts.json`. The source outer edge is retained exactly; only the seven inner attachment vertices move roughly 1–2.5 m toward the hotel so they enter the older game wall by 0.25 m. The final projection spans x464.95–478.88, z−493.71–−451.54 and approximately 355 m². It does not alter the hotel's ground footprint.

The authored section has its highest frame at **8.12 m**, glazed roof closure at **8.06 m**, closed downward-facing soffit at **7.64 m**, and lowest transverse members/fascia at **7.48 m**, all above the caller's datum. The fascia is 0.64 m deep, with inset coated glazing, opaque backing and narrow silver vertical frames. Transverse members are real closed geometry visible below the soffit. This is a bounded interpretation of the photograph's box fascia. The historical City record gives 6.43 m AGL and a generalized pitched-roof classification; neither its vertical datum nor precise roof pitch is transferred directly to the game. The authored flat closure is an explicit simplification, not a surveyed roof section.

The section fits the current raised Howe approach: a 0.125 m interior grid found approximately **3.05 m minimum clearance** under the lowest member, at ground around 4.43 m. The persistent test also samples the complete perimeter and requires more than 2.95 m clearance using the active Canada Place collision site and current named road data. No front posts, ground slab, barriers or route changes are added. Roof and underside rays confirm physical closure from both directions. The canopy adds **1,802 triangles** within the same seven material batches; it does not add a texture, material or reflection probe.

## Validation and remaining quality gap

Nine focused tests in `tests/fairmont-waterfront.test.ts` and TypeScript checking passed on 2026-11-15. They cover correct hotel-only dispatch, the retained game outline, clipped source parts, separate roof heights, finite geometry and winding, metre-scaled panel UVs, actual glass-first/backing-second window rays, consistent nonzero geometry/probe offsets, and the canopy's attachment, top/underside closure, grade clearance and absence of low geometry beyond the hotel boundary. A test mock type error found by the parent's earlier TypeScript build was corrected to `Texture<HTMLImageElement>` before handoff.

The assembly contains **32,275 triangles in seven shared material groups**, plus one static exterior reflection probe. This is a geometry count, not a measured performance improvement. The parent owns combined tests/build, native whole-building/approach views, walking/driving and publication. No native acceptance or AAA parity is established by these source checks. Approximate reflective glazing, unsurveyed detailing, neighbouring generic buildings and sustained frame pacing remain material limits.

The matched first native close view, `artifacts/local/fairmont-waterfront-candidate.jpg`, visibly replaces the incorrect brick facade in `fairmont-waterfront-before.jpg` with the source-supported pale grid and blue glazing. Its window/panel ratio is broadly consistent with the MCM street photograph. The reflected field remains simplified. That candidate omitted the projecting glazed lobby canopy/porte-cochère; the subsequent bounded canopy correction described above is ready for the parent's native rebuild. This close comparison does not establish whole-building, movement or performance acceptance.
