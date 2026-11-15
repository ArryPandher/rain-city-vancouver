# Character oral-shadow eligibility — negative audit

No runtime shadow policy, character geometry, material, or debug controller was changed. The proposed exclusion was rejected after source inspection; the distant-shadow variant was also stopped because its conservatively eligible range is too narrow to justify this pass.

## Actual sources and enclosure limits

Both committed rigs (`rain-city-protagonist.glb`, `rain-city-pedestrian.glb`) contain separate Teeth meshes with 7,120 triangles and Tongue meshes with 448 triangles. Cornea has 980 triangles and a source transparent material at opacity 0.08; its exterior contribution was not proven redundant and it remains unchanged. The supported runtime selects idle/walk/run, procedural aim/cycling and actor-root falling. Source clips include head rotation but no jaw track. Absence of jaw animation is not proof of enclosure.

A CPU audit loaded the actual GLBs, evaluated their skinned vertices and cast forward (+Z) rays through the opaque Skin mesh. Some tooth and tongue vertices escape through the mouth: male 26/4 and female 54/5 respectively. Including retained Teeth as tongue occluders covers all 253 male tongue vertices in that direction, but one female tongue vertex still escapes. Additional cardinal direction checks did not establish a complete enclosure proof. These rays do not prove a visible exterior shadow difference, but they refute a blanket assertion that the oral components are fully enclosed. Outer silhouette coverage alone would not prove unchanged mouth self-shadowing. No name-only castShadow exclusion was adopted.

## Conservative subpixel threshold

The inspected native viewport was 723 × 670 at physical pixel ratio 1.35, vertical FOV 62°. Vertical focal scale is 752.6704 physical pixels. Current daylight's shadow-elongation allowance is 1 / abs(sunDirection.y) = 2.110126. A sphere-conservative oral bound must satisfy `diameter × focalScale × elongation / distance < 1 physical pixel`; nearest-bound depth and hysteresis would make the threshold slightly more conservative still.

Measured full oral world AABB diagonals after the actual character factory's normalization (bind pose, not an exhaustive pose envelope):

| Rig / variant | Teeth diameter / 1-pixel distance | Tongue diameter / 1-pixel distance |
|---|---:|---:|
| Protagonist / 0 | 0.113558 m / 180.36 m | 0.090708 m / 144.07 m |
| Male NPC / 1 | 0.108919 m / 172.99 m | 0.086926 m / 138.06 m |
| Male NPC / 4 | 0.117413 m / 186.48 m | 0.093460 m / 148.44 m |
| Female NPC / 3 | 0.112645 m / 178.91 m | 0.092397 m / 146.75 m |

These are measured samples, not a guarantee for every normalized variant/animated pose. They refine the earlier rough ~195/157 m estimate. The NPC group visibility cutoff is 190 m. Thus teeth would qualify only at its far edge, while tongue's entire observed eleven-caster contribution is only 4,928 shadow triangles. A safe implementation would additionally need tight head-relative bounds and a per-render update/controller, instead of the current whole-character conservative bound. No meaningful savings were established to warrant that complexity.

## Profile context and next candidate

`artifacts/local/waterfront-centre-after-city-profile.json` records 965 beauty calls / 3,524,756 triangles and 351 shadow calls / 1,759,244 triangles. Teeth/tongue/cornea together account for 33 shadow calls / 94,028 triangles, but most of that total is the unproven teeth exclusion. These are submissions, not GPU timings.

A larger bounded next investigation is the existing **non-AI concept-car distance LOD**, owned by `src/world/car-lod.ts`, with integration/state in `src/world/detailed-car.ts` and `src/game/actors.ts`. The current 240 m entry / 200 m return threshold leaves a profiled concept car at 199 m on the full source: Paint 1 alone contributes 38,303 beauty triangles and three visible Rim1 parts contribute 30,348. The 86 m car should remain near; the 142 m shadow caster also need not change under a conservative 160/140 m trial. AI traffic already uses its existing lower-detail source and should not be upgraded.

Investigate a reversible 160/140 m threshold or equivalent physical projected-size criterion, using the same existing `car-traffic.glb`, canonical normalization, wheel centers, steering/spin and fixed calipers. At 160 m, a 4.9 m car spans about 23 physical pixels in this viewport, and a 0.7 m wheel about 3.3 pixels. Existing complete template totals are 185,379 near / 47,077 far: up to **138,302 triangles per fully visible switched car per pass**. Actual savings at the 199 m vehicle are lower if components are already outside the frustum; no exact scene-wide reduction or FPS gain is asserted. Existing bounding-extreme difference <0.000495 m is encouraging but not a complete silhouette proof. Native same-run threshold A/B must inspect wheels and transitions, keep the driven/near vehicle full detail, and measure frame time before accepting it. No car or tree changes were made here.
