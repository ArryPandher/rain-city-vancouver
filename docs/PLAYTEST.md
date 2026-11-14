# Rain City verification

2026-11-14. Tested on the local MacBook Air M2, Chrome with WebGL 2, 1440 × 900, Balanced graphics. This is a playable independent prototype, not a claim of AAA production quality.

## Automated

`npm test`: 35 checks passing, covering vehicle speed limits, frame-rate stability, braking/reverse, steering, bicycles, coordinate projection, polygon/segment queries, swept building collision, bridge height/water handling, curved ramp continuity and camera angle wrap. Asset regressions cover quantized landmark transforms, matching optimized tree attributes and both character skeletons/locomotion clips. Building-use rules, landmark/collision alignment and reflection capture state restoration are also covered. `npm run build` includes TypeScript checking and a production Vite build.

## Interactive evidence

- Main menu enters driving and on-foot exploration through actual UI buttons.
- E exits the vehicle; WASD moves the character through mapped streets.
- V brings a car; W + A produces a continuous left turn. Space brakes.
- 1 equips the pistol; mouse aim/fire consumes ammunition, triggers recoil/effects, and R restores the magazine while decrementing reserves.
- All ten fast-travel spawns were checked for dry ground and clearance from building collision.
- Browser loads the expanded city without an uncaught exception or console error.

Additional release checks and scene captures are appended after final verification.

## Practical limits

Roads and footprints use real map data; terrain elevation and building architecture are interpretations. Twelve Vancouver landmarks use licensed Codriver models; bridges and other scenery remain authored approximations. The eastern extension emphasizes map coverage. NPC behavior and traffic are basic. Cars can use paths and the seawall in this sandbox. There is no multiplayer, police simulation, campaign, interior exploration or mobile touch control. Desktop keyboard and mouse required.

### Extended interactive pass

- Ironworkers crossing: 1.34 km from the southern approach to the northern landing using W and Space. Vehicle health stayed at 100; bridge height rose and returned to ground; no water recovery triggered.
- Stanley Park bicycle accelerates, moves through the mapped park roads and stops with the brake.
- The six-target course registered six destroyed targets from twelve pistol hits, using the game’s camera raycast. All three weapons consumed their own magazine ammunition.
- Photo mode paused simulation, Escape released the cursor while preserving photo mode, and the Save Photo UI downloaded a valid 1440×900 PNG (2.2 MB).
- Observed scene performance at 1440×900 Balanced varied around 30–60 fps on the M2. This is a scene sample, not a guaranteed benchmark. Dense city views generally ran in the 30s; sparse bridge approaches reached the high 50s.
- GitHub Actions build and Pages deployment succeeded for `42f855c`; public root returned HTTP 200.

### Bugs corrected during playtesting

- Reoriented steering to match camera-relative left/right input.
- Matched the curved Cambie ramp and the Ironworkers crossing to mapped road positions.
- Corrected vehicle pitch along bridge slopes.
- Prevented newly summoned bikes/cars from overlapping the previous vehicle.
- Kept photo mode open when Escape releases the cursor.
- Preserved map pins while the minimap refreshes and added map dragging.
- Added a visible weapon model for first-person exploration.


## Character and daylight checkpoint — 2026-11-14

- A CC0 textured protagonist replaces the procedural player: 53-joint skin, fitted idle/walk/run clips, blended locomotion, two-handed weapon stance and a bicycle pose. Export provenance and licensing are committed.
- Walking, carbine fire (30 to 26 rounds), and a Stanley Park approach bicycle ride (26 km/h, health 100) were exercised with actual keyboard/mouse input. The model was inspected from the side for hand, seat and handlebar alignment. Bicycle pedals and legs now share a continuous crank phase.
- Added Pacific daylight alongside golden hour, rain and night. Dry asphalt uses a rougher nonmetal surface; the daytime sun is higher. Roads share aligned world texture coordinates, and terrain materials use distinct elevations.
- Screen-space contact occlusion reuses the beauty depth buffer, avoiding a second city geometry render. Performance mode disables it. A debug occlusion buffer confirmed contact detail at curbs, feet and foliage.
- Leaf-preserving tree reduction retains 126,013 triangles per near tree (24 Balanced / 48 High); the previous reduction erased most leaves. A regression checks all primitive attribute counts.
- Shadow diagnostics traced blocky street patches to coarse tree shadows. A 4096 px sun map with filtered PCF shadows visibly smooths the foliage shadows. Local street samples with the new effects ran around 32–45 fps at 1440×900 on the M2; this remains a sample rather than a hardware guarantee.
- Final build input check: car reached 58 km/h, braked, exited and re-entered at 100% health; all three weapons changed magazines to 14/27/7 and shotgun reload restored 8. Bicycle crank/foot alignment was checked while moving, with both ankles approximately 9 cm above the matching pedal (boot sole offset). Runtime error capture remained empty in these local checks. The complete production build and all 14 tests pass.

### Public release smoke check

The public `edd711a` build was opened in Chrome. The new protagonist loaded, on-foot W input moved the player, a pistol shot reduced 15 rounds to 14, and V/W drove a summoned car at 46 km/h with 100% health. Captured runtime errors stayed empty. The wider opening camera exposed a far-plane clip in the photographic horizon; halving the scenic plane's dimensions/distance preserves its angular size while keeping it inside the camera frustum. The local follow-up build visually removes that rectangular edge. Actor downloads now overlap city preparation, and the twelve landmark GLBs fetch concurrently; local resource timings confirmed overlap (no measured public cold-load speed claim).

The aerial camera now uses an 8 m near plane to retain depth precision between distant water, road and terrain layers. Third-person returns to 0.35 m and first-person to 0.08 m. The final local title capture showed stable water/roads; actual C/C input entered first-person with the pistol visible and no captured runtime errors. Representative waterfront and driving captures are committed under `docs/screenshots/`.

## Pedestrian cast — 2026-11-14

