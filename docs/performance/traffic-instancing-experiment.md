# Traffic instancing experiment — 2026-11-14

This branch is an experiment, not a released performance improvement. The public game remains at 75dbf7e.

Repeated car parts share geometry, material programs and spatial draw batches while retaining original per-car tint, articulated wheel transforms, shadows and hit geometry. The occupied car renders separately so its lights/materials remain independently mutable. No source meshes, textures or animation were simplified. All 134 tests and the production build pass.

In a paused Harbour Green scene at 1440×900 Balanced, photo camera (-125, 20, -817), batching 14 cars reduced submissions from 2,766 to 2,526 with the same 22,537,408 triangles. Two four-second comparisons measured 19.63/19.97 fps disabled and 19.68/18.21 enabled. These short samples establish no frame-rate gain. Per-frame instance preparation and spatial groups offset the submission reduction; this approach should not be merged on draw counts alone.

A separate isolation run, with traffic batching disabled, measured 15.87 fps baseline, 19.33 with shadow updates frozen, 23.53 with nearby detailed trees replaced by existing mapped canopies, 17.13 without AO/bloom and 16.29 after restoration. Detailed trees accounted for about 12 million submitted triangles in this view. Temporary diagnostic switches were restored. Follow-up work should reduce distant leaf-surface cost while retaining close views, instead of adding unproven traffic complexity.

Evidence in the active build's ignored artifacts/local directory: vehicle-batch-comparison.json, 266-vehicle-batch-off.png, 266-vehicle-batch-on.png, render-cost-isolation.json, render-pass-profile.json, vehicle-instances-tests.txt and vehicle-instances-build.txt. The CPU profile identified WebGL matrix uploads; GPU per-pass timings appeared inconsistent and are diagnostic only.
