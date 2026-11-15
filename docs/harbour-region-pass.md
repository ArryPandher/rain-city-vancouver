# Harbour Green exterior and browser-control checkpoint

2026-11-14 Vancouver time. A partial quality improvement, not AAA acceptance.

## What changed

- Generic raised roof planting is clipped to supported podium roof outside actual tower outlines, with solid low stone rims.
- Twenty-three mapped waterfront street ways get bounded gutter/curb/apron depth with crossing openings. The Bute approach exposed a pre-existing terrain discontinuity: the park land-use edge switched height formulas. A continuous landward grade now connects street, paving and collision to the existing 6.14m upper stair datum.
- Harbour Green keeps its maintained open lawn; sparse glowing needles are removed, with restrained photographic turf variation and narrow path/trunk wear.
- Six shallow stone/glazed frontage bays and canopy/railing members flank the Bute stair axis, interpreted from the historical Darwin photo. Their geometry is original and still approximate. A park fast-travel pin reaches the street approach.
- Embedded browsers that cannot grant pointer lock can drag to look while holstered, right-drag to aim with a weapon, and left-click to fire. Native mouse capture remains supported. UI clicks, pause and lost capture clear firing state; aim/fire chords use mouse button events.

No new photo-mode features are included. The existing Codex browser was the only test browser; no Chrome tabs or extra game instances were opened. Three Astra agents handled separate geometry, material and review/input work.

## Verification and limits

All 158 tests and the production build pass. Relevant cases cover polygon containment, sloped curb faces and crossings, landward terrain continuity, frontage route clearance, lawn wear masks and mouse-capture fallback. These checks do not establish visual realism.

The existing Codex tab loaded the game without observed browser warnings/errors. Native driving climbed the repaired approach, followed by braking. A separate final input pass ran/walked from (-143.43,4.17,-685.41), through the Bute stairs and fountain, to (-79.98,1.55,-795.73). Five native drags turned the camera approximately 180 degrees despite pointer lock remaining unavailable. Actual firing left 14 pistol, 25 carbine and 7 shotgun rounds. Chord transitions have unit coverage; a separate native chord check is not claimed.

Day and night gameplay views were inspected at the fountain. The terrain cliff is gone. The new frontage supplies the missing horizontal backdrop but does not yet closely match the photograph: canopy profile, stone detail, water/spray, backdrop buildings and animation need work. See [matched-view gates](COAL-HARBOUR-VISUAL-GATES.md).

At a 903×670 Codex viewport and Balanced graphics, instantaneous daylight observations ranged from 9 to30fps; the downtown-facing view was especially costly. Night showed14fps. These are HUD observations, not a controlled performance comparison or a five-minute benchmark. The sustained30fps gate remains unmet. No AAA or near-photographic claim is supported.

Local evidence: `artifacts/local/harbour-region-local-check.json`, `harbour-region-tests.txt`, and screenshots284–287. The attempted283 “before” capture was taken during HMR loading and was renamed `283-harbour-loading-not-comparison.jpg`; it is not comparison evidence. The actual jagged approach was observed in the Codex tool screenshot before the repair.

## Next

Prioritize the fountain's thin reflective wet surface and spray, exact stone/canopy profiles and correctly identified background facades. Profile downtown-facing submissions/shadows on the same ordinary-gameplay route. Keep only one Codex game instance. Robson/Granville and a Stanley seawall region follow once the first region meets the visual and moving-gameplay gates.