All 34 pedestrians now use clothed rigged models (23 male-template and 11 female-template variants), with distinct clothing/skin palettes, height/build variation and independent locomotion phases. The second CC0 export has a hoodie, jeans, boots and ponytail; its licensing and settings are preserved. Both rigs and their fitted clips pass asset checks (15 total tests). In-browser inspection confirmed all pedestrians use the detailed models, and a close pedestrian's position and leg quaternion both changed during normal simulation. Local close-up scene samples were approximately 38–44 fps with no captured runtime errors. Daytime bloom was reduced so crosswalk paint no longer glows; night retains stronger light bloom.


## Storefront depth — 2026-11-14

Street-facing shopfronts use three licensed photographed interior panoramas with box-projected parallax. Individual shops share one room across their panes, with separate mullions, transoms, handles, fabric canopies and signs matched to their shop type. Front and oblique close-up views and nighttime lighting were inspected in Chrome at 1440 × 900. Scene samples were 41–42 fps; this is a local observation, not a hardware-independent benchmark. The rooms remain visual interiors behind building collision shells.

The debug state now records window errors, unhandled promise rejections and shader compilation failures instead of returning a constant empty array. The new pass completed local rendering with an empty recorded error list; all 15 existing tests and the production build pass. Three new CC0 panoramas add about 2.6 MB of compressed assets. Public deployment verification follows the commit.


## Residential façades — 2026-11-14

Mapped houses, garages and civic/industrial buildings no longer receive generated shops. Apartments retain mixed-use retail on named commercial streets; residential streets retain their residential treatment. Two behavioral tests cover this distinction (17 tests total). Modeled paneled doors and sash window frames are extracted from James Ray Cock’s CC0 architectural kit, with normalized pivots and 1024 px WebP maps in a ~0.4 MB GLB. At most 192 nearby details render on Balanced, 384 on High and 64 on Low. A West End close-up showed independent frame/ledge depth, doors and stone surrounds without recorded runtime/shader errors; the sample rendered about 39 fps. These remain generic details rather than a surveyed reconstruction of individual buildings. If the optional detail asset cannot load, the base city remains playable.

Public smoke on the prior storefront checkpoint `176330f` passed walking, driving at 63.8 km/h, cycling at 21.7 km/h, all three weapons and a completed shotgun reload, at 100% vehicle health with an empty recorded runtime error list.

## Curtain walls and Arthur Erickson Place — 2026-11-14

`e21dc36` deployed PBR curtain-wall maps and metal frames, with separate night reflection lighting. `d89c40d` deployed original reference-guided Arthur Erickson Place geometry and a sky radiance limit that prevents extreme sun bloom. The landmark includes two offset concrete masses, 27 floors, deep single-pane recesses, end-wall glazing slots, tapered walls and a reflecting basin. A geometry regression confirms that it remains within its mapped collision footprint. Reference photographs stay out of the distributed game; the cast-concrete material is separately licensed CC0 photography.

Local actual-input checks on West Georgia passed walking and driving to 53.7 km/h at 100% vehicle health. The public `d89c40d` bundle loaded the landmark, and walking in its street scene changed the player position. Current recorded runtime/shader error lists were empty. For clarity, error-list assertions in checkpoints before `176330f` relied on the old placeholder array and do not establish absence of runtime errors.

## Local scene reflections — 2026-11-14

The basin now uses a 128 px cubemap of static game geometry. The first capture happens during loading; entering the area did not trigger another capture. Changing weather nearby refreshed it automatically. Day/night views and the actual cubemap faces were inspected. Moving actors are excluded, the reflecting surface is hidden during capture, and tests cover restoration of visibility, shadow flags, sun position, XR and renderer target after success and a simulated failure. Performance graphics keeps the sky fallback.

After a night refresh, actual W input moved the character and pistol fire consumed one round (15 to 14), with no recorded runtime errors. Local street samples remained in the low-to-high 30s at 1440×900 Balanced. The first preparation took about 1.2 seconds inside loading in one warm-cache sample; a later weather refresh submitted in about 135 ms. These are local CPU submission timings, not a cross-device or GPU benchmark. The reflection is cached and approximate; it does not include moving actors or provide an exact planar mirror.


## Local population and walking routes — 2026-11-14

Population sampling clips every mapped road segment to the nearby area, including long roads whose ends are far away. Pedestrians can use park paths and follow successive polyline segments; their offset paths meet at corners and their heading follows their movement. Spawn candidates avoid water, buildings and close overlap. Normal travel recycles distant actors; fast travel immediately populates the destination.

Five regression checks cover clipped local sampling, later road segments, unusable geometry, route continuation/end turns and offset continuity. All 25 tests and the production build pass. Local actual-input walking changed position; a summoned car reached 22.15 m/s (79.7 km/h), braked to 0.10 m/s and retained 100% health. Stanley Park travel placed 8 walkers within 80 m, with 22 of 34 pedestrians on path/cycle/pedestrian ways in this sample. A five-second runtime probe observed four segment transitions; maximum sampled pedestrian speed was 1.56 m/s and ambient-car speed 10.78 m/s through curved offsets. No runtime errors were recorded. Scene samples were 29–35 fps at 1440×900 Balanced on the M2. Traffic remains basic route-following AI.


## Mapped road profiles and crossings — 2026-11-14

The road layer now retains OSM lane counts, one-way directions, widths, foot access, sidewalk sides and marked/unmarked crossings. Separate carriageways receive their own widths and white lane dividers; opposing lanes use yellow boundaries, including asymmetric lane counts. Dashes continue across short curved map segments. Separately mapped sidewalks replace duplicate generated slabs, park paths are narrower, and arbitrary sign-adjacent crosswalks have been replaced with mapped crossing markings. Traffic lane offsets use the road width and do not reverse onto one-way ways.

