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
