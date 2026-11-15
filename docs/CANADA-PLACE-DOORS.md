# Canada Place ground-door frontage

This checkpoint replaces the flat ground-glass ribbon with framed, recessed closed door bays along the 103.1 m west concourse. Ordinary daylight gameplay remains the review target. GTA VI and photographic realism are the benchmark, not an achieved quality claim.

## Architecture and materials

- 29 estimated bays contain paired door leaves, sidelights, transoms, pale 80 mm frames, gaskets, thresholds and mounted handles. A 400 mm closed backing well gives each pane physical depth. There are no playable interiors.
- The existing two-metre ground-door recess, source roof tiers, soffit and collision footprint are preserved. The facade now totals 47,468 triangles in six material batches, previously 29,336 triangles in three.
- Door glass shares the existing west-concourse reflection capture. Thin transparency, stronger grazing reflection and subtle edge roughness avoid a transmission render pass. Glass does not cast an opaque shadow after either batching stage.
- Five anchor bodies have smoothly rounded shoulders and stable material coordinates. The exact chamfered base footprints, stay endpoints, hardware, overall height and route remain unchanged. Anchors total 14,830 triangles in three batches.
- A 140 mm falloff around each exact anchor footprint attenuates indirect light by at most 38%. It uses baked source UV coordinates on the existing paving; it adds no geometry, texture or draw call and does not darken direct sunlight or the albedo. The reference photograph obscures the feet, so this is an authored contact-lighting approximation, not evidence of a dark pedestal.

The [door source note](sources/canada-place-door-frontage.md) and [anchor source note](sources/canada-place-ground-stays.md) distinguish historical evidence from estimated dimensions. Existing asset licensing remains unchanged; no reference photographs or Rockstar assets are shipped.

## Animated-character culling

Detailed characters previously submitted every mesh even when outside the camera and shadow frusta. Each mesh now owns a conservative animated bounding sphere. Geometry and materials remain shared as before; the bounds themselves are independent per mesh. Camera and shadow culling operate independently without camera-dependent visibility flags.

The actual male and female assets are checked across 576 poses including running, aiming, riding, fallen poses, translated roots, yaw and non-uniform scale. Every skinned vertex remains inside its local and world envelope; the widest sampled pose uses 70.24% of the radius. An actor outside the main camera can still cast a visible shadow.

## Validation

All 280 tests and the production build pass. Coverage includes actual source geometry, 331 deck-support rays, facade/body clearances, door depth/UV/batching/shadow behavior and animated bounds. Native local checks cover walking, first-person inspection, pistol aim/fire/holster, bicycle motion/dismount and car departure from (637.37, 7.88, -675.31) through the anchor corridor to (605.96, 7.88, -658.23). A parked test bicycle initially obstructed a different car check; that attempt is not counted as successful traversal. No captured browser warnings/errors occurred in the frontage gameplay check.

Quiet 20-second stationary samples used one Codex browser tab at 750×670, pixel ratio 1.35, Balanced/day. The before and after poses differ by under 2 cm and about 0.002 radians of yaw. Traffic and pedestrian state differs between loads, so these are observations, not an isolated performance attribution. The after samples precede the final narrow contact-lighting shader.

| View | Before fps | After fps | After p95 | Before frame calls / triangles | After frame calls / triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Harbour / north | 49.07 | 52.41 | 33.4 ms | 639 / 1,359,596 | 530 / 1,084,054 |
| City / south | 25.01 | 26.28 | 50.1 ms | 2,598 / 4,906,565 | 2,571 / 4,705,632 |

The city-facing view remains too slow for the target. This does not satisfy the sustained five-minute/1080p performance gate. No hardware ray tracing is claimed; lighting uses shadow maps, contact occlusion and reflection captures.

The final build, including anchor contact shading, passed a fresh native drive/exit and connected road-to-pier walk. Its harbour-facing 20-second sample averaged 53.66 fps, p95 33.3 ms, maximum 35.3 ms, with no frames over 50 ms; the sampled frame submitted 501 calls and 998,432 triangles. The final local script was `index-CgQucaRF.js`, with no captured warnings/errors. The city-facing final shader was not separately resampled.

Local evidence is saved under `artifacts/local/canada-doors-*`, including before/after quiet samples, render profiles, gameplay images and final test/build logs. Publication verification is recorded separately after deployment.

## Next action

Finish Canada Place before expanding the hero regions: compare the changing roof-tier heights and end junctions against the architectural section and real west-concourse views, then refine material response, weathering and source-registered permanent furnishings. The skyline, water, repeated materials and character animation remain visibly below the realism target. For city-facing performance, audit the three curtain-wall materials that differ only by tint; preserve spatial culling and appearance when reducing unnecessary batches. After this coherent small region, move to Robson Square/Art Gallery, Granville theatre blocks and one Stanley seawall stretch.
