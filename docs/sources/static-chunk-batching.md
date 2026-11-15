# Static chunk multi-draw: scope and costs

2026-11-15. This extends the existing photographic-facade submission approach to eligible architecture and street-detail chunks only. Roads, terrain, actor/tree detail and Canada Place geometry generation are unchanged. The existing renderer capability gate is reused; without WEBGL_multi_draw, source meshes remain attached and unchanged.

The helper accepts ordinary Mesh objects with a shared opaque standard/physical material, default shader and render/shadow callbacks, indexed full-range static geometry and no morph/instance attributes or custom depth/distance material. Batches remain separated by exact material identity, attribute layout, detail class, receive-shadow policy, layers and render order. Custom or incompatible objects remain on the original path. No cell sizes increase.

Detached source meshes remain in World.chunks. World updates their original distance visibility and shadow eligibility; before each camera/reflection or shadow pass, the batch copies the corresponding flags and Three performs independent instance frustum tests. This is the same retained-record lifecycle as photographic batching. Original geometry/material references remain alive with those records. Batch geometry is separately allocated and copies the source vertex/index data; it is not shared with or substituted for the retained source CPU arrays.

For the deterministic three-cell fixture, measured unique backing-buffer storage is **2,256 bytes of retained source geometry plus 2,256 bytes of packed geometry**, with another **272 bytes of matrix/indirection texture data**. Object records, bounds, sorting arrays and other engine overhead are additional. These numbers describe the small fixture, not the full city. Combined batches can require 32-bit indices even when source chunks used 16-bit indices, so packed index storage need not equal source storage.

At current World integration points, conversion happens immediately after geometry generation and before its first render. The detached originals therefore do not acquire new GPU buffers from rendering; the packed geometry does. Existing material textures are reused. GPU driver allocation and full-city CPU/GPU bytes have not been measured. If the helper were later applied to already-rendered meshes, their previously uploaded resources would also need explicit lifecycle handling. Neither this adapter nor photographic batching disposes retained source geometry; both currently have World/session lifetime. A future World teardown must account for attached batches as well as detached records. No memory-saving claim is made.

Three's BatchedMesh copies interleaved attributes component by component into packed attributes. The layout check preserves component count, normalized state and typed-array type; differing interleaving strides are safe because the copied values remain identical. With a single material, Three renders the full geometry draw range regardless of geometry groups. The adapter preserves that behavior; material arrays and partial draw ranges are excluded.

Current proof: seven focused static-batch regressions cover exact attributes/topology, interleaved values, single-material groups, retained-buffer costs, unsupported fallback, excluded callbacks/policies, alternating camera/reflection/shadow views, visibility restoration and profiler callback handling. TypeScript passes. Existing photographic tests also passed in the implementation pass. Native call savings, GPU timings and full-city memory remain separate measurements; no FPS improvement is asserted here.

## Native matched-view evidence

Subsequent native profiles: `artifacts/local/canada-solid-public-profile.json` (released baseline) and `artifacts/local/canada-optics-structure-profile.json` (static batching plus a separate 148-triangle hall preview). Camera positions differ by approximately 0.12 m; yaw/pitch differ by less than 0.001 rad, with the same 62-degree FOV. UUIDs change between loads, so these four dominant anonymous groups are matched by their unique beauty triangle totals in both full material arrays:

| Baseline material UUID prefix | Candidate UUID prefix | Unchanged triangles | Beauty calls |
| --- | --- | ---: | ---: |
| cff23e5b | 5ba10773 | 13,748 | 76 → 6 |
| 65d1f1e8 | 9c3dc500 | 36,308 | 71 → 1 |
| 9961c678 | 6d0c4cb5 | 24,816 | 71 → 1 |
| 366d827a | 5e1fbbf3 | 8,603 | 67 → 1 |

Together these groups retain exactly **83,475 submitted triangles** while reducing **285 → 9 beauty calls** (276 fewer). This identifies matching anonymous submission groups, not their precise material constructors; the saved profile does not provide that semantic mapping. The 13,748-triangle group retains an active shadow row of one call / 248 triangles in both captures. The unchanged concrete-pavement group remains at 60 calls / 53,095 triangles, consistent with the narrower scope.

Whole-frame beauty submissions fall from 1,185 to 750 calls (435 fewer). Beauty triangles change from 1,767,797 to 1,767,161, a difference of -636; that full-scene difference cannot be called exact geometry preservation because the pose and hall preview differ. Shadow totals rise from 65 calls / 453,417 triangles to 66 / 453,565: exactly the separate hall preview's one call / 148 triangles. Existing named shadow groups, and anonymous shadow groups matched by their unique triangle totals, retain their prior counts. This is useful shadow evidence at this view, but does not exercise every batch at every shadow distance or camera angle.

The native evidence demonstrates reduced draw submission for matching geometry groups. It does not establish an FPS gain, GPU memory saving, or separate reflection-pass performance. Exact vertex/layout and multi-camera eligibility guarantees remain supported by the targeted tests described above.

## Owned generated-buffer release

The native RGB profile (`artifacts/local/canada-optics-rgb-profile.json`) subsequently measured 104 batches / 9,105 source chunks: 328,620,606 retained source bytes, 355,804,572 packed bytes and 706,216 matrix/indirection texture bytes, totaling 685,131,394 tracked bytes. This exposed substantial duplicate CPU storage in the default preserving path described above.

