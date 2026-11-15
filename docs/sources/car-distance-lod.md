# Source-derived distant concept cars

2026-11-15. This bounded pass applies only to non-AI concept cars. Existing AI cars retain their original traffic template and normalization. The currently driven vehicle remains at its existing near fidelity; physics, input, collision, vehicle visibility distance and road clearance are unchanged.

Source: the existing `car-traffic.glb` is derived from `car-concept.glb` by `scripts/optimize-car.mjs`, using meshoptimizer ratio 0.16 and error 0.003. No asset is downloaded or modified. Rendered template totals, after the existing component filtering, are **185,379 triangles near / 47,077 far**, a reduction of **138,302 triangles** per fully visible concept car. The two concept cars previously profiled at approximately 378 m and 418 m are eligible; actual submitted savings depend on visible components and native scene state.

Far mode begins beyond 240 m from the player and restores near mode at 200 m. The 40 m hysteresis prevents repeated switching. At a 670 px viewport and 62-degree vertical FOV, a 4.9 m car is approximately 14 px long at 200 m. These are deliberately conservative thresholds. The source simplification setting supports a small geometric-error expectation, but is not a proof of perceptual equivalence. No crossfade/shader changes are introduced; native approach/retreat inspection must check whether a visible transition remains.

A separate far template is built from the already-loaded traffic scene using the concept template's normalization matrix, canonical wheel centers and neutral axle orientations. The original independently normalized AI traffic template remains intact. Actual source tests measured a maximum normalization-matrix element difference of 0.000141382 before alignment. After alignment, the near/far outer bounding-box extremes differ by at most **0.0004946 m** and tyre-ground minima are identical. Bounding-box agreement is not a complete silhouette/image comparison.

The same near VehicleModel remains authoritative. A hidden far render group receives current wheel spin, steering, body lean/bob and headlight/brake state. Fixed calipers remain on steer-only carriers, with exact concept rolling-radius metadata. Each level uses the existing capability-gated wheel batching and unchanged unsupported fallback. Geometry/material resources are shared through templates and existing wheel packing caches; the extra far template and attached render objects add memory rather than claiming memory savings. The static generated-source buffer release is untouched.

Seven targeted actual-GLB LOD/wheel tests and TypeScript pass. Checks include exact near geometry retention, full-detail driven override, thresholds/hysteresis, aligned transforms/radii/contact, far state synchronization, 185,379/47,077 visible-triangle totals, and existing wheel camera/shadow tests. Main integration is unnecessary: Actors owns setup and level updates. Native A/B should compare the distant parked cars, near driving, steering and threshold transitions before claiming visual or FPS improvement.

## Native combined check

The combined candidate passed the driven approach, steering/braking/exit, a southbound promenade drive past the sail supports, and close broadside wheel inspection. Near rims and tyre contact remained visible with no observed level swap. In nearly matched central-front profiles, the earlier car paint/rim signatures identify two concept and four traffic-level cars, while the candidate identifies three traffic-level cars and no full-detail signature. Population and visibility differ, so whole-frame savings are not a controlled LOD benchmark. Source totals remain the valid per-complete-car comparison. A dedicated visible 200–240m threshold sweep remains unverified.

The increased candidate shadow count is unrelated to cars: neither profile contains car shadow material draws. Two extra male and three extra female characters account for 68 calls/196,775 triangles; the remaining one call/1,040 triangles exactly matches the five primary supports. Shared aligned-far CPU geometry adds 1,916,550 bytes plus 881,840 packed wheel bytes (2,798,390 total), excluding per-car objects/materials/instance data and GPU storage. Existing image textures are reused.

## 160/140 m trial — runtime adoption deferred

This scoped threshold-only trial enters the existing far level beyond 160 m and restores near at 140 m, replacing the earlier 240/200 m selection. There is no runtime trial state, setter, UI, new asset, geometry edit or memory allocation. Reversal is the two-number code diff/checkpoint. The driven override and all source wheel normalization, steering, spin, fixed calipers, lighting state and per-pass wheel culling remain unchanged. Existing AI traffic fidelity remains unchanged because this LOD attachment applies only to non-AI concept cars.

