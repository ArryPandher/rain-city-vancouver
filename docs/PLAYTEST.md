# Rain City verification

2026-11-14. Tested on the local MacBook Air M2, Chrome with WebGL 2, 1440 × 900, Balanced graphics. This is a playable independent prototype, not a claim of AAA production quality.

## Automated

`npm test`: 14 checks passing, covering vehicle speed limits, frame-rate stability, braking/reverse, steering, bicycles, coordinate projection, polygon/segment queries, swept building collision, bridge height/water handling, curved ramp continuity and camera angle wrap. Asset regressions cover quantized landmark transforms, matching optimized tree attributes and the protagonist skeleton/locomotion clips. `npm run build` includes TypeScript checking and a production Vite build.

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
