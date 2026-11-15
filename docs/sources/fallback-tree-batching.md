# Exact fallback-tree instance visibility

**Experimental; not enabled in ordinary gameplay.** Activate only with both
`?debug&tree-batch-experiment` query flags. Normal startup does not construct
the adapter or allocate its additional tracked20.0MB. A same-session native
comparison did not demonstrate a frame-time gain, so reduced triangle counts
alone are not sufficient grounds to replace the original renderer.

## Same-session native comparison and release decision

In the sole Codex tab, ordinary controls reached player(470.77656,7.88,
-579.03503), first-person camera/FOV62, yaw approximately-0.652/pitch-0.15.
Balanced/day used723×670 at pixel ratio1.35. The diagnostics checkbox swapped
backends without moving the player or camera; ordinary geometry, daylight,
materials and settings were unchanged. Reflection/shadow refresh completed
before each quiet20-second sample, with the diagnostics collapsed and no
concurrent build or inspection. Population continued normally.

| Sequential sample | Mean FPS | p95 ms | Maximum ms |
|---|---:|---:|---:|
| Batch on1 |24.26|50.1|66.6|
| Original off1 |24.71|50.1|66.7|
| Batch on2 |24.03|50.1|68.1|

All samples were stationary, valid, and contained zero frames over100ms.
Actual profiling confirmed three tree dispatches per pass and63,240 shadow
triangles on the experimental path, versus15 shadow calls/335,528 triangles
and120 beauty calls/1,536,532 triangles on the original path. No new runtime
warnings or shader errors were captured after the production-callback fix.
These results show reduced submissions but **no demonstrated smoothness gain**.
The earlier27.50FPS snapshot was from a different run/population and cannot
establish the isolated effect. Do not advertise this experiment as a speedup.

The original InstancedMesh path therefore remains the release default, with
no adapter construction or incremental20.0MB allocation in normal gameplay.
The explicit experiment remains available for subsequent profiling/design work.
Evidence: local`canada-clarity-ab-{on-1,off-1,on-2}.json` and off-profile JSON.

This optimization uses the existing mapped/public-tree inventory, `World.vegetation`, licensed broadleaf source branch GLBs, and existing near/far foliage geometry. It adds no assets and changes no tree shape, material calibration, distance threshold, or collision.

`batchFallbackTrees(parent, samples, multiDraw)` runs immediately after broadleaf installation. With native multi-draw capability, it creates three material batches and detaches the original draw meshes. The originals remain canonical records in `World.chunks` and the detail manager: their visibility, caster eligibility, geometry choice, matrices, stem attributes and colors still control the replacement. Without capability, installation returns without changing the originals. Allocation failure is tested after one batch has been constructed; all staged resources are disposed before anything is added or detached.

Each distinct near/far vertex payload is copied once per material, not per tree. Material-group indices, positions, normals and UVs are preserved exactly. The retained tree index maps to a stable batch instance. The shader reads stem scale through Three's `getIndirectIndex(gl_DrawID)` table, the same indirection used for batch matrices and colors. It does not use `gl_InstanceID` or rewrite InstancedMesh attributes after their upload. Both ordinary and custom depth materials use the same stem texture and original shader callbacks.

Every pass applies existing cell visibility and light-caster flags before conservative per-tree bounds. Beauty, each reflection camera and the actual sun camera select independently. The union of undeformed geometry and scaled lower-stem bounds contains the complete stem deformation; this envelope is cached once per shared position attribute. All canonical matrices, colors, scales and bounds are populated during construction. Subsequent cell entry has no vertex scan or first-use instance-buffer preparation. Near-detail zero scales and canonical restoration are synchronized on attribute version changes. Three r182 does not invalidate cached multi-draw ranges when only a geometry ID changes; the adapter explicitly toggles public instance visibility before restoring its same-pass eligibility. An actual-map regression fails without that invalidation and checks the exact new index count and byte offset after an unchanged-camera LOD switch. Bounds use packed Float64 arrays instead of per-tree Box3 objects.

## Local evidence

