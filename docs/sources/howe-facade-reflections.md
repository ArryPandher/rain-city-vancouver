# 325 Howe: independent street-facade reflections

The saved real views and ordinary gameplay comparisons remain the acceptance reference. Source photographs are listed in `cordova-street-frontages.md`; they are not shipped as reflection images. The 325 geometry and its photographed proportions are unchanged in this pass.

## Implementation

Previously both the short Cordova front and long Howe front used one 256px static cube near the street corner at `[431.2, datum + 10.8, -398.8]`. Facade normals already selected different reflection directions; this was not a direction-math defect. A shared capture origin still placed surrounding buildings incorrectly, particularly toward the middle of the longer Howe front.

Each facade now owns one dielectric material and one 256px capture, 1.2m outside its midpoint. The short facade keeps the original receiver slot; the long facade uses a separately constructed material with the same dielectric shader. The normal-incidence response, effective IOR2.3, roughness0.045, sheet throughput0.8 and day/night environment intensity0.8/0.75 are unchanged. Stone, window recesses, pane normals, UVs, building datums, roads and daylight settings are unchanged.

This is still a fixed-point environment approximation. It does not provide per-pane or camera-dependent parallax, reflected dynamic traffic, or ray tracing. The earlier unaccepted 512 experiment is not repeated. One extra 256px capture adds approximately10MiB of logical cube/mip/filtered color targets, plus depth and driver overhead; this is not a measured process-memory figure. Existing dirty-only refresh behavior applies.

Geometry remains15,760 triangles, with9→10 material groups. Eighteen focused geometry/integration tests cover independent receiver ownership, every pane's face and recess, matching shader response, exterior clear capture origins and unchanged entrance/ground contact. An accidental extra Object.entries argument in a test was removed; five integration tests and the production TypeScript/build subsequently pass.

## Native comparison

The baseline is the published9dd678b build at the saved corner camera. `artifacts/local/howe-receiver-baseline-profile.json`, `howe-receiver-baseline-corner.png` and `howe-receiver-baseline-raw.png` preserve its gameplay view and raw existing cube. The diagnostic cube view uses ACES/sRGB display mapping without PMREM, bloom or final grading, so it is not a final-frame pixel match.

The same corner and outer-sidewalk cameras were compared in ordinary gameplay, and both new raw cubes were inspected. The long facade now receives more coherent sky, foliage and building-edge reflections; this is a modest improvement, not a match to the much richer real-view reflected architecture. The corner improvement is weaker. Final combined-build walking, driving/braking, car exit and pistol15→14 passed with no recorded browser warnings/errors. Close tree detail activates on approach and restores on returning to the saved sidewalk. Evidence is in `artifacts/local/howe-final-sidewalk.png`, `howe-final-near.png`, their profile JSON files and the two `howe-receiver-candidate-*-raw.png` captures. See `../performance/cordova-street-tree-lod-trial.md` for the controlled leaf-submission comparison.

## Startup evidence

Visible debug timing records distinguish construction stages, downtown geometry/packing, each capture's synchronous call, shader initialization and shader-readiness waiting. Normal loading messages remain plain language. Timing is wall-clock evidence and includes asset waits/yields; it is not GPU timing. Yields occur only at complete-stage boundaries. Direct World generators remain synchronous, and shader warmup still uses the original HDR target and restores it in finally. No speculative compiler replacement is included.

The final local startup completed in40.5145s: world geometry was ready at32.1923s, the first reflection update took5.9726s synchronously, shader initialization0.1457s and shader-readiness wait0.1221s. Each reflection update selects at most one dirty nearby probe. These stages do not isolate shader driver work inside the first cube render. A prior successful candidate startup took61.487s; changing machine load and cache state prevent attributing that entire difference to the removed duplicate CollisionWorld construction. No stalled reload was reproduced in these successful measurements, and its cause remains unproven. The constructor-created collision index is now retained through World.build;44 collision/walking/Howe/apron checks passed.