All 33 tests and the production build pass. New checks cover lane geometry, road-direction reversal, neighbouring-carriageway furniture clearance, committed map metadata, dash continuity, crossing styles and the northbound Ironworkers arrival. In-browser inspection counted 30,063 road/path ways and 5,876 generated lamps/signs with no positions inside a street surface. Pedestrians used accessible paths. All ten travel points remained dry and clear; the corrected Ironworkers approach was also exercised in a car.

Actual input verified walking, a 29.0 km/h Stanley Park bicycle ride and car acceleration to 129.1 km/h followed by braking to rest, at 100% health. A separate northbound run moved 431 m onto the Ironworkers deck to 32.8 m elevation before encountering ambient traffic, at 100% health. Recorded runtime errors stayed empty. Stanley Park road/marking views and the elevated bridge were inspected; local samples were about 33–53 fps at 1440×900 Balanced. The map retains an ODbL source timestamp and a reproduction script. Missing road widths remain estimates; traffic and bridge architecture remain approximations.


### Junction marking follow-up

Lane paint is trimmed at shared junction nodes and separately mapped marked pedestrian crossings; straight road-way joins retain dash continuity. Two regression checks cover crossing/collinear behavior and marked versus unmarked pedestrian crossings (35 tests total). Granville before/after views confirmed that lane dividers no longer cut through the inspected intersection and crosswalk. Local rendering remained around 30 fps with an empty recorded runtime error list.

## Building heights and house roofs — 2026-11-14

An OSM metadata layer joins 20,054 building records to existing footprints, including 263 metre heights and 1,780 roof shapes. Explicit heights take priority, with building-use-specific estimates where height/floor tags are missing. Authored landmarks retain their geometry. Houses now use gabled, hipped or pyramidal roofs where supported, painted-wood PBR walls, grey roof tiles, roof-edge fascia and corner boards. Gable ends use plain cladding so repeated windows cannot be cut by roof slopes. Utility/industrial façades are opaque and residential balcony rules no longer apply to offices.

All 39 tests and the production build pass. Roof checks cover total tagged height, upward normals, no degenerate slivers, complete concave-footprint coverage and flat/tall-building fallbacks. Pacific Street day, oblique gable and night views were inspected at 1440×900 Balanced; final actual W input moved the player 5.8 m with no recorded runtime/shader errors. Scene samples were approximately 27–33 fps on the M2. Six CC0 material maps add about 1 MB; exact source/author records and fetch scripts are committed. Heights and materials remain approximate where tags are absent. The historical City 2009 dataset was investigated but is not used by this release.

## Law Courts and explorable Robson Square — 2026-11-14

The generic Law Courts building is replaced with original reference-guided concrete masses, projecting slabs, recessed glazing and an asymmetric glass canopy with a two-layer triangulated steel frame. Transparent canopy meshes do not cast an opaque roof shadow. The old solid office box over Robson Square is replaced with an open roof garden, reflecting pool, planted beds, shrubs, fifteen authored trees, benches and two small arched glass entries. Existing mapped trees now follow ground elevation.

All 43 tests and the production build pass. Tests retain the courthouse inside its collision footprint, verify that the garden/entries are open while the pool and courthouse remain blocked, exercise continuous approach elevations and compare rendered paving with the shared movement height (under 10 cm mismatch at tested triangle centroids). Local actual W input walked 41.7 m from 0.88 m to 3.28 m elevation. A bicycle summoned with B and placed on the same approach for a controlled test travelled 61.2 m with native W input, reached 46.1 km/h and retained 100% health. Runtime/shader error lists were empty. Garden, front and Hornby Street glass views were inspected; scene samples were about 29–33 fps at 1440×900 Balanced on the M2. Night mode was also exercised without recorded errors.

This is an approximate architectural interpretation. The real complex's detailed stairs, waterfalls, underground rink and exact floor plans remain unmodeled; the roof garden uses simplified continuous ramps. Reference photographs remain local, and existing CC0 materials provide the distributed surfaces. See `docs/sources/law-courts-robson-square.md`.

## Granville theatres — 2026-11-14

The Vogue and Orpheum now have reference-guided façades and projecting two-sided signs at their mapped Granville entrances, replacing arbitrary floating entertainment signs. Vogue includes photographed carved reliefs and the Diana neon figure, a broad canopy, entry bays and a generic live-music board. The Orpheum entrance has pale piers, cornices, roundels, an arched grille and a rounded cyan sign outline. Four short-range lights and neon emission respond to day/night weather. The final carving texture is normalized and relit so the nighttime source photograph does not become a black square in daylight.

All 45 tests and the production build pass. The two new theatre tests verify their geographic placement, outward-facing lettering normals, finite geometry, clear ground-level sidewalk space and unshadowed practical lights. Both signs were inspected at street level in day and night, with no recorded runtime/shader errors. Actual W input walked 37.9 m along the Granville sidewalk. A car summoned with V and positioned on Granville for a controlled test accelerated using native W input to 129.6 km/h, then braked to rest with Space, retaining 100% health. Local 1440×900 Balanced scene samples were about 27–33 fps on the M2. Five texture assets add about 0.9 MB; provenance, attribution and reproduction script are committed.

Theatres are architectural scenery with closed interiors. Proportions, typefaces and decoration remain approximations, as do neighbouring buildings. These checks verify a playable refinement, not AAA production fidelity.

## Commodore Ballroom — 2026-11-14

The mapped Commodore frontage replaces the generic block with an original stepped/parapeted façade, patterned masonry, eighteen recessed arched windows, radial muntins and arch bricks, stone piers/sills, photographed tile ornament, curved entrance canopies and the photographed neon sign. Seven shop bays use the existing parallax interiors and generic labels. The source panorama is historical reference; the building proportions and decorative geometry remain approximations, and interiors remain closed.

