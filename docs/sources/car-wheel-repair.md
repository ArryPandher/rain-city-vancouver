# Car wheel geometry and contact repair

2026-11-14. Uses the existing committed `car-concept.glb` and `car-traffic.glb`.
No model downloads, geometry replacement or material styling changes.

## Measured defects

Both assets pose their front wheel axles at approximately 30 degrees: transformed
local X is `(0.866, 0, 0.5)`. Rear axles are `(1, 0, 0)`. The previous runtime
baked that showroom steering into every front tyre/rim, then spun them around X.
The front wheels therefore spun about the wrong axis. Source transforms had
positive determinants; this was not an inverted mirrored-wheel winding problem.

The source BrakePad meshes were added to the rolling group, making the calipers
orbit with the tyres. All wheels also used an assumed 0.34 m rolling radius, while
the actual scaled tyre radius is about 0.432 m.

Approximate transformed AABBs reported a source bottom at -0.15930 m, whereas actual
vertices reach -0.00024 m. At the game's 4.9 m vehicle length, using that AABB to set
the origin introduced about 17.9 cm of empty space under the tyres. Runtime then
added 13 cm, producing roughly 31 cm of artificial lift above collision ground.

## Repair

- Build the car origin from precise world-space vertex bounds.
- Use the source wheel node as hub centre; neutralize its posed axle to X before
  placing source geometry beneath runtime steer and rolling groups.
- Keep BrakePad/caliper geometry under steer only. Rotors, rims and tyres roll.
- Derive each tyre's rolling radius from its actual hub-local vertices.
- Detailed cars use 4 cm clearance above collision ground for the raised rendered
  road surface. Unloaded fallback cars and bicycles retain their prior offsets
  and spin behavior. Existing body suspension roll/bob remains unchanged.

The normalized asset wheelbase is about 3.15 m, versus the existing 2.95 m handling
model. This repair does not retune steering physics or introduce Ackermann
steering; those remain separate handling refinements if native driving exposes
an issue. Parent should verify tyre-road contact on grades and front wheels
while driving straight and turning.

## Validation

Two actual-asset tests reconstruct committed primitive geometry and node
transforms through NodeIO without browser/image loading. They reproduce the
posed axle and incorrect AABB, then verify canonical tyre width, equal physical
radii, wheel ground contact through quarter/half/full revolutions, fixed caliper
positions during spin, and caliper movement during steering. Both asset tests
and 11 existing physics tests pass; TypeScript passes. Native rendering acceptance
was checked in the existing Codex game tab: a stopped side view on West Cordova
and a pedestrian-height view after forward steering, reverse and braking show
round front tyres aligned with their rear counterparts and contact at the road
surface. The native sequence moved from (410.23, -436.43) to (397.29, -456.07),
then reversed before exit. It reached a shopfront and stopped; this is a basic
movement/contact check, not a handling benchmark. Caliper behavior and full
rotation invariance are established by asset tests, not those still images.
All 186 tests and the production build passed at the wheel checkpoint. The saved
side-view evidence is `artifacts/local/car-wheel-contact.jpg`, with
`wheel-suite.txt`. The intended `car-wheel-pedestrian-contact.jpg` was saved after
a development reload and contains a loading screen; it is excluded as visual
evidence. The pedestrian view was observed in the browser before that reload.
Steep grades and suspension still require wider gameplay review.
