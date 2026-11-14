# Street and park tree surface reconstruction

2026-11-14. Corrected the broadleaf model used for nearby City-inventory and mapped trees. This preserves tree positions, heights, crown-width profiles, calibrated lower stems and collision clearance; the source is a generic tree, not a scanned reconstruction of each Vancouver species.

## Source and diagnosed problem

[Poly Haven Tree Small 02](https://polyhaven.com/a/tree_small_02), CC0. Source metadata comes from `https://api.polyhaven.com/files/tree_small_02`; the 1K glTF and its included binary/JPEG maps are downloaded by `scripts/fetch-detailed-tree.mjs`. Source provenance is retained in `vancouver-street-tree.json` and `vancouver-street-tree-medium.json` beside this document. No new license restrictions or reference-image textures were introduced.

The old leaf reduction reconstructed texture-space convex hulls, capped each to eight points and removed every third leaf. A source/derivative geometry audit found **102,748 of 120,996 old leaf triangles** facing against their stored normals, plus **3,562 degenerate triangles**. Original source: **1,939,380 leaf triangles**, no opposed or degenerate faces, mean face/normal agreement 0.9806. The old hulls also inflated total leaf surface area from 27.81 to 31.21 square metres despite removing leaves. These figures describe model-space geometry, not physical tree measurements.

## Replacement

The near model simplifies each of the source's **30,250 connected leaf components** independently in 3D using meshoptimizer, retaining positions, normals and UVs. It corrects face direction and excludes zero-area faces. It has **727,601 leaf / 741,374 total triangles**, 34,724,676 bytes and 26.09 m² of leaf surface. It remains unchanged in this pass.

The medium model now derives from that committed near mesh. Its connected patches split into **31,557 groups** after near simplification: **27,813** become fitted two-triangle cards and **3,744** retain their original geometry. Affine UV-to-surface fitting preserves location and orientation; area compensation retains the source surface area. Poor fits, singular UV mappings and strongly folded patches retain their original triangles. No patch is dropped. The complete near-model trunk and branches are retained unchanged.

The original RGB leaf texture has no alpha channel. The build rasterizes **417 unique source UV triangles** into an embedded 1024² alpha mask. This restores the original leaf outline on the rectangular cards. A 0.18 cutoff, alpha-to-coverage and the matching depth-material cutoff retain distant mip coverage and leaf-shaped shadows. The previous 0.45 cutoff visibly lost leaves at distance. The medium model has **81,602 leaf / 95,375 total triangles**, **7,080,728 bytes**, compared with the previous 199,129 leaf / 206,013 total triangles and 12,049,320 bytes. File hashes and source input hash are recorded in the manifest and provenance JSON.

Nine isolated comparisons (three angles at three distances) gave weighted foreground coverage 98.7–103.3% of the near model, versus 87.7–93.4% for the previous medium mesh. This is an image-difference diagnostic, not a physical leaf-area measurement; silhouettes were also inspected. The original three-dimensional near leaves remain in close views.

Only large shared vertex/index buffers are reused across tree slots. Each tree has independent spatial bounds and a tiny stem-scale attribute, allowing offscreen trees to be culled. The existing total budgets remain 24 Balanced / 48 High / zero Performance. At most one third use the near mesh. Near selection enters within 27 m of the canopy and leaves beyond 34 m; all detailed selections remain within 140 m. Selection prioritizes canopies intersecting the camera view, accounts for camera elevation and updates after 3 m of movement or a small viewing rotation. Disabling detail restores every original mapped crown/trunk matrix. A failed tree model download now retains the mapped fallback and lets startup continue.

The leaf RGB, normal maps and material lighting response are retained; alpha-mask coverage is new. This pass does not add wind animation or species-specific scans. The game remains below AAA fidelity.

## Reproduce

```sh
node scripts/fetch-detailed-tree.mjs
node scripts/build-leaf-cards.mjs  # local-only; --medium on the fetch script is an alias
npm test
npm run build
```

Use `/scripts/inspect-street-tree.html` on the development server to inspect the candidate, medium or cached source under identical lighting through `treeInspect.show(name)`. The optional `previousMedium` comparison expects a local `artifacts/local/street-tree-medium-before-cards.glb`. The optional `before` comparison expects a locally archived `artifacts/local/street-tree-before.glb`; it is not distributed. Source-vs-candidate images and actual park close-ups were used for review. Tests check face/normal agreement, finite attributes, alpha-masked surface area, byte-identical woody geometry and transforms, color/depth cutoff agreement, budgets/hysteresis/elevation, shared-buffer isolation, per-tree culling and restoration. Native gameplay and live release checks are recorded in the project log.