The actual generated map fixture reproduces the saved `canada-entrance-final-profile.json` fallback totals exactly before batching: 1,536,532 beauty triangles and 335,528 shadow triangles. At the saved 723 × 670 camera, the conservative implementation submits **1,163,284 beauty triangles** and **63,240 shadow triangles**, reductions of **373,248** and **272,288** respectively. The initial exploratory tighter world-space padding estimated slightly larger exclusions; implementation keeps the existing normalized 0.08 allowance scaled with each tree.

There are three potential multi-draw dispatches per pass instead of 120 beauty and 15 shadow material calls in that native baseline. Native dispatch counts, shader compilation, visible detail and shadow appearance still require the parent's renderer comparison. These are not FPS or GPU-time claims.

Focused tests cover actual source payload equality, per-instance matrix/color/stem ID registration, full original-Mesh fallback, failure rollback, actual ShadowCasterVolume eligibility, valid off-camera casters, shadow-to-beauty restoration, transformed parent coordinates, near-detail hide/restore, near/far geometry switching, and deformed bounds. Two new tests plus eight related shadow/tree-projection tests passed; TypeScript passed.

A local Node run measured roughly 126 ms adapter construction, 13 ms first draw including diagnostic triangle counting, and 2.36 ms mean warmed beauty-plus-shadow callback work over ten pairs. These are illustrative CPU fixture timings, not browser frame timings; no WebGL context or GPU was involved.

## Memory and lifecycle

Full loaded fixture scope: 3 batches, 1,550 canonical source meshes. Unique backing buffers:

| Category | Bytes |
|---|---:|
| Retained original geometry and instance attributes | 7,983,040 |
| Packed replacement geometry | 206,648 |
| Batch matrix/color/indirection and stem textures | 11,773,528 |
| Packed CPU culling state | 8,022,928 |
| Total tracked | 27,986,144 |

Incremental tracked allocation over retained source buffers is 20,003,104 bytes. This is an optimization of submitted geometry and calls, **not a memory saving**. The original buffers are required for canonical detail restoration and are not duplicated per tree. JavaScript object overhead, canonical Matrix4 objects, driver allocation and image/material textures are excluded. `batch.userData.fallbackTreeMemory` shares one full-scope record; do not sum that same record once per batch. Existing static architecture/ground source-buffer release is unchanged. Disposing a batch frees only its own packed resources, cloned materials and stem texture; it does not dispose shared original geometry or image textures.

## Native shader correction

The first native trial exposed two volume-specific `instanceMatrix` references, used for view-slice weights and normal-atlas transformation, which the earlier stem-only fixture did not exercise. Adapter revision v2 replaces those injected references with the equivalent selected `batchingMatrix` after the original callback runs. Standard Three shader chunks remain untouched. The fixture now invokes the actual `loadBroadleafVolumeMaterials` assembly with real local branch-GLB geometry and only transport/image-loading stubs; it checks both normal-atlas beauty and dithered depth callbacks. Both focused tests and TypeScript pass with unchanged geometry counts and memory. Browser shader compilation and visual confirmation remain native acceptance checks.

## Controlled native backend comparison

Corrected native shaders rendered the near-matched heavy view with three tree beauty calls / 1,161,026 triangles and three shadow calls / 63,240 triangles. A separate quiet sample was 24.50 FPS versus the earlier 27.50 FPS sample, so reduced submissions are not evidence of faster gameplay. A same-run comparison is required before accepting the optimization.

`getFallbackTreeBatchController(World.root)` returns `{ enabled, setEnabled(boolean) }` after successful capability-gated installation; it is undefined for the original unsupported path. Disabling detaches every batch and reattaches the retained originals, preserving their current geometry, materials, matrices, visibility and shadow flags. Disabled batch callbacks immediately return. Re-enabling reverses attachment and synchronizes canonical changes made while disabled. No extra geometry or CPU buffer copies are created. The caller must invalidate cached shadows/reflections for the comparison, as the root debug UI does. Both representations remain allocated during this A/B experiment; GPU allocations after exercising both paths are outside the tracked CPU-byte figures above.

The actual-map test exercises repeated toggles, exact source parenting/state, original triangle totals, disabled callback inactivity and a canonical hide/restore while batching is off.