World's immediate architecture and street-detail hooks now explicitly opt into `releaseOwnedPreRenderGeometry`. This option requires sole ownership of newly generated source buffers and invocation before any rendering. After exact packing, the detached source mesh receives a bounds-only BufferGeometry with cloned bounding box/sphere. The original vertex/index references are dropped, including the diagnostic source-buffer Set. No shared external geometry is disposed. The default helper path continues preserving source geometry; unsupported capability and ineligible objects never release it.

World.update and reflection capture use these detached records for center, visibility and shadow flags, not drawing/raycasting. Their existing Frustum predicates remain valid through retained bounds. Packed geometry remains fully populated for rendering and WebGL context restoration. Historical `releasedOwnedSourceGeometryBytes` is reported separately from current retained bytes; it is not included in the retained total and does not prove immediate operating-system RAM reclamation.

Native verification checklist for a fresh load:

1. Request a profile and verify `staticBatchMemory.retainedSourceGeometryBytes === 0` for the registered owned batches. Inspect batch/source count and historical released bytes.
2. With the same static inventory, expect packed bytes and texture bytes to remain 355,804,572 and 706,216; tracked retained total should become 356,510,788, with 328,620,606 historical released bytes. If the inventory changes, compare the scope/counts rather than assuming these exact values.
3. Confirm material draw/triangle totals and foreground geometry remain consistent, with active shadow and reflection views intact. Check unsupported capability separately through the tested original-Mesh path.
4. Treat this as dropped CPU references eligible for garbage collection. Do not infer GPU savings or total process RAM from these counters.

Fourteen targeted static/photo tests and TypeScript passed after this change, including owned release, exact packed data, bounds-only Frustum checks, reflection-style flag changes and untouched unsupported/ineligible fallback.

## Verified native release result

`artifacts/local/canada-optics-final-profile.json` confirms the owned-release path in the native renderer: **104 batches / 9,105 source records**, **328,620,606 historical released bytes**, **0 retained source-geometry bytes**, **355,804,572 packed bytes**, and **706,216 matrix/indirection texture bytes**. The current tracked total is **356,510,788 bytes**, down from the earlier 685,131,394 tracked bytes for the same batch/source inventory. This verifies removal of duplicate source-buffer references within the reported scope; it does not measure immediate process-RAM reclamation or GPU allocation.

The four dominant anonymous material groups remain uniquely matched by exact beauty triangle totals after source records become bounds-only:

| Final UUID prefix | Triangles | Final beauty calls | Original baseline calls |
| --- | ---: | ---: | ---: |
| f00517d6 | 13,748 | 6 | 76 |
| 30b3f4b1 | 36,308 | 1 | 71 |
| ceadcb31 | 24,816 | 1 | 71 |
| 63d53f60 | 8,603 | 1 | 67 |

Thus the same **83,475 triangles / 9 calls** remain submitted, compared with **285 calls** in the original baseline. Releasing source buffers did not remove submitted geometry from these matched groups. The final camera is slightly displaced and other scene content changed; final whole-frame counts are not an isolated causal comparison. No FPS improvement is attributed to this change.

## Ground-cell integration and native result — 2026-11-15

`World.terrain()` and `World.roads()` now pass their immediate `Batcher.finish(false)` results through the same capability-gated adapter with owned pre-render buffer release. The original source records stay in `World.chunks` for distance/shadow policy. Material identity, cell size, attributes, indices, UVs, bounds, custom-shader exclusion, shadow eligibility and unsupported fallback are unchanged. The diagnostic scope now explicitly includes ground batches.

`tests/ground-static-batching.test.ts` invokes the actual World generators with mapped inputs and CollisionWorld, stubbing only browser texture/canvas setup. The road fixture preserves all attributes/indices across302 of303 source chunks packed into5 batches (11,252 triangles;634,072 source bytes released); terrain packs43 of71 into1 batch (1,607 triangles;65,290 bytes released). Tests exercise per-cell beauty/frustum/source visibility, no introduced ground shadow draws, bounds retention, no retained source buffers, and the complete unsupported fallback. These fixture totals are not runtime FPS predictions.

The final native comparison uses the same FOV62, pitch approximately−0.5145, yaw0.503, and player positions within0.09m at the west hotel frontage. Asphalt beauty draws fall32→2 with exactly10,976 triangles; concrete61→7 with exactly89,622 triangles. That is84 identified calls removed from these two labels. Concrete shadows remain2calls/37,597triangles, and asphalt has no shadow draws. Final whole-frame881calls/3,040,162triangles versus baseline1,059calls/3,122,366 includes different dynamic populations and the separate glass change; no full-frame reduction or FPS improvement is attributed solely to batching.

The expanded diagnostic scope reports112 batches/10,999 source records,365,339,778 historical released source bytes, zero retained source bytes,397,160,874 packed bytes and848,552 matrix/indirection bytes, total398,009,426. Previously unbatched ground geometry was outside the old reported scope, so comparison with356,510,788 is not a measured process-RAM gain or regression. GPU driver allocation remains unmeasured.

Final native driving/braking/exit and the connected street-to-pier walk preserve visible ground and movement support. A stationary20.0001s sample averaged37.85fps, median32.1ms, p9535.1ms, p9935.3ms, max50.0ms, zero frames over50/100ms. Diagnostic panel collapsed with no inspection during sampling;723×670, pixel ratio1.35, Balanced/day. This short sample does not establish sustained or1080p smoothness. Captured warning/error list was empty. Evidence: `artifacts/local/canada-ground-glass-before-profile.json`, `canada-ground-glass-final-profile.json`, `canada-ground-glass-final-sample.json` and route screenshots.
