# PwC Place exterior

This assembly replaces only **w138256216, PwC Place, 250 Howe Street**. The live generic building was a **10 m podium-only block**: `vancouver-building-tags.json` supplies `height:10`, `loadCityData` merges it into the building, and `buildingHeight` gives that explicit height precedence over the stale base-map `levels:27`. The missing tower parts, rather than a rendered 27-storey extrusion, caused the major silhouette error. The new assembly preserves the existing ten-vertex ground outline, reconstructs the irregular tower and raised roof parts, and distinguishes the fine vertical Howe curtain wall from the horizontally banded adjoining wing. Granville Square, the shared parkade w116527978 and neighbouring w208599553 retain separate ownership and dispatch.

## Evidence and rights

- [Cadillac Fairview leasing sheet, Suite 1600](https://assets.cadillacfairview.com/m/18316a7226b5ad3a/original/250-Howe_Suite-1600_2024.pdf) identifies the building and supplies a full exterior photograph, office floor plan and street labels. The original exterior image was extracted from PDF object 267, rather than enlarged from the small page preview: `artifacts/local/pwc-place-reference/cf-owner-001.jpg`, 633 × 969 pixels. It shows green reflective glazing, slender silver vertical frames, a contrasting horizontal wing, substantial pale lobby columns and a deep glazed base. The image capture date is unknown; the document URL's 2024 is not proof of that date. No open photograph licence was established. It is research-only and is not a runtime texture.
- [City Urban Design Panel minutes, 10 January 2001](https://vancouver.ca/files/cov/urban-design-panel-minutes-jan-10-01.pdf), pages 2–3, identify the 20-storey proposal, MCM and Cadillac Fairview. They describe the transition between street grids, green curtain wall, proposed 40-inch spacing, and street-level passages. This is design-stage evidence. The current owner photograph supports the broad facade distinction; it does not prove every proposed dimension was built. The public search-service extraction was read after direct HTTP returned 403; no local copy of this PDF is claimed.
- [Council on Vertical Urbanism / Skyscraper Center](https://www.skyscrapercenter.com/building/pricewaterhousecoopers-place/25109) records 83 m architectural height, 20 above-ground floors, two below-ground floors and completion in 2002. This supplies the overall height anchor. The stale base-map 27-floor value is not used as an authored facade schedule; it was also superseded by the 10 m explicit height in the old generic renderer.
- Live OSM evidence, checked 2026-11-15, is retained in `artifacts/local/canada-approach-buildings-reference/osm-map.xml` and `registered-osm-parts.json`. Parts **361497586, 361497587, 361497588 and 361617590** supply the tower plan. © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- [City building footprints 2009](https://opendata.vancouver.ca/explore/dataset/building-footprints-2009/), group 150928, supplies roof parts **161154, 161155 and 162140**. Raw records are in `city-parts-150928.json`. Contains information licensed under the Open Government Licence – Vancouver. The much larger group also covers neighbouring buildings; its maximum is not a PwC height.

`artifacts/local/pwc-place-reference/sources.json` records the photograph provenance and hash. The only runtime texture input is the existing CC0 mineral set documented by `public/textures/canada-place-plinth/SOURCES.json`. No paid asset, source-photo texture or new image download is included in the game.

## Height reconciliation and registration

The OSM parts' 86/95/100 m tags conflict with the City roof measurements and the independent 83 m architectural record. The City samples also have different local bases, so their individual AGL values cannot simply become three connected runtime Y coordinates.

| City roof | Absolute top | Local base / AGL | Authored top above caller datum |
| --- | ---: | ---: | ---: |
| 161154, principal roof | 93.74 m | 12.50 / 81.24 m | 74.42 m |
| 161155, raised spine | 97.64 m | 15.14 / 82.50 m | 78.32 m |
| 162140, circular crown | 102.32 m | 14.25 / 88.07 m | 83.00 m |

The model anchors the highest part to CVU's 83 m and preserves the City's **3.90 m and 4.68 m relative roof differences**. The resulting subtraction of 19.32 m is an explicit normalization, **not a surveyed ground elevation**. The approximately 5 m difference between the crown's City AGL and the registry height remains unresolved. Neither source's definition is silently rewritten to make them agree. This is a bounded reconstruction choice, with material vertical uncertainty, rather than an exact as-built survey.

The runtime tower is the union of the four detailed OSM parts, clipped to the retained game outline. The raised spine and circular crown use the registered City polygons, also clipped to that envelope. `pwc-registration.jpg` compares the raw OSM and City plans; `pwc-place-parts.json` contains the authored clipped polygons. Lower roof caps subtract the higher parts, avoiding duplicate hidden horizontal slabs. City labels some upper surfaces pitched; the authored flat closures preserve their upper envelopes but simplify the roof sections.

The floor schedule uses two nominal lobby/mezzanine divisions to 8.2 m and eighteen office divisions to the principal roof. That is a 20-level interpretation, not a verified slab schedule. The approximately 1.016 m vertical mullion pitch is source-informed and fitted to each facade span. The horizontal wing has thinner vertical subdivision and deeper paired floor bands. The two regimes follow the OSM plan partition rather than arbitrary alternating materials.

## Ground frontage, materials and integration

The lobby has 0.8 m recessed glazing, backing another 0.11 m behind it, four-sided returns, a low plinth, substantial round pale columns and a metal fascia. The current Canada Place collision site and named road layer put the tested Howe frontage at Y=0. The geometry and reflection probe honor `batch.offsetY` rather than imposing a new datum.

The explicit frontage contract in `PWC_PLACE_ENTRANCE` uses retained edge **[464.548599, −396.13] → [479.048599, −411.13]**, outward approximately **[−0.7196, −0.6950]**. Positive `facadeFrame` depth goes inside. Its reserved interval u=6–12 m, threshold 0.18 m, head 6.8 m and glazing depth 0.8 m are photo-fit estimates. The exact door position/leaf layout is unresolved, so this pass supplies conservative recessed commercial glazing rather than claiming a surveyed doorway. The existing residential door/window kit was rejected; see [the entrance asset study](pwc-entrance-kit-study.md).

The historical corner/plaza passage is documented but not opened through the retained collision footprint. No new ground slab, street post, walkway or interior route is introduced. The seven material groups distinguish pale stone, green vision glazing, muted spandrels, lobby glass, silver framing, closed backing and roof membrane. The mineral texture samplers are cloned and kept at metre scale; glazing remains an opaque reflective approximation.

Root integration calls `pwcPlace(building,batch,library,reflections)` from `src/world/pwc-place-building.ts` before generic architecture. The wrapper dispatches only this ID and adds one static exterior probe. It does not modify the parkade or neighbour factories.

## Verification and limits

Six focused tests in `tests/pwc-place.test.ts` and TypeScript checking pass on 2026-11-15. They verify retained footprint/dispatch, source roof differences and separate caps, actual glass-first/backing-second rays, the two facade regimes, lobby recess and ground support, absence of low geometry beyond the footprint, finite normals/bounds, material sampler ownership and consistent nonzero model/probe offsets.

The assembly contains **18,821 triangles in seven material batches**, plus one static reflection probe. These are geometry costs, not measured frame-rate gains. The integrated native review is recorded below; the project log records full-suite, build and publication checks. Exact roof sections, door survey, plaza circulation, glass optical behavior and surrounding generic buildings remain fidelity limits; this work does not establish AAA parity.

## Integrated daylight review

The native north/back comparison at approximately (495.05,6.74,−476.10), yaw
−0.08014, pitch −0.39995, restores the absent tower and its two facade rhythms.
The before camera was within 0.10 m with the same orientation. It is not the
same elevation as the owner's Howe photograph. A second ordinary walking view
at (454.69,1.21,−421.50) shows that Howe frontage, its round columns and the
recessed glazing. Independent visual review accepts the bounded massing gain
and found no clear new placement/geometry regression, but the lobby still
looks too flat and the glass too uniform. Actual deeper-looking setbacks and
credible reflection variation are the next fidelity priorities.

The requested render profile records seven PwC beauty calls and seven shadow
calls, each pass totaling 18,821 triangles. The 20-second stationary daylight
sample averaged 26.31 fps (527 frames / 20.0338 s), median 33.4 ms, p95 50.1 ms,
p99 51.9 ms, maximum 67.6 ms, 32 frames over 50 ms and none over 100 ms. This is
723×670 at pixel ratio1.35 / Balanced on the local laptop, not a sustained or
1080p result and not a controlled FPS improvement. Local screenshot/profile
evidence is under `artifacts/local/pwc-*`. Publication is recorded separately.
