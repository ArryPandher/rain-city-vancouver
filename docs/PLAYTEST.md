# Rain City verification

2026-11-14. Tested on the local MacBook Air M2, Chrome with WebGL 2, 1440 × 900, Balanced graphics. This is a playable independent prototype, not a claim of AAA production quality.

## Automated

`npm test`: 11 checks passing, covering vehicle speed limits, frame-rate stability, braking/reverse, steering, bicycles, coordinate projection, polygon/segment queries, swept building collision, bridge height/water handling, curved ramp continuity and camera angle wrap. `npm run build` includes TypeScript checking and a production Vite build.

## Interactive evidence

- Main menu enters driving and on-foot exploration through actual UI buttons.
- E exits the vehicle; WASD moves the character through mapped streets.
- V brings a car; W + A produces a continuous left turn. Space brakes.
- 1 equips the pistol; mouse aim/fire consumes ammunition, triggers recoil/effects, and R restores the magazine while decrementing reserves.
- All ten fast-travel spawns were checked for dry ground and clearance from building collision.
- Browser loads the expanded city without an uncaught exception or console error.

Additional release checks and scene captures are appended after final verification.

## Practical limits

Roads and footprints use real map data; terrain elevation and building architecture are interpretations. Landmarks are original simplified models. The eastern extension emphasizes map coverage. NPC behavior and traffic are basic. Cars can use paths and the seawall in this sandbox. There is no multiplayer, police simulation, campaign, interior exploration or mobile touch control. Desktop keyboard and mouse required.

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