All 48 tests and the production build pass. Tests verify footprint/ground-level clearance, raycast through all eighteen arch openings to glass 19 cm behind the façade plane, and a continuous wall between the storefronts and upper façade. Close day/night views caught and fixed a gap above the shop floor and excessive canopy/sign glow. Ten licensed texture derivatives add about 0.6 MB. Actual W input walked 28.6 m from a controlled start below the main entrance canopy. V summoned and entered a car on the nearest road without manual vehicle placement; W reached 108.8 km/h and Space braked to rest, with 100% health. Recorded runtime/shader errors remained empty. Street-level samples were approximately 25–32 fps at 1440×900 Balanced on the M2. Source/author/license/derivative records and the reproduction script are committed.

## City tree positions and scale — 2026-11-14

- Added a separately licensed City of Vancouver public-tree layer: 45,600 live records, 460 planting sites excluded, with species, recorded metre heights and converted trunk diameters. Runtime reconciliation replaces OSM points within five metres and retains unmatched trees. The rendered world contains 52,178 trees after collision filtering and procedural forest/planter additions.
- Granville's recorded 4.6 m beeches now retain that height; fastigiate/columnar cultivars receive narrower estimated crowns and conifer genera use fir foliage. Nearby CC0 tree geometry scales height and crown width independently; lower-stem deformation also applies to the sunlight shadow material. Crown shapes remain interpretations.
- All 52 tests and production build pass. Tests cover extract integrity, coordinate bounds, duplicate/planting-site suppression, real Granville heights and canopy-form differences. Daytime Granville close/street views and Stanley road views inspected. Local scene samples were roughly 32–37 fps at 1440×900 Balanced on the M2.
- Native W walking covered 25.6 m on Granville. Native V summoned/entered a car; W reached 121.0 km/h and Space stopped it at 100% health. A controlled setup on a straight mapped segment of Stanley Park Drive, followed by native B/W/Space, cycled 49.9 m, reached 44.0 km/h and stopped at 100% health. Recorded runtime errors remained empty.
- An earlier unattended straight-ahead bicycle input at the curved park entrance left the road and triggered water recovery; that attempt is not counted as a successful cycling check. The corrected road-aligned check above stayed on land.
- Stanley's forest floor/undergrowth is still too sparse and uniform; that remains the next visual task. Public deployment verification is recorded in the project log after release.


## Stanley Park woodland — 2026-11-14

Woodland now follows the unnamed mapped forest polygons and excludes mapped lawns, openings, water, buildings and route corridors. A seeded clustered distribution increases the rendered tree total to 70,234. New forest trunks have circular movement collision. Nearby CC0 conifers retain their twig geometry and repaired trunk UVs/alpha; roots are buried without changing canopy height. Two crossed views of the same model replace distant conifer cards. Soil/leaf-litter photography, centimetre-scale moss, ferns, shrubs, nettles, rocks and stumps fill the nearby forest floor. Exact provenance and reproduction steps are in `docs/sources/stanley-forest.md`.

All 56 tests and the production build pass. New checks cover actual forest/lawn/road exclusions, every generated tree's route clearance, solid trunk movement, matching conifer vertex attributes, valid twig alpha and the transparent silhouette atlas. Day/night forest and road views were inspected at 1440×900. The graphics pool settles at 0/8/24 detailed conifers for Performance/Balanced/High. Deliberately blocking the fern GLB request still allowed the final bundle to reach the playable start screen using distant-tree fallback, with no recorded runtime errors.

Controlled setup on a straight mapped Stanley Park Drive segment followed by native input verified 9.0 m walking, a 50.1 m bicycle ride reaching 43.5 km/h, and a 51.3 m car run reaching 77.9 km/h. Both vehicles braked to rest with 100% health. Native walking toward a new trunk stopped 0.708 m from its centre, retaining the player/trunk clearance. Native aim/fire consumed one pistol round (15 to 14). Runtime error lists remained empty and reflection error stayed null. Local Balanced forest samples were roughly 20–31 fps on the M2; Performance settled around 50–56 fps in a stationary scene. These are scene samples, not a cross-device benchmark.

Terrain remains flat here, distant silhouettes and repeated tree forms remain noticeable, plant distribution/species are approximations, and small ground props do not block movement. The forest is denser and more detailed, but this does not establish AAA fidelity. Public deployment verification is recorded in the project log after release.


## Conifer variety and middle-distance geometry — 2026-11-14

Stanley conifers mix two licensed fir shapes, including a fuller B variant extracted from the source model. The existing C near model retains all its needles; the new B near model has 390,441 triangles. Intermediate models contain 48,048 and 76,555 triangles. They retain sampled needles as correctly oriented two-triangle strips, with transverse width compensation, original texture coordinates/alpha and refitted branch normals. Balanced displays up to 8 near and 64 middle trees, High 24 and 128. A 12% selection preference prevents neighbouring trees repeatedly exchanging detail after tiny movements. More distant trees use the matching four-view atlas, under a new filename to avoid the old two-view image remaining in browser caches.

All 59 tests and the production build pass. New tests cover separate budgets, disjoint levels, Performance release, selection stability, valid model attributes/indices/alpha and bounded geometry/needle reduction. Both source silhouettes and the final forest were visually inspected. A controlled Stanley Park Drive setup followed by native W input walked 9.0 m; native B/W/Space cycled 33.0 m, reached 40.2 km/h and stopped at full health. Performance mode restored all 72 previously hidden distant crowns and emptied both geometry pools. High/night settled at 24 near plus 128 middle trees; returning to Balanced/day restored 8 plus 64. Recorded runtime errors stayed empty and reflection error remained null.

Balanced local forest/road samples were approximately 19–26 fps at 1440×900 on the M2; Performance reached 51 fps and High/night about 14 fps in this sample. Geometry depth and canopy variety improve, but the rendering cost remains substantial. Rocks/stumps have fewer triangles with bounded simplification and unchanged material maps. LOD boundaries remain discrete without a crossfade; flat terrain and repeated shapes remain visible limitations. These checks establish a playable graphical refinement, not AAA fidelity. Source manifests and reproduction commands are in `docs/sources/stanley-forest.md`.

## 2026-11-14 — Stanley Park elevation and continuous ground

