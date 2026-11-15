# Terminal City Club exterior

This original game reconstruction replaces the registered tower parcel `w143683933` and adjoining low club parcel `w143683969`. It is not a survey or an imported photographic model. The separate `w360437747` complex remains untouched. Research images are not runtime assets and no reproduction licence is inferred.

## Source and registration

- [MCM Architects project](https://www.mcmparchitects.com/projects/terminal-city-club/) explicitly identifies a **30-storey mixed-use tower with the club on four levels**, Tyndall limestone and blue-green glass/metal. Its `exterior_bldg_hastings-WEB.jpg` and `exterior_bldg_howe-WEB.jpg` establish the different glazed/stone elevations, narrow curtainwall grid, deep club windows, stepped shoulders and elevated curved roof blade. Cached in `artifacts/local/terminal-city-reference/mcm-{hastings,howe}.jpg`. Filenames alone do not establish camera orientation.
- City of Vancouver, [Building Footprints 2009](https://opendata.vancouver.ca/explore/dataset/building-footprints-2009/), building150732, under the Open Government Licence – Vancouver: historical generalized LiDAR roof fragments, not a current survey. Cached `city-parts-150732.json` and projected `world-registration.json`; the original retrieval URL/hash are in the local reference manifest. High-parts union770.6m², of which762.9m² lies inside the mapped target. High extent in the building basis U2.52–37.71,V−.83–26.65; low21.94m club fragment extends U34.04–58.94. Individual high fragments77.05/91.57/94.94m establish asymmetric roof ordering. Sample heights are not a measured floor schedule. The club JSON converts these polygons into game metres and clips them to the existing OpenStreetMap footprint; source IDs are retained and OSM attribution/ODbL notices remain applicable.
- [CTBUH](https://www.skyscrapercenter.com/vancouver/terminal-city-club-tower/24879/) gives99m architectural height/30 floors; City grouped `maxht_m`99.69 corroborates approximate overall height. Use99m crown; don't treat94.94m sampled roof height as the blade top.
- Complementary elevated views `bcva372.jpg`/`bcvch061.jpg` establish a predominantly punched limestone east/SE face; north-up Esri roof-context image establishes the curved blade along Hornby Plaza (longU axis). These are research-only/date-unverified images; provenance recorded in `downloads.json` by the registration agent.

Basis: origin(325.548599,−391.63), U(.711540,−.702646) toward Cordova; V(.702646,.711540) east/SE. Hastings is U≈0, Hornby Plaza V≈0, Cordova/club U≈56.2. The tower occupies the Hastings end, not a centred shrink. Stone tower elevations face the club and east/SE; Hornby bow and Hastings faces are glazed. The mapped ground perimeter is unchanged and visually closed. Hastings has a glazed/column-led lower elevation; club frontages have four levels of recessed limestone openings.

## Authored estimates and construction

The tower footprints simplify the historical roof unions; a1.1m bow sagitta interpolates the photographed Hornby facade. The four club divisions use21.94/4m;26 upper divisions interpolate toward the94.94m occupied crown closure; the91.57m roof shoulder cuts that schedule locally. These are modeling intervals, not verified individual floor elevations. The99m blade is0.32m thick and5.2m deep, with eight connected supports down to94.94m. Blade curvature/cantilever, column count and setbacks are photo-fit estimates. No unsupported claim of exact roof structure or surveyed facade dimensions.

Club windows have0.44m physical returns and opaque backing45mm behind the glass; tower stone windows have0.22m returns. Curtainwall glass is65mm behind slim90mm mullions, with a further45mm to closed backing and narrow paired horizontal metal bands. Limestone UVs and roof cap UVs are in metres. All lower fronts retain a continuous480mm solid sill at the existing collision boundary; no walkable-looking interior, stairs or invented door mechanism is added.

23,266 triangles in six shared opaque material batches, no runtime images, extra probes or transparent room boxes. Parent wrapper owns reflection registration. Tests cover exact ID exclusion, ground datum restoration, roof ordering at real asymmetric stations, mapped ground first hits, unobstructed recessed glass before backing, finite unit normals/winding and metric cap UVs. Native route and material acceptance remain parent-owned; calibrated colours are not evidence of source-accurate dimensions.

## Adjoining low club extension (`w143683969`)

The same City group150732 has six clipped historical roof zones covering97.6817% of this mapped neighbour. In particular part165373 at21.94m crosses the tower/club property division, so retaining the former generic12.8m neighbour would invent a9.14m roof break. `terminal-city-club-data.json` records the exact clipped rings and part IDs from the registration artifact. Heights remain5.5,11.53,15.52,20.3,21.94 and21.95m; no single22m blanket mass is substituted. The adjoining815/`w360437747` complex remains separate.

The lowest5.5m floor is closed across the mapped boundary, filling only the small2.32% gaps left by generalized roof data. Individual upper footprints rise independently above it, with physical terrace edges and limestone returns. Rectangular windows have380mm reveals, opaque backing50mm farther inside, and pale narrow mullions. Exact window schedule, stone course widths and this small-gap closure are estimates, not surveyed details. No accessible roof garden/pool/interior is invented.

The extension contributes7,387 triangles to the same six shared materials. Focused actual-mesh rays verify each distinct roof height at independent interior points, all mapped ground edges, and unobstructed window glass ahead of backing. Both builders restore the caller's terrain offset and preserve their exact source-ID gates.

The independently overlaid roof aerial identifies part166939 as the glazed pool roof. Its opaque mineral cap is replaced by a flat glazed closed exterior at21.95m, with backing50mm below and slender crossed roof ribs extending at most50mm above. The flat section and rib spacing are explicit estimates; no unverified barrel or visible pool interior is authored. The first-hit test verifies glass before backing, with no coplanar mineral cap.

## Integrated native acceptance

`createTerminalCityAssembly` allocates one shared material set and one static
128px exterior reflection probe at (309,45,-399), outside the mapped footprints.
It replaces both generic shells regardless of their ordering in the map, restores
the caller's ground offset and leaves source collision records unchanged. The
combined authored geometry is 30,653 triangles in six shared materials; spatial
batching can split these into more than six render objects. This capture is an
approximation, not ray tracing or a per-frame reflection render.

All 421 local tests, including ten new geometry/material/integration checks, and
the production build pass. Native daylight comparisons at the ordinary Cordova
street view show the complete stepped tower/crown and lower club assembly;
independent review accepts the form/material gain. Close and wider profiles and
images are saved in `artifacts/local/terminal-city-{before,after}-*`. Native
summon, reverse, steering, acceleration to a displayed 70km/h, braking to zero
and exit were exercised. The first straight attempt encountered traffic and is
not reported as an unobstructed run. The existing road, supported height and
building collision perimeter remain in effect. All 24 scene reflection captures
completed with no reflection error; fresh runtime warnings/errors were empty.

A quiet 20-second Balanced sample at 723×670, pixel ratio1.35, averaged27.20fps;
median33.4ms, p95 50ms, p99 51.6ms and maximum68.5ms, with no frames above100ms.
There is no comparable quiet baseline for this pass, so neither an FPS gain nor
a regression is attributed to the assembly. Simplified crown detail, uniform
mineral response, repetitive window schedules, broad sun glare, adjacent
fallback exteriors, street life and sustained performance remain substantial
limits. This checkpoint is not photographic or AAA parity.
