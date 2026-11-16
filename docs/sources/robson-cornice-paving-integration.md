# Robson cornice and paving integration

2026-11-16. Candidate, not a published release.

The gallery rear pediment adds source-registered closed raking mouldings, projecting cornice and dentils in the existing stone batch (542 triangles, no added draw). Normal third-person view at player [-68.78511329120707,0,51.52276041041648] shows the profiles clearly. Switching to the existing close camera reproduces the saved `gallery-crown-after-profile.json` position/yaw/pitch/FOV within floating precision; no scripted hidden camera or image overlay was used.

The new Robson paving material is applied only to the main garden substrate in `robson-square.ts`, with existing worldX/4,worldZ/4 UVs. Native terrace view is being audited because a footway/overlay may hide this substrate; do not claim an accepted visible paving improvement until coverage is confirmed.

Debug-only comparison buttons for Robson gallery and terrace reuse normal walking support, collision checks, character controller and chase camera. No player collision or world elevation changes.

Production build and ten focused gallery/paving tests pass for the initial candidate. Native walk from [-145.89439,1.68,127.92436] to [-142.16,1.52,124.19], pistol15→14 and holster passed; captured warnings/errors empty. `artifacts/local/robson-cornice-third-person.png`, `robson-cornice-profile.json`, `robson-paving-third-person.png`, `robson-paving-profile.json` and `robson-cornice-paving-native.json` retain evidence. No AAA, final-scene readiness or performance gain claim.
