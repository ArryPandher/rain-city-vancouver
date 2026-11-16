# Robson-facing gallery stair and landing correction

2026-11-16 UTC, checked against the current session clock. Local candidate; native review remains coordinator-owned.

## Evidence and limitation

The [official gallery exterior photograph](https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg), cached as `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg`, shows a long upper flight, a broad intermediate landing and a short lower flight. The inspected original image region is x180–854/y480–770; its enlarged crop is `gallery-stair-framing-source-crop.png`. Upper-flight step edges are visible roughly around y550–655, the broad break around y665–680, and the lower flight below. People, planters and perspective obscure several edges. Approximately18–22 upper and4–6 lower risers are consistent with what is visible; **24 total is an authored estimate, not a surveyed count**.

The [Rabich 2022 Robson-facing view](https://commons.wikimedia.org/wiki/File:Vancouver_(BC,_Canada),_Art_Gallery_--_2022_--_1923.jpg), cached as `rabich-gallery-2022-1923.jpg`, corroborates the two-flight arrangement and long terrace-side wall. The Georgia-facing GoToVan image is not used as evidence for this entrance. No image is a runtime texture or new licensed asset.

The inherited source had12 risers over4.2m of horizontal run: nominal266.7mm rises and350mm treads, approximately37.3°. Its front edge was v27.63. This compressed the staircase against the substantial terrace walls and gave the native frontage a steep slab appearance. The source remains the authority for the gallery frame, retained wall/cap boundary and upper landing elevation, but not for that compressed stair count.

## Shared replacement profile

The unchanged stair width is11.7m, source-local u−7.75..3.95. The upper datum remains3.2m local/3.28m world. The common ground is worldy0. A136.667mm rise divides the complete3.28m ground-to-landing height into24; the nominal stair slope is about22°.

The layout is a700mm upper landing,20 upper treads at340mm, a1m intermediate landing, and4 lower treads at360mm. The resulting foot lies at v33.37, versus27.63 previously. The intermediate landing is worldy0.546667. The last riser meets ground exactly; no zero-height final tread or duplicate ground cap is added. The approved on-foot arrival at v51.303 remains about18m beyond the stair foot.

`gallery-entry-stairs-data.ts` owns every surface interval and elevation. The visible shell, `galleryRearStepHeight`, existing mapped-path clipping, terrace extent and all stair rail feet use this shared schedule. There is no change to `World`, the general ground field, roads, camera controls or the map arrival. The existing gallery-ID contact gates remain. The upper terrace walls end at the intermediate landing, and the rails descend along both flights with a horizontal landing segment; additional supports keep their spacing bounded on the longer run.

## Source removal and cap attachment

The pinned source file/hash remain in `gallery-rear-entry-data.json`. Only144 original foundation triangles whose three vertex indices are all3819..4062 are removed through the existing source-count-guarded facade replacement. These are the old stair solid, including its buried back, bottom and side faces. Source positions are unchanged; column, pediment, facade, roof and original foundation cap triangles remain.

Decoded retained cap evidence is reproducible with `artifacts/local/gallery-stair-cap-audit.mts`. Its top is localy3.199517011642456. The relevant two boundary edges meet at u/v[0.412977129221,23.621566772461], extending to[−8.872893333435,23.819227218628] and[19.451900482178,23.180303573608]. The old rectangular stair start overlapped this cap by roughly0.1–0.37m.

The new upper landing and terrace coping follow those exact edges in plan. They do not cover the retained cap with a nearly coplanar new top. The landing body is one closed stair-shaped shell, split at the cap's corner with duplicate internal faces removed. Its new upper surface is0.483mm above the decoded source datum at the edge; support inside the retained cap uses the decoded height. This small source-quantization transition is explicit rather than a hidden overlapping slab.

## Verification and budget

Fourteen focused tests pass across stair geometry, source replacement, rear-entry translation, framing and mapped-path clipping. Checks include every tread/landing centre and both sides of every profile boundary, upward treads, outward risers and sides, underside closure, exact walking/render height agreement, source cap non-overlap and retention, all rail feet, and perpendicular approach ribbons with unchanged ground heights outside the cut. Full unchanged city data verifies ordinary ascent in80mm motion samples with no jump, clear central chase-camera boom, the unchanged closed gallery boundary and the approved map arrival.

Complete added gallery facade geometry is7,754 triangles in the same four material draws, versus6,678 before this pass.144 old source triangles are removed, so this pass's net rendered increase is932 triangles. Existing mineral and frame materials are reused. No browser, full build, full suite, source asset mutation or push was performed in this lane.

Native acceptance: arrive at Robson on foot, approach and climb the exposed central flight, inspect the intermediate landing and last ground riser, then move laterally to check the extended sidewalls, rail slope changes and foundation join. Use ordinary third-person controls. No completed native acceptance or surveyed reconstruction is claimed by the analytical checks.
