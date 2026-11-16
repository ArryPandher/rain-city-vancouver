# Reflection refresh and vehicle contact

2026-11-15. Correctness work for ordinary third-person gameplay at the Canada Place/Howe scene. No new external assets, changed source licenses or visual-fidelity claim.

## Mixed-resolution reflections

The installed Three.js r182 `WebGLCubeUVMaps` refreshes a changed cube texture by passing its existing filtered output to `PMREMGenerator.fromCubemap`. The generator's reused-output path skips `_allocateTargets`, which also maintains its scratch atlas, LOD geometry and filter constants. After a 512-sized sky conversion, refreshed 128/256 local captures therefore use incompatible filter resources. The actual-generator trace demonstrated writes over the fresh sharp base atlas, including a negative viewport for a 128 capture.

A guarded r182 adapter synchronizes those resources before native filtering. Existing filtered outputs retain their identity and ownership. On a size switch the native allocator disposes its old scratch; the adapter disposes the unused, never-rendered output object produced by that allocation. Repeated filtering at the same size allocates nothing. The adapter restores render target, cube face, mip, XR and auto-clear state after a filtering exception. A failed supplied target can still contain partially rendered pixels; the exception propagates rather than publishing a successful version.

The adapter is installed once when scene reflections are constructed. An unsupported revision or prototype shape disables local captures with a diagnostic, leaving the sky environment available. Debug cube previews now appear above the long frame reports, so native screenshot inspection remains accessible.

This change does not fix the separate r182 automatic CubeUV cache disposal-listener gap for render-target textures. Raw capture validity also does not mean lazy material-time GPU filtering succeeded. Tests use the actual installed generator, geometries and shaders, with GPU submissions replaced by an atlas-write trace; native pixel comparison is required separately.

## Contact at the visible vehicle body

The previous player contact check used a 2.1-metre centre radius and only changed velocity above a speed threshold. It neither clamped the travelled pose nor separated an existing overlap. A recorded arrival left two cars only 1.362 metres apart after braking.

The replacement uses oriented footprints enclosing the committed normalized car models (4.9 by 2.86 metres, including protrusions) and the procedural bike (2.194 by 0.69 metres). Continuous translation and a conservatively refined rotation sweep stop at body contact at every speed. Tangential motion and reversing away are retained; inward velocity is removed. Recovery from a pre-existing overlap checks street geometry, grade, water, pedestrians and other vehicles. A trapped overlap is not teleported through a wall to clear it. This is kinematic contact, not soft-body damage or rigid-body crash simulation.

Tests cover the recorded overlap, slow forward/reverse motion, high-speed travel, side and angled contact, turning through an obstacle despite clear endpoints, narrow bike clearance, elevation separation and blocked recovery. Runtime integration remains within the existing player-vehicle collision phase.

## Native evidence

The public pre-fix build was checked at an identical player/camera pose before and after a day/night/day cycle: cool street reflections became yellow and lost their architectural detail, despite restored daylight and valid raw captures. Local evidence is in `artifacts/local/howe-pmrem-{before,after}-cycle*`.

The candidate's before/after player and camera profiles match exactly. The upper-window crop (x418/y32, 215 by 360 pixels) is pixel-identical after a complete weather cycle; the corresponding pre-fix comparison had mean absolute channel difference20.45 and RMSE39.53 on an eight-bit scale. The two builds used slightly different native camera poses, so these are within-build cycle comparisons, not a cross-build image-fidelity score. Raw cube preview and rendered windows were inspected; no recorded warning/error or reflection error appeared.

The native car approach stopped with5.083m centre separation,4.90014m along-heading separation and1.353m side offset. Holding forward at contact did not penetrate the4.9m envelope; reversing moved the car clear, then exit and pistol15→14 passed. The bike travelled10.09m and stopped beside the parked car. Seeded-overlap recovery, angular sweeps and different elevation levels have automated coverage, not a complete native crash matrix.

All620 tests and the production build pass. Evidence uses `howe-pmrem-fixed-{before,after}*`, `howe-pmrem-raw-capture-preview.png`, `howe-contact-*` and `howe-pmrem-contact-comparison.json` locally. Architecture, street-base relief, neighbouring facades, animation and rendering cost still need substantial work against the GTA 6 reference.