At the recorded 670 CSS-pixel height, pixel ratio 1.35 and FOV 62°, a 4.9 m car spans approximately 23.1 physical pixels at 160 m; a 0.7 m wheel spans 3.3 pixels. At the 140 m restoration threshold those values are about 26.3 and 3.8 pixels. These are conservative distance choices, not proof that every spoke/reflection transition is invisible. No geometry is simplified further. The existing source-mesh error setting and submillimetre bound agreement do not replace native silhouette inspection.

Useful native comparison pose: `terminal-city-public-profile.json` camera (343.1857, 1.69, -479.3412), yaw 6.4159131, pitch -0.60785, FOV 62°. Its top-object attribution shows fully submitted Rim1 batches at 135 m and 163 m in beauty, plus 107 m and 146 m in shadow. The near-matched `terminal-city-after-wide-profile.json` has beauty wheel batches at 136 m and 163 m. The 163 m concept car should qualify for the candidate; the closer car should remain near. Rounded object distances and dynamic population are not exact LOD-state proof. A vehicle already far in the hysteresis band can remain far until 140 m, so approach history matters.

Actual source Rim1 totals are 40,464 near / 12,241 far triangles across four wheels: a potential 28,223-triangle reduction for that fully visible Rim1 batch alone. Complete filtered templates remain 185,379 / 47,077 triangles, up to 138,302 fewer triangles per fully visible switched car per pass. Submitted savings depend on per-wheel/frustum visibility and must be read from the native profile. No FPS improvement is asserted.

Five focused actual-GLB LOD/wheel tests and TypeScript pass. The candidate tests explicitly cover 199 m far selection, retention through 150 m, restoration at 140 m, staying near while retreating through 150 m, re-entry at 161 m, and driven override at 400 m, with unchanged source geometry and wheel transformations. Native acceptance should compare the 163 m car, approach/retreat across both thresholds, and confirm driven wheels remain unchanged before deciding whether to adopt this trial.

### Cordova native trial evidence — not adopted

The saved `car-range-before-profile.json` and `car-range-after-profile.json`
were captured at cameras approximately 0.14 m apart with identical 62° FOV,
yaw and pitch. Rim1 beauty submissions changed from 7 calls / 113,910 triangles
to 4 calls / 48,964 triangles (64,946 fewer); Rim1 shadow submissions changed
from 6 / 89,367 to 4 / 48,964. The candidate's 48,964 equals four complete
traffic-level Rim1 totals of 12,241. These are aggregate material observations,
not matched-object proof: moving vehicle population, visibility and selection
history differ. They do not establish a causal frame-time improvement.

Beauty totals were 575 calls / 3,066,985 triangles before and 514 / 2,815,400
after, while shadow totals rose from 413 / 2,989,019 to 425 / 3,743,208.
The quiet 20-second samples recorded **27.604 fps before / 22.363 fps after**,
with p95 frame time **50.0 / 66.6 ms**, at Balanced/day, 723×670 CSS pixels,
pixel ratio 1.35. The candidate was slower in these observations. Population,
shadow workload and possible thermal state are uncontrolled; thermal influence
was not measured. Neither an FPS gain nor a threshold-caused regression can be
isolated from these runs.

Recommendation: retain this only as a candidate for the established lower
per-car triangle budget, conditional on a physical near/far transition check
showing acceptable body/wheel silhouette and no obvious pop at 160/140 m. The
unchanged source meshes and tests support budget/transform correctness, not
native perceptual acceptance. If that check fails, restore 240/200 m rather
than reduce wheel fidelity further. Do not label this a demonstrated speed
optimization or native-complete change; the dedicated transition check remains
pending.

### Checkpoint decision

The 160/140 m trial is **not adopted** in this checkpoint. Runtime and focused
regressions are restored to the HEAD baseline: far beyond **240 m**, near restored
at **200 m**. Only the trial threshold/comment and its test changes were reverted;
existing source-derived distant geometry, driven override and wheel corrections
remain. The scoped trial is preserved in the ignored local artifact
`artifacts/local/car-lod-160-140-trial.patch`.

The attempted native walk-back used a commandeered AI traffic car, which is not
eligible for the non-AI concept-car LOD attachment, so it does not validate this
trial's transition. The Cordova observations above remain useful evidence but
not a controlled comparison or compelling demonstrated FPS gain. Earlier
conditional-retention recommendations are superseded by this decision. Future
reconsideration requires an identified parked **non-AI concept car**, controlled
approach/retreat across both thresholds, near wheel/body inspection, and
comparable scene-state measurements. Accepted Robson architecture is independent
of this deferred performance trial.
