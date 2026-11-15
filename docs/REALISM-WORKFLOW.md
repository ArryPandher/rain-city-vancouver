# Realism work and ownership

Keep the active goal and integration in the main chat. Use three focused agents for independent architecture, material/art and performance work. Arry approved this arrangement on November 14, 2026; a separate full game session is not required. Longer independent features can use isolated branches, while small coordinated changes use explicit file ownership in the existing build worktree.

The active goal was updated by Arry on November 15, 2026: build jaw-dropping, browser-only Vancouver gameplay scenes using GTA 6 as the realism reference. Focus on Canada Place/Howe Street first, Robson Square with the Art Gallery second, and the Ironworkers Memorial Bridge third. Prioritize exceptional daylight architecture, materials, lighting, vehicles and animation during ordinary third-person walking, driving and shooting. Finish one or two standout scenes before expanding. Tests and shipped code do not establish visual parity.

The first scene is the complete playable Howe approach beside Canada Place, including the surrounding buildings visible while walking, driving and shooting. An isolated improved entrance is insufficient. The repeated heritage wall behind the current car comparison, vehicle reflections/finish, sparse street composition and frame pacing are still significant scene-wide defects. Earlier four-region references below describe historical scope; the current three-scene priority above governs new work.

Arry subsequently made the visual bar explicit in the active goal: the scenes should appear like an AAA game with high quality and fidelity. This remains an unachieved acceptance requirement, not a description of the current build.

## Responsibilities

- Architecture: use real Vancouver photographs, plans and sections to correct silhouette, proportions, connections and street depth. Separate measured/source-registered geometry from estimates. Preserve a coherent playable route.
- Materials and art: compare ordinary gameplay with the references; improve surface response, visible depth, scale and wear. Look for larger asset-quality gains rather than repeatedly polishing an inaccurate base form. Verify source rights before adding assets.
- Performance: attribute actual submissions and frame times; reduce wasted work while preserving the intended geometry, colors, spatial culling and animation. Check browser capabilities before relying on an optimization.
- Coordinator: resolve ownership, integrate the pieces, review them in the sole Codex game tab, test movement and relevant gameplay, publish recoverable checkpoints and maintain the project/board record.

## Review loop

1. Record the current scene and identify the most important visible mismatch against real Vancouver evidence.
2. Assign disjoint files or isolated branches. State the visual/behavioral result required, not merely a coding task.
3. Inspect the combined render at normal walking/driving height and in motion. Compare material response, silhouette and contact, not only the number of objects added.
4. Check relevant geometry/collision regressions and native render profiles. Keep simulation/viewport differences explicit in performance comparisons.
5. Ship only the verified checkpoint, retaining the full remaining realism scope and a concrete next action. Periodic fresh read-only critique can challenge accumulated assumptions without splitting ownership of the goal.

## Current parallel pass

The current pass corrects the west concourse against independently identified SACO and official Canada Place photographs. Two recessed opaque bays with large round openings interrupt the glazing and doors through their full height. CANADA and PLACE occupy separate fascia sections; original extruded lettering follows those wall planes. The collision recesses, lateral returns and upper guard follow the changed envelope. Exact metre boundaries and opening sizes remain photographic estimates.

The former 400 mm curved backing was an inaccurate spatial model for the open concourse in the Rayner section. It is replaced with a closed lining at the source envelope's floor, back, roof and ends, retaining 100 mm pane rebates. No furnished or accessible interior is added. Ordinary native views still determine visual acceptance; geometry tests alone do not.

A candidate on-site scan was excluded after checking its explicit NoAI restriction. No scan mesh was downloaded or shipped, and it is not an input to reconstruction. Independent architectural connection photographs and the existing Rayner/museum evidence require careful identification of roof connections versus ground supports before another anchor-shape revision. Reference photographs are not runtime textures.

Photographic-facade multi-draw is implemented with a capability gate and original-Mesh fallback. Native matched-view attribution verifies 196 to 5 beauty calls with the same 10,370 triangles; active close-range shadow draws are also observed. Exact-source wheel batching now verifies 24 to six calls in each beauty/shadow pass with the same 65,240 wheel triangles for the isolated concept car. Independent spin, steering, fixed calipers, per-wheel culling and tyre radius remain covered. These reductions do not establish a whole-city FPS gain.

The integrated camera fix separates above-rail camera air clearance from the whole-pier walking-support proxy, retaining physical obstacles and actor collision. Native gameplay now retains the full boom at the recorded collapsed-camera viewpoint. The next art priority is visible source-registered hall structure behind the glazing; the new volume alone still looks too uniform. Continue reference-based material calibration before expanding detail elsewhere, while retaining all four priority regions.


## Glass and central hall checkpoint

The next integrated pass uses ordered coloured-transmission and physical-reflection draws on three glass tiers, plus ten estimated inward curved frames and ties. Native front and both along-facade views show incremental depth improvement, while separate deeper columns and more varied visible structure remain necessary. Static architecture/street batching reduces matching material submissions without reducing their triangles; owned source-buffer release removes 328,620,606 redundant tracked CPU bytes. A 39.5 fps short local sample includes one 216.7 ms hitch and establishes no FPS gain. Keep the full four-region realism goal active. See [the optical checkpoint](CANADA-PLACE-OPTICS.md) for evidence and the concrete next task.


## Primary support and distance-detail checkpoint

Five estimated joined primary supports now extend the accepted single-support preview; final daylight glass roughness is0.12 following inspection of the existing raw reflection capture. Source-derived distant geometry applies only to non-AI concept cars, with nearby/driven cars and existing traffic fidelity preserved. The330-test suite, focused final checks and native gameplay pass. A short sample averages39.67fps but does not establish sustained smoothness or an FPS gain. Continue the full four-region goal with the same coordinator and specialists; see [the support checkpoint](CANADA-PLACE-SUPPORTS.md).