The City of Vancouver's approximate **2002** contours now produce a 4 m terrain grid across Stanley Park: a 76 m western summit, around 54 m at the sampled Prospect Point viewpoint, Lost Lagoon at 2 m and Beaver Lake at 10 m. Interpreted grades smooth roads and keep the seawall at 2 m. One indexed terrain mesh carries land-use materials, avoiding intersecting grass/soil overlays; roads sample the same triangular surface with denser longitudinal/transverse geometry. Buildings, trees, undergrowth, signs, lamps, actors and vehicle pitch/bank follow the terrain. The south Lions Gate approach joins the raised park; height-aware movement retains lower routes beneath the deck.

All **65 tests and the production build pass**. Terrain tests cover source attribution/checksums, relative landmark/lake heights, flat-city boundaries, matching rendered triangle/movement heights and bridge layers. Two animation regressions verify that procedural bicycle lean/IK does not accumulate on constant tracks or corrupt moving animation tracks. The mixer’s animated joint rotations are restored before each frame and captured before procedural posing.

Local native input from a controlled straight Stanley Park Drive setup walked **8.6 m** (41.63→41.38 m elevation), cycled **25.3 m** including braking (36.4 km/h peak, 41.38→40.03 m, full health) and drove **40.9 m** including braking (70.0 km/h peak, 39.48→37.50 m, full health). A separate native walk crossed **28.7 m** of seawall beneath Lions Gate, retaining y=2 m while the upper deck at the final coordinate was 55.43 m. No water recovery occurred. Recorded errors stayed empty and reflection error was null. These movement checks preceded only the animation-pose repair; the final bundle `index-Bq5-f-0o.js` then passed another native bicycle ride/brake check at full health. Three rider head-position samples across six seconds stayed within a 6.5 mm vertical range, and the repaired pose was visually inspected (`docs/screenshots/stanley-terrain.webp`).

The first visual review caught conflicting triangulations in stacked ground polygons; a single shared grid replaced them. The second caught accumulating bicycle lean; this is fixed in the final bundle. Local Balanced forest driving/road samples were **17–21 fps** at 1440×900 on the M2. Canopy rendering cost, coarse material edges, cliff/retaining-wall appearance and simplified road cuts remain visible limitations. The result is a playable terrain improvement, not AAA fidelity or a current survey. Source and geographic-database licences, source age, interpolation gaps, road grading and reproduction are documented in `docs/sources/stanley-terrain.md`.

## 2026-11-14 — Coastal rock and spatial foliage rendering

Stanley natural terrain now blends a 2K CC0 photographed rock surface onto steep slopes, with triplanar color/normal/roughness projection at a 2.7 m scale. Vancouver GeoTour cliff photographs guided the choice; no reference photographs are distributed and the texture is not a Vancouver scan. Generated conifers/understory avoid gradients above 0.75, changing the total tree count from 70,234 to 69,989 while retaining mapped point trees. The first visual pass exposed large soil patches on cliffs; adjusting the slope transition improved continuity. The coarse contour-derived geometry remains visible.

Conifers now use 32 m spatial batches and ground props 24 m batches. View and shadow cameras cull them independently, with unchanged 8/64 Balanced and 24/128 High tree budgets. Slots reuse shared geometry/materials and allocate compact matrix/color arrays; a growth path releases only replaced instance buffers. At the controlled forest view, 6,076 staged primitive instances matched 6,076 tiled instances, with 10,192 allocated instance slots instead of the 326,076 slots that full-capacity-per-cell allocation would require. This compares allocation strategies, not memory use against the previous single-batch release. Sun/shadow targeting and rain placement follow terrain elevation.

All **69 tests and the production build pass**; after the final slope adjustment, the 11 affected forest/spatial tests and production build passed again. New regressions cover matrix/color/stem-attribute preservation, independent view/shadow visibility, compact buffer growth/disposal and slope exclusions. The final local bundle is `index-CCkr9gaf.js`.

At the same 1440×900 Balanced camera on Stanley Park Drive, the earlier release submitted about 33.70 million triangles across rendering passes; the final local scene submitted 24.21 million (about 28% fewer). Sampled rates were 18 and 22 fps respectively. LOD hysteresis and ambient actors vary slightly between sessions, so this is a scene comparison, not a controlled GPU benchmark or a general frame-rate guarantee. Final walking/driving forest samples were 19–22 fps; the seawall view was around 30–31 fps. High/night remained costly at about 13 fps.

Native input from controlled starting positions verified 9.6 m seawall walking near y=2, 9.5 m forest-road walking, 26.9 m cycling at 37.1 km/h and 46.5 m driving at 74.2 km/h; both vehicles braked to rest at full health. Native vehicle exit and all three guns passed (ammo 15/30/8 → 14/29/7). Performance restored all 72 previously hidden distant crowns and hid every detailed conifer tile; High/night selected 24+128 and returning to Balanced/day selected 8+64. Recorded runtime errors remained empty and reflection error null. Day cliff/forest, cycling and night views were inspected. [Actual cliff capture](screenshots/stanley-cliffs.webp), [source and limitations](sources/stanley-cliffs.md).

These are playable visual/performance refinements. Repeated foliage, visible material boundaries, simplified cliff shapes, missing seawall masonry/rail details and incomplete architecture remain; AAA fidelity is not achieved.


## 2026-11-14 — Prospect Point lighthouse and mapped seawall

The original lighthouse replaces its generic mapped building with a flared/tapered white tower, red band, door framing, rear circular recess, ladder/cage, roof rail/antennas and a timed red beacon. It follows the actual OSM footprint and 11.5 m focal-height metadata; detailed proportions are interpreted from Vancouver reference photography. Two mapped wall ways add about 3.23 km of masonry along the northern/western coast, with stone coping, a damp tidal band, mapped railing and low-wall collision. Tagged shore steps have solid descending geometry. Closely parallel walk/bike lanes and their wall edge receive paving infill; tagged blocks use world-aligned photographed herringbone paving. The visible terrain clips to mapped ocean polygons while retaining the original interpolated land heights, normals and UVs.

