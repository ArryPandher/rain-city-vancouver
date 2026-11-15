# Harbour Green tree draw submissions

2026-11-14, ordinary gameplay; no quality preset downgrade.

Parent Codex-browser profiles are in `artifacts/local/harbour-draw-profile-before.json`
and `harbour-draw-profile-after.json`. The second pose was about 1.3 m from the first,
so this is a comparable-view observation, not a pixel-identical benchmark.

| Recorded draw counter | Before | First distant pass |
|---|---:|---:|
| Total triangles |21,379,844|15,868,194|
| Beauty triangles |15,143,425|about 9.60 million|
| Total calls |2,728|3,131|
| Distant volume beauty triangles |4,409,626|about 448,000|

The first pass reduced distant geometry substantially but 96 m cells increased
calls. The second pass uses 192 m cells. High fallback detail is selected by centre
distance minus the full cell half-diagonal: far entry above 230 m, return below 190 m.
Thus a cell corner near the player cannot switch early just because its centre
is farther away. Cell changes preserve records, matrices, geometry and textures.

Distant crowns still use all 24 source depth planes, now one bounding quad per
plane (48 triangles versus 806 cropped triangles). Each 512 px atlas cell is one
isolated source tree slice. The test decodes the committed WebP: every newly
covered pixel has alpha<=4/255; the material cutoff is 0.18. Three's
alpha-to-coverage uses smoothstep(alphaTest,alphaTest+fwidth(alpha),alpha), so
values below cutoff still produce zero coverage. No RGB/normal/alpha textures
were changed. Filtering/mip transitions still require visual review.

Near leaf submissions remained 4,542,444 triangles in each of beauty and shadow.
Each full near crown alone has 727,601 leaf triangles. The second pass selects
full near geometry by projected crown size as well as the existing 27 m entry /
34 m exit distance cap. Within 10 m the full near model remains unconditional
(12 m while already near). Farther away, the upper 70% of tree height must occupy
more than 45% of the vertical view to enter near, or 38% to retain it. FOV changes
invalidate the selector. Total selected tree budgets and every source patch
remain unchanged; smaller-screen crowns use the existing 81,602-triangle medium
leaf geometry with byte-identical near trunk/branches.

Local inventory examples at player(-77.95,1.24,-803.97),62 degree vertical FOV:

| City record |Height|Horizontal distance|Approx projected crown fraction|
|---|---:|---:|---:|
|318732|10.7 m|17.34 m|0.359|
|318733|10.7 m|17.86 m|0.349|
|318775|16.8 m|19.88 m|0.492|
|318770|13.7 m|20.21 m|0.395|

These are local inventory calculations, not measured screen rectangles; runtime
also includes vertical distance to canopy extent. Source medium coverage evidence
(98.7–103.3% across nine earlier isolated comparisons), unchanged wood and retained
folded patches are documented in `docs/sources/street-trees.md`. That does not
prove a particular gameplay transition is imperceptible. Parent must inspect
close walking/turning, daytime/nighttime, and compare the next native profile.

Validation:17 targeted tree tests and TypeScript pass. Tests cover source bounds,
newly revealed alpha, finite geometry,192 m-cell conservatism, projected size/FOV,
close-distance and screen-size hysteresis, source wood identity and slot restore.
No new model/image assets, lighting/reflection settings or building materials.
