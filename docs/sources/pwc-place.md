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

The Howe ground frontage now replaces the old 0.8 m pane / 0.11 m backing gap with an exterior recess: substantial pale columns at the outer fascia, a supported stone floor, downward-facing soffit, side returns, and closed rear glazing. The owner's photograph supports that depth hierarchy and the sparse round columns; it does **not** provide measured setbacks, a verified door-leaf pattern, or a surveyed slab schedule.

`pwc-lobby-site.ts` describes the two Howe-facing retained edges, their open exterior polygons, every rear/side closing segment, and five circular column footprints. The main glazing sits 2.4 m inside the mapped outline; the entry interval u=6–12 m on edge 0 steps back to 3.4 m. The floor is 0.18 m and the soffit 7.75 m above the caller datum. These are explicit photo-fit estimates. Corner pockets are 1.08 m deep and return behind the column shafts; the five columns have a 0.48 m radius and remain at the existing 0.53 m depth. The geometry has no pane or side return through a shaft. The adjacent retained facade's end bay is shortened to clear the shared corner column.

Each rear glazed section has another 1.2 m of modeled closed depth, including floor, soffit, side closures and dark backing. Restrained vertical lining piers provide parallax through the glass; these are a simplified closed visual backing, not surveyed room contents or gameplay interiors. No old primary-front pane remains in front of the recess. The sparse commercial framing retains an entrance-scale transom around 3.15 m and a higher division at 6.8 m, while leaving precise door leaves and hardware unresolved. The existing residential door/window kit remains rejected; see [the entrance asset study](pwc-entrance-kit-study.md).

The explicit `PWC_PLACE_ENTRANCE` contract uses retained edge **[464.548599, −396.13] → [479.048599, −411.13]**, outward approximately **[−0.7196, −0.6950]**. Positive `facadeFrame` depth goes inside. Edge 1 continues to **[484.548599, −422.13]**. Both recess mouths coincide exactly with their mapped edge, retain solid corner piers, and stop at rear glass/stone. The contract is intended for the matching collision subtraction and column obstacles; geometry-only ray tests do not establish integrated walkability. The current Canada Place collision site and named road layer put the tested Howe frontage at Y=0. Geometry continues to honor `batch.offsetY`.

The documented historical plaza passage is not reconstructed as a through-building route. The external outline, tower, roof parts and upper facade schedule remain unchanged. Other ground faces retain simpler closed bays, with glass moved to 1.12 m and backing to 1.9 m to clear their round columns. The seven material groups still distinguish stone, vision glass, spandrels, lobby glass, framing, dark backing and roof membrane. The source photograph remains research-only; mineral maps use the existing CC0 set and cloned metre-scale samplers. Glass optics are integrated separately from the section geometry.

Root integration calls `pwcPlace(building,batch,library,reflections)` from `src/world/pwc-place-building.ts` before generic architecture. The wrapper dispatches only this ID and assigns separate static tower and street-lobby reflection probes. It does not modify the parkade or neighbour factories.

## Verification and limits

Nine focused tests in `tests/pwc-place.test.ts` and TypeScript checking pass for the 2026-11-15 candidate. They verify retained footprint/dispatch, source roof differences and separate caps, the two upper facade regimes, actual rear-glass-first/backing-second rays, both lobby depths, supported floor and downward soffit rays, every rear/side closure, column-circle agreement and complete-model clearance from adjacent panels, finite normals/bounds, and caller offsets. The remaining ground faces and all upper geometry stay within the original outline. The collision integration, ordinary round-trip walk and browser performance review are separate acceptance work; these checks do not substitute for them.

The current assembly contains **19,185 triangles in seven material batches**, 364 triangles above the prior 18,821-triangle version. The two new Howe sections alone contain **1,016 triangles across four existing materials**. No new texture or material group is needed. These are measured geometry counts, not measured frame-rate gains. Exact door positions, setbacks, plaza circulation, glass optics and surrounding generic buildings remain fidelity limits; this work does not establish AAA parity. The integrated review below describes the preceding shallow-lobby baseline, not acceptance of this deeper candidate.

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

## Howe forecourt and graded lobby, 2026-11-15

An ordinary walk toward PwC stopped at the generated support-edge guard near
`(465.85, 1.06, -411.87)`. The old Howe support ended short of the retained
frontage, while the original lobby floor remained flat at 0.18 m. The owner's
photograph supports an accessible paved approach; it does not establish a
surveyed slope or justify flattening the existing street.

`pwc-apron-site.ts` now defines a bounded exterior forecourt between retained
PwC facade edges 0/1 and their projections onto the existing mapped Howe way
`w232195213`. Its footprint is clipped against all original building outlines.
It adds no road, changes no tower geometry and excludes building interiors.
The bounds are x450.40–484.55 / z−433.26–−396.13. The Canada Place site unions
this forecourt with its original support, so the obsolete internal retaining
edge and guard disappear through the existing shared boundary generator.

Original support heights remain authoritative wherever the original mask
exists. New paving interpolates actual original support-boundary heights
toward a frontage profile sampled from the existing Howe road. The corner
uses continuous weighted interpolation rather than an abrupt nearest-edge
switch. This crossfall is an explicit gameplay integration estimate, not a
surveyed real-world forecourt reconstruction. Dense actual-map checks found
an 8.58% maximum sampled x/z grade component; every sampled old Howe road
height remained exactly unchanged.

`createPwcLobbySite(groundHeight, datum)` samples the exterior base grade 45 mm
outside the wall and caches floor panels, opening polygons, rear/side closures,
columns and `floorAt`. The floor is base grade +0.18 m: the approach's 0.15 m
walking finish plus a 30 mm threshold lip. It is constant across the shallow
depth of each strip and follows the frontage longitudinally. The current
section endpoints range from approximately 0.46 to 2.87 m; occupied opening
samples range from 0.50 to 2.82 m. The ceiling stays at 7.75 m and the tower
roof stays at 83 m above the original building datum.

The floor mesh and collision use identical cached triangles. Glazing,
opaque cavity backing, side returns, lower frames and lining ribs meet that
floor. Column bottoms extend slightly below the lower adjacent floor sample
to avoid gaps on the slope. The existing section plan, 2.4/3.4 m glazing
depths, 1.2 m backing cavity and substantial round columns remain. Glass and
rear closures remain solid to gameplay; this adds exterior circulation only.
`buildPwcPlace` accepts the exterior base-grade callback as its fourth argument;
the root wrapper and collision integration use the same callback and datum.

Focused validation: 15 tests passed in `tests/pwc-apron.test.ts` and
`tests/pwc-place.test.ts`. They reproduce the old guard blockage and verify
its removal, preserve all sampled old Howe grades, check bounded support and
Float32 render boundaries, compare actual apron/lobby triangles with shared
height samplers, test sloped column/glazing contact, traverse both open recess
approaches while retaining rear-glass collision, and verify a non-flat callback
with a nonzero caller datum. Existing tower roof, material batching, facade
depth and column/panel clearance checks passed. These checks do not establish
ordinary browser appearance or sustained frame pacing; the integrated native
walk/drive acceptance remains a separate scene-level check.

The street screen uses a level estimated 5.0 m transom across the graded frontage; only its bottom threshold follows the paving. Draping the intermediate architectural rail with the floor produced a visibly sloping screen and was corrected before release. This transom height remains a photo-fit estimate.