All **72 tests and the production build pass**. New tests verify clipped land area/slope/upward faces, finite coastal geometry, every eligible metre-sampled seawall centreline remaining clear, low-wall height-aware blocking, beacon elevation and lighthouse footprint/visible façade/door placement. Visual review found and fixed buried door details, inward-facing base walls, grass gaps at the coastal edge and a floating step ribbon. Six CC0 2K masonry/paving maps total 8.60 MB, with author/source/license/reproduction records. The final bundle is `index-DP9qBRid.js`.

Native W input, with controlled headings between curved route segments, walked **35.0 m** around the lighthouse at y=2 m without recovery or new obstruction. A controlled straight seawall start followed by native B/W/Space cycled **11.4 m**, reached **27.3 km/h** and stopped at full health. On the final paving build, native V/W/Space drove **22.1 m**, reached **52.1 km/h** and stopped at full health on the same wider route. An earlier car attempt encountered the bicycle parked by the preceding test; it is not counted as the clear car run. This does not establish full-car clearance around the narrow lighthouse bend.

Daytime approach, close paving, seaward masonry and night views were inspected. The beacon was observed at both lit/unlit states (emission 5/0.02 and light 8/0 at night), at world y=11.5 m. Recorded runtime/shader errors stayed empty; reflection error remained null. Local route/shore scene samples were about **25–45 fps**, and the inspected night shore view about **30 fps**, at 1440×900 Balanced on the M2. These are scene samples, not a general performance guarantee. [Actual game capture](screenshots/prospect-point.webp); [sources and limits](sources/prospect-seawall.md).

The large cliff shape, sparse adjacent vegetation, missing inner planter/retaining wall, abrupt surface transitions and simplified weathering remain visible fidelity gaps. The shore stairs are scenery, and lighthouse interiors remain closed. These changes improve the playable location; AAA fidelity is not achieved. Public release verification is recorded in the project log after deployment.

## 2026-11-14 — Prospect Point planted bank and continuous forecourt

Added two photo-guided retaining edges with a battered profile, coping, joints and drains; 3,108 slope-oriented broadleaf cluster sites in the inspected scene; and a geographically masked, triplanar leaf-cover surface. The original 240-leaf cluster is 1,320 triangles with licensed Shrub 04 photography. Model plus two 1K leaf-cover maps total 560,312 bytes. Wind moves the leaves and their depth/shadow silhouette. Spatial cells are 24 m with a 420 m bound; Performance hides these 3D clusters while retaining the surface cover. [Sources and limits](sources/prospect-bank.md).

Visual review rejected a sparse source-branch model and replaced it with a fuller original cluster. It also exposed uneven forecourt triangles: the forecourt now has continuous herringbone paving over an explicit shared 2 m walking grade, with the original terrain clipped below it. Adjoining coastal infill follows the path's grade. The contour source file is unchanged. The final build is `index-nSIbXz9R.js`.

All **76 tests pass**, and the final production build passes. New regressions cover eligible walk/bike centreline clearance, the full plant envelope against road widths, planting on steep ground, leaf-cover exclusions, the model radius including wind, and raycast-visible level paving across more than 200 forecourt samples. Earlier shoreline/lighthouse and city tests remain passing.

On the paving build immediately before the final Performance visibility toggle, native W input with controlled headings walked **34.88 m** around the lighthouse bend at y=2 without obstruction/recovery. A controlled straight seawall start with native V/W/Space drove **9.49 m under throttle**, reached **45.67 km/h**, and stopped after **19.05 m total**, at full health. Native B/W/Space cycled **6.96 m under throttle**, reached **24.47 km/h**, and stopped after **8.93 m total**, also at full health. These vehicle checks cover the adjacent wider section; they do not establish full-car clearance around the narrow lighthouse bend.

The final paving, planting, lighthouse approach and night view were visually inspected. Recorded runtime/shader errors were empty; the reflection error field was null. Path/front samples were about **29–34 fps**, the inspected night front **31 fps**, and broad coastal/driving views roughly **18–21 fps**, at 1440×900 Balanced on the M2. These are individual scene samples, not a general benchmark. Public checks, including the final Performance switch, are recorded in the project log after deployment.

The contour-derived cliff is still coarse, the vegetation repeats, and distant conifer silhouettes remain thin in some views. The retaining/plaza geometry and planting species/distribution are interpretations of photographs and mapped context. AAA fidelity remains unfinished. [Actual game capture](screenshots/prospect-point.webp).


## 2026-11-14 — Layered conifer branches and elevation-aware detail

