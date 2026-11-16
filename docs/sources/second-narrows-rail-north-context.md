# Second Narrows railway north shore context

2026-11-16 UTC. This candidate joins the railway's north fixed approaches to a bounded, physically supported north-bank corridor. It is an explicitly authored adaptation to the game's flattened yard, **not a surveyed railway or terrain reconstruction**. Native acceptance is still required. The separate south approach and Thornton Tunnel portal remain unresolved; this pass does not claim both shores are complete.

## Evidence and fitted datum

The retained OSM continuation follows ways [510021324](https://www.openstreetmap.org/way/510021324), [588125862](https://www.openstreetmap.org/way/588125862), [588125863](https://www.openstreetmap.org/way/588125863) and [915622100](https://www.openstreetmap.org/way/915622100). Their exact geographic nodes/tags are retained in `second-narrows-rail-context-source.json`; no source road/building vertices are rewritten. The first rail point is the existing bridge endpoint `[6945.143913,-1738.783146]`. The bounded continuation follows650m of the mapped line to approximately `[6608.38948,-2219.85950]`.

The cached [DNV2024 orthophoto](https://geoweb.dnv.org/arcgis/rest/services/Basemap_Ortho2024/MapServer) shows a planted rail bank beside the service yard and shoreline. Its registered overlay is `artifacts/local/second-narrows-rail/north-end-registration.jpg`. The existing [C.Hanchey0534 photograph](https://historicbridges.org/britishcolumbia/secondnarrowsrailbridge/second_narrows_-0534.jpg) corroborates the fixed north approaches meeting vegetated shore. This photograph is research-only, CC BY-NC2.0; no photograph pixels are distributed as textures.

Offline samples from the already cached coarse Terrarium tiles give approximately10.48m ground at the north bridge end,11.60m at the first junction and5.64m about212m inland. They have roughly50m pixel spacing and do not establish track height or narrow road/bank cross-sections. The uninstalled broad North Shore terrain field does not include these endpoints and remains uninstalled.

The main/lift rail stays13m. Only the north fixed approaches descend to9.6m at the shore, a0.918265% grade. The continuation stays level through its first20m, then descends to0.7m rail/0m soil at650m, with30m eased ends and maximum1.4833% grade. The650m tie into the flattened yard is a coordinated scene adaptation; it must not be presented as the real track profile. North span members, sleepers, bearings and piers use one shared elevation function; submerged pier toes stay fixed. All18 south/main/tower geometry parts remain byte-identical, while the20 north span/pier parts retain their vertex counts.

The source service loop crosses roughly7.4m **south** of the bridge endpoint, not north. Its underpass stays open at the existing ground datum. The first20m retain steel rail-support girders. The earth now toes in continuously from ground0 at station0 to the full bank at20m, below those girders; only the finite central bearing cap is concrete. No tunnel interior or new public rooftop route is added.

## Geographic and contact scope

The bank follows the actual railway polyline. A3.8m half-width shoulder, near-linear planted side grades, graded service-road corridor and zero-height outer apron define the bounded mask. Its final bounds are approximately x6598.97..6983.26, z−2243.02..−1757.93. The mask is clipped to retained source land. Exact source ocean/water polygons are never cut or raised. Independent final triangle intersections found only0.00696m² of Float32 boundary overlap, at maximum0.0000496m elevation; none exceeds1mm. This is quantization at the existing coastline, not a shoreline extension.

Exactly three ground-level service roads receive a shared grade: **w24007615**, **w1265138308**, **w1265138309**. Their source plan coordinates, widths and junction records remain unchanged. Source junctions and the service-loop underpass retain0m ground. Actual road/sidewalk ribbons and markings are clipped into the final terrain triangles and retain their existing finish offsets (the service asphalt is0.07m). Finite walking support is collected from the emitted asphalt triangles; no global ground promotion is used.

The four elevated providers **w23795563**, **w1275279652**, **w35260598**, **w62125826** retain identical actual World geometry and finite deck heights. Three buildings intersect only the zero-height apron: **w23775982**, **w23776223**, **w23776232**. Their pads, architecture offsets and collision remain0m. No building is translated, and no unrelated road or world terrain is raised.

The road cross-sections are explicitly constrained in terrain triangulation. Independent1m station sampling found maximum centre/edge difference1.036cm at a bend, normally below0.1mm on straight sections; service-loop maximum1.23mm, branch0. Maximum longitudinal service grade is6.18%. Soil has no triangle above45°. The maximum42.17° occurs on a0.00113m² quantized edge triangle; approximately72.39m² exceeds35°, with substantial slopes around36–37°. **A strict1:1.5 soil slope everywhere is not claimed.** These remaining fitted earth grades are a native-review limitation, not engineering certification.

## Geometry, materials and bounded cost

`createSecondNarrowsRailContext` atomically requires the exact retained bridge towers and service-road record. It emits five merged opaque roles: ground, ballast, steel, timber and concrete. The approximately31.6k triangles use no per-sleeper draws. The existing CC0 grass/rock and mineral maps are reused; no new downloaded texture or asset is introduced. Ground/ballast receive shadows without casting a large extra shadow workload; steel, ties and abutment retain physical shadows.

Cross-section bases keep world-up stable so downhill beams cannot roll ballast through the rails. Ballast is a closed-ended trapezoid below the actual sleepers and rails. The bank-end wall follows final mesh boundary vertices and faces outward. Road boundaries, shoreline and bank edges are preserved during soil-only triangulation improvement. Exact clipping degeneracies are rejected before Float32 rounding, and the slope station field blends equally close source-segment projections away from the rail shoulder to avoid discontinuous heights at bends.

Existing ground is cut only inside this same bank mask. The final emitted triangles drive ground height, road finish support and finite body/camera contact. Elevated bridge providers retain priority. No detached collision plateau, broad terrain field, hidden route, water edit or automatic vehicle steering is installed. A single full-source pure factory run took approximately2.02s in local Node; browser startup/render performance remains unmeasured for this candidate.

## Verification and native gate

Focused tests execute actual retained east buildings/areas/ocean and full road data, real `CollisionWorld`, actual `World.terrain()` and `World.roads()` with only image/material loading stubbed. They verify upward faces and barycentric support, outside-mask terrain/water rays, exact four elevated-road buffers, open service underpass, gradual walking from the yard, all three graded road finish/contact rays, zero raised building overlap, upright rail/ballast sections and the visible graded earth toe. The bridge's existing corridor/stringer tests now query the shared graded datum rather than assuming every span remains13m.

Independent review is recorded in `artifacts/local/second-narrows-rail/GRADED-CANDIDATE-INDEPENDENT-REVIEW.md`:220 actual service-road ray/contact pairs,4,230 preserved elevated-height checks,41 joined bridge/context seam rays, plus actual triangle/coast/building intersections. Normal native inspection must check the north shore silhouette, road junctions, abutment, planted slope appearance and highway driving view before release. The south tunnel/approach is a separate, still-unfinished source-registration task.

Source data: ©OpenStreetMap contributors, ODbL1.0, [licence](https://www.openstreetmap.org/copyright). Existing runtime texture attribution remains unchanged.


## Native front-face rejection and correction — 2026-11-16 UTC

The first ordinary ground-level review (`rail-north-bank-ground-native.png` and `rail-north-bank-side-native.png`) rejected the broad white triangular face. This was our introduced geometry/material error: the entire vertical soil end closure had been placed in the plain concrete cohort. It was not evidence of a missing grass texture. Treating that invented wall with a darker colour would not fix its unsupported shape.

The correction removes the entire broad vertical closure and introduces a20m eased planted-earth toe under the existing girders, starting at the retained shore endpoint. The actual service-road underpass is7.4m south of that endpoint and remains untouched. Rail datum, girder geometry and all terrain beyond the front transition remain on the prior registration. The terrain's existing exact land clipping preserves the ocean polygon; one shared triangle mesh supplies both the visible slope and ground contact. Only the6m-wide bearing cap retains concrete material. The toe position/profile is an authored exterior adaptation, not a surveyed abutment design.

Nine focused tests pass after this correction. They include49 horizontal sight rays from the failing native side onto upward-facing earth; exact shared barycentric contact; all soil triangles below43degrees; finite cap extent; unchanged water/building pads; real World service-road finish/contact; exact elevated-road buffers; and the native review point[6957.8,−1732.9] with44 normal-camera tail samples. Ordinary native appearance still requires root review of the rebuilt candidate.
