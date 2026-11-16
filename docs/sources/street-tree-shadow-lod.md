# Near street-tree shadow representation

2026-11-16. Bounded candidate reusing existing CC0 source tree assets. It changes only the geometry representation submitted during gameplay shadow-map rendering; it does not change tree counts, positions, beauty LOD selection, visible leaf density, near-view geometry, material appearance or animation timing.

## Source and measured baseline

`artifacts/local/robson-crossing-corrected-profile.json` records727,601 near-leaf triangles in each of beauty and shadow. The already-authored medium mesh uses81,602 leaf triangles and retains every connected leaf patch through fitted masked cards plus original patches. Its trunk/branches are byte-identical to the near source. Provenance and earlier coverage comparisons are in `docs/sources/street-trees.md` and the two `vancouver-street-tree*.json` manifests; no new asset, texture or license is introduced.

For that one-near-tree frame, using medium only in shadow predicts645,999 fewer shadow triangles (17.27% of shadow work and7.37% of total frame triangles). It is a submission-count estimate, not a GPU-time or visual-acceptance claim. Beauty still submits the original near mesh.

## Scope and integration

`DetailedTrees.withShadowReceivers(camera, sun, draw, renderer?)` accepts an optional fourth renderer argument. Without it, existing behavior is unchanged. The coordinator adds `this.renderer` at the existing final-gameplay call; this lane does not edit main/world. Reflection captures outside that scope retain their original representation.

For each visible near slot, parts are matched to the existing medium level by source material name. Both levels already share the same normalized source origin, calibrated stem values and per-instance/group transform. No new transforms or buffers are built. Receiver rejection uses the selected medium part's actual local sphere without changing beauty bounds.

`StreetTreeShadowLOD` wraps native `renderer.shadowMap.render` only for the synchronous draw scope. Inside each matching-camera invocation it binds the existing medium geometry, material, depth/distance material, before/after-shadow callbacks and bounds to the **same target mesh object**. It preserves object identity, visibility, cast/receive policy, instance matrices and colors. Therefore an outer static/dynamic shadow pass's cast flags are honored. Medium's own UV/mask pairing and alpha-cutoff restoration are used; replacing geometry alone would sample the wrong atlas. Existing live shader/uniform references and callbacks are retained rather than cloned or frozen.

The previous bindings are restored in a `finally` block immediately after each native shadow invocation, before the beauty render continues. Multiple light passes and repeated shadow-map invocations use the same scoped choice. Nested non-gameplay cameras temporarily see the original representation, then restore their calling shadow pass; nested scopes and thrown shadow/beauty calls restore the renderer hook and object bindings exactly. The optional diagnostic state counts wrapper invocations and mesh parts in its last applicable pass, not GPU draw calls.

## Verification and native acceptance

24 focused checks pass: four new scoped representation tests, seven existing projection/LOD policy tests, seven receiver-policy tests and six targeted source/slot/camera tests. They cover medium geometry/material/depth/distance/mask binding, live shader-state references, multiple lights, repeated passes, original beauty geometry/indices/instance state, outer noncaster policy, nested reflection/scope restoration, thrown draws, medium receiver bounds, actual DetailedTrees normalization/scale/stem integration, unchanged source woody geometry and stable camera/FOV selection. Scoped TypeScript compilation passes.

The root's next native comparison must retain the same ordinary Robson camera and inspect leaf/branch shadows on the pavement and tree bases, plus a close canopy and camera turn. Confirm the near mesh still appears in beauty at727,601 leaf triangles while its shadow draw is81,602, with no extra proxy beauty draw. The existing medium approximation can change small shadow outlines; analytical state tests do not establish that this visual tradeoff is imperceptible.