Middle-distance conifers retain their actual wood and use eight depth slices from each of two perpendicular views for foliage. Separate color/normal atlases retain branch coverage and lighting; the depth shader uses the same view-family selection. Corrected/padded texture edges avoid dark fringes. Branch-shaped bands retain every visible source pixel while removing 76–84% of the rectangular card area. C/B middle trees now contain **3,304/3,949 triangles**, compared with 48,048/76,555 in the retained geometric fallback. Four CC0-derived atlases total 2,118,894 bytes. Near trees and total tree count are unchanged. [Method, sources and limits](sources/stanley-forest.md#layered-middle-distance-foliage).

Detail selection accounts for the vertical extent of each tree. Cliff-top trees do not take close-up slots from lower seawall trees. Photo-mode scenery follows the camera: raising the camera alone to y=260 released both detail levels; lowering it to y=44 restored 8+64 while the player stayed at the same ground position.

All **81 tests pass**, and the final production build passes (`index-hdWJ2x7R.js`). New checks cover partial texture cleanup, cliff/crown/unknown-elevation selection, source-normalized projection without mirrored UVs, every slice's alpha/normal/color integrity, and preservation of every visible branch pixel inside the trimmed geometry. Deliberately blocking one foliage image through startup retained the original middle models and allowed **6.34 m** of native walking, with empty recorded errors and null reflection error. Browser network settings were restored afterward.

Final native input from controlled Stanley Park Drive starts walked **8.99 m**, drove **28.50 m** including braking (59.89 km/h peak) and cycled **9.97 m** including braking (26.71 km/h peak). Both vehicles stopped at full health. Native exit and all three guns passed: ammunition 15/30/8 → 14/29/7. Performance restored all **152** distant crowns from High, verified within 0.0005 matrix-element tolerance for Float32 storage; High/night selected 24+128, and Balanced restored 8+64. Recorded runtime/shader errors stayed empty and reflection error was null. Day, night, riding and oblique photo views were inspected.

At the same initial forest pose, the geometric fallback submitted about 24.10 million triangles across rendering passes and the final layered build 18.54 million, around 23% fewer. Sampled rates were 25 and 24 fps: this does **not** establish a frame-rate improvement. Final forest gameplay sampled 19–24 fps, High/night 15 fps and Performance 51 fps at 1440×900 on the M2. Near geometry, transparency and other scene costs remain substantial. These are individual scene samples, not general benchmarks.

The two vertical view families remain approximate at steep overhead angles. Repeated forms, dither, discrete LOD transitions, sparse undergrowth and coarse contour-derived coastal geometry remain visible. Middle foliage has no branch wind animation. This is a playable foliage refinement, below AAA fidelity. [Actual final game capture](screenshots/stanley-forest.webp). Public verification is recorded in the project log after deployment.

## 2026-11-14 — Prospect basalt relief, rock windows and wooded rim

Added a shared one-metre terrain patch over the existing four-metre contour base around Prospect Point, bounded interpreted relief, slope-aware rock/leaf distribution and local rim planting. Original contour files are unchanged. The finer cells replace coarse geometry, keep 160 m chunks and supply actor/plant heights. Rock cut faces now close the open edge where the level forecourt meets the hillside, splitting at each grid/triangle interpolation boundary. The forest map gap is filled within an explicit small rim polygon while mapped plaza and trail openings remain. The inspected build has 69,991 trees and 2,642 coastal shrub sites. No new texture/model downloads were added. [Reference, method and limits](sources/prospect-geology.md).

All **86 tests pass** and the production build passes (`index-Dm3tsiIZ.js`). New checks cover bounded relief and unchanged outside elevations, route grades and patch seams, non-overlapping replacement area, upward triangles sharing collision height, exposed-rock distribution, cut-wall raycast closure and mapped plaza/trail clearance in the rim planting. Existing forest-height assertions now distinguish the interpreted 14–27 m rim trees from 22–42 m interior trees.

Native W input, with controlled headings between curved route segments, walked **35.04 m** around the lighthouse at y=2 m without recovery or obstruction. Controlled straight seawall starts followed by native input drove **37.68 m** including braking, with **67.24 km/h** peak, and cycled **11.92 m**, with **28.03 km/h** peak. Both vehicles stopped at full health. Native exit and all three weapons passed (15/30/8 → 14/29/7 rounds). These car/bike checks cover the wider adjacent route, not the narrow lighthouse bend.

Final front/west/night views were visually inspected. The previously visible open forecourt cuts are closed. Performance hid all coastal clusters; High/night and Balanced/day restored the scene. Recorded runtime/shader errors were empty and reflection error null. Local curved walking sampled **39–47 fps**, driving/cycling **26–27 fps**, front/west photos **31–36 fps**, High/night west **37 fps**, and Performance west **46 fps** at 1440×900 on the M2. These are scene samples, not a measured performance improvement over the earlier build.

The fine detail is original interpretation over older contours, not modern LiDAR. Smooth broad cliff forms, sparse canopy at some rim angles, repeated plants and texture tiling remain visible; overhangs and a precise lookout reconstruction are absent. AAA fidelity remains unfinished. Public release verification is recorded in the project log after deployment.


## 2026-11-14 — Prospect Point walkable lookout

Added the map-derived upper plaza, connecting stair flights and paths, black railings, stone-pier lower viewing court and original benches. Concrete, asphalt and planting now have distinct surfaces; rounded path joins prevent corner dips. Visible treads and actor height share the same construction levels, terrain is cut away beneath the structures, and exterior cut/fill faces close the bank. The lower planted island has its own raised walking height. [Source, interpretation and historical-reference limits](sources/prospect-lookout.md).

All **91 tests** and the production build pass. Added surface partition, per-tread raycast/height, route clearance, finite geometry and corner/planting checks; the terrain/collision test now includes the actual construction cutouts. Final browser checks used the production preview: **120.89 m** over 23 native-input segments down the main stairs, around the lower court and back to the plaza. Maximum endpoint error was **0.17 m**; both previously dipped corners remained at 58.4 m. Car and bike acceleration/braking stayed at full health; all three weapons consumed ammunition (14/28/7 remaining). Day/aerial/walking views were inspected, High/night rendered, and Balanced/day restored with empty recorded errors and null reflection error. The earlier railing obstruction and corner dips were corrected before this build.

The map fixes outlines and routes, not precise construction elevations or every current detail. The lower court uses historical photography; the café is still generic, nearby conifers remain too sparse, and the landscape still shows repetition and broad height-field slopes. This is a tested prototype checkpoint, below AAA fidelity. Public release verification follows deployment in the project log.

## 2026-11-14 — Fuller conifer canopy and source normal lighting

B near foliage now retains 215,612 of 432,704 needles, with 1.6× transverse coverage compensation and simplified wood: 964,225 triangles in a 51,271,008-byte quantized GLB. C keeps its original needles. Shared close/capture alpha cutoff 0.12 preserves fine filtered branches; regenerated far silhouettes use 0.18. Far dimensions and source SHA-256 hashes are generated from the same committed GLBs. Near materials preserve the source normal-map Y convention; middle atlases now include the twig normal map instead of only geometric vertex normals. [Reproduction, provenance and limitations](sources/stanley-forest.md#canopy-coverage-and-normal-map-correction--2026-11-14).

All **92 tests and the production build pass** (`index-BOEBMTG5.js`). New verification covers packed B metre-scale bounds and usable unit normals, fuller needle retention, generated atlas dimensions/source hashes and existing texture/geometry integrity. Source/full/reduced trees, final forest, lookout and night views were inspected. The local source/candidate caches were removed after validation, recovering approximately 287 MiB; installed tools and the busy shared uv cache were retained.

Native input from controlled starting positions completed the 23-segment lookout route: **120.88 horizontal metres**, maximum timed endpoint error **0.21 m**. A clear forest-road car run covered **23.05 m**, reached **66.35 km/h** and braked to rest at 100% health. Seawall cycling covered **9.38 m**, reached **28.07 km/h** and braked to rest at 100% health. All three weapons fired (remaining magazines 14/28/7). Performance, High and Balanced selected the expected 0/0, 24/128 and 8/64 forest details. Runtime errors remained empty and reflection error null.

At 1440×900 on the M2, individual samples were **23 fps** driving, **25** cycling, **24** from the forest view, **30** upper lookout, **27** aerial, **26** High/night and **44** Performance. These are scene samples, not a measured speedup or general benchmark. Near-tree download/render cost has increased. Middle foliage remains chunkier/lighter than close needles, distant trees repeat, and the broad cliff/material transitions still limit realism. AAA fidelity remains unfinished. Public verification is recorded after deployment in the project log.


## 2026-11-14 — Vancouver landmark surface materials

The 12 imported landmarks retain their geometry and placement, with new photographic brick/mineral/patina families, metre-based tangent-plane projection, separate terracotta/concrete/stone responses and restrained stone/panel joints. Waterfront brick uses the source's published 1.4 m repeat; Marine Building green ornament is ceramic, and the library uses aligned concrete panels. Mineral maps crop out the source floor joints and correct normal-map signs when mirrored. Nine CC0 maps total **4,106,006 bytes**. [Architectural references, texture provenance and limits](sources/landmark-surfaces.md).

All **95 tests and the production build pass** (`index-DNLbaUNK.js`). New tests cover metric texture density on rotated/pitched planes, unchanged geometry, distinct ceramic/patina responses, source-material preservation, texture reuse, normal-map integrity and seamless mineral edges. Visual review reduced overly prominent distant joints and corrected the station trim tint. Final street-based views of Waterfront Station, the gallery, Hotel Vancouver, Marine Building and the library were inspected, with no recorded shader errors. Earlier captures from inside neighbouring buildings are excluded from this validation.

On the final production preview, native input from controlled starts walked **9.71 m** on West Cordova Street, drove **35.61 m** including braking at a **67.09 km/h** sampled peak, and cycled **11.33 m** at **28.13 km/h**. Both vehicles stopped at 100% health; native exit and all three guns passed (magazines 15/30/8 → 14/29/7). High/night, Performance and Balanced/day rendered successfully. Recorded runtime/shader errors stayed empty and reflection error null. Day/night station and street walking views were inspected.

Individual 1440×900 M2 samples were **31–41 fps** across the landmark viewpoints, **25 fps** driving/cycling, **37 fps** at the station day view, **38** High/night and **51** Performance/night. These are scene samples, not a measured speedup or performance guarantee. [Actual station capture](screenshots/waterfront-station.webp).

The maps are generic licensed photography, not scans of Vancouver buildings. Joint dimensions, roughness and patina are interpretations. Flat/blank window interiors, simplified carving and arches, repetitive surrounding buildings and incomplete local reflections remain visible; this is a prototype material refinement, below AAA fidelity. Public verification follows deployment in the project log.


## 2026-11-14 — Convention Centre West exterior and promenade

Replaced the generic building at the mapped site with original sloping planted roof plates, leaning glazing, timber soffits, fascia/mullions, simplified foyer floors/core/lounge scenery and three local reflection probes. The lower glass collision follows its setback, while the outer paved deck and shore rail follow the mapped footways/cycleway. Existing CC0 materials are reused; no reference photographs or new game media are bundled. [Sources and interpretation limits](sources/convention-centre.md).

All **99 tests and the production build pass** (`index-Bh71cYuF.js`). Four new tests cover finite/bounded geometry, raised roofs, dry perimeter clearance, hall/rail collision, visible paving height, interior floors staying under their roofs, and more than 350 metre-spaced samples of mapped walking/cycling centrelines. A protruding upper floor and too-narrow initial deck were corrected before this candidate.

Native W input with controlled headings walked **140.11 m** along the north promenade, with a maximum timed endpoint error of **0.06 m** and continuous y=0.04 m. From controlled starts, native car input covered **36.33 m** including braking, reaching **67.76 km/h**; cycling covered **11.37 m**, reaching **28.17 km/h**. Both stopped at full health. Native exit and all three weapons passed (magazines 15/30/8 → **14/29/7**). The first weapon attempt had no pointer capture; Chrome reported WrongDocumentError. Bringing the tab to the foreground restored native pointer lock and firing without a game-code change.

Harbour, west/entrance, promenade, roof and night views were inspected. Geometry raycasts did not show protruding beams at the checked lower-roof line; rays toward the sun hit neighbouring high-rise surfaces. High/night, Performance and Balanced/day rendered, recorded runtime/shader errors stayed empty and reflection error was null. Individual 1440×900 M2 samples were **36–40 fps** across the refined views, **43** driving, **39–40** cycling and **40** during weapon checking. These are scene samples, not a benchmark or measured speedup. [Actual game capture](screenshots/convention-centre.webp).

Heights, roof subdivisions, interiors and planting remain interpretations. The deck uses the game's flat downtown elevation, not the real tide/shore structure. The hall is scenery, not an accessible interior. Western plaza/canopy/art, shore habitat and surrounding architecture remain incomplete, and repeated façade/plant details are visible. AAA fidelity remains unfinished. Public release verification is recorded after deployment in the project log.
