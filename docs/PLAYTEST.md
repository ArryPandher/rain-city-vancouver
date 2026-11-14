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
