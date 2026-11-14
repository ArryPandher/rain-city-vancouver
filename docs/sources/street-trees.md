# Street and park tree surface reconstruction

2026-11-14. Corrected the broadleaf model used for nearby City-inventory and mapped trees. This preserves tree positions, heights, crown-width profiles, calibrated lower stems and collision clearance; the source is a generic tree, not a scanned reconstruction of each Vancouver species.

## Source and diagnosed problem

[Poly Haven Tree Small 02](https://polyhaven.com/a/tree_small_02), CC0. Source metadata comes from `https://api.polyhaven.com/files/tree_small_02`; the 1K glTF and its included binary/JPEG maps are downloaded by `scripts/fetch-detailed-tree.mjs`. Source provenance is retained in `vancouver-street-tree.json` and `vancouver-street-tree-medium.json` beside this document. No new license restrictions or reference-image textures were introduced.

The old leaf reduction reconstructed texture-space convex hulls, capped each to eight points and removed every third leaf. A source/derivative geometry audit found **102,748 of 120,996 old leaf triangles** facing against their stored normals, plus **3,562 degenerate triangles**. Original source: **1,939,380 leaf triangles**, no opposed or degenerate faces, mean face/normal agreement 0.9806. The old hulls also inflated total leaf surface area from 27.81 to 31.21 square metres despite removing leaves. These figures describe model-space geometry, not physical tree measurements.

## Replacement

Each of the **30,250 connected leaf components** is now simplified independently in 3D using meshoptimizer, retaining original positions, normals and UVs. The output corrects face direction against the retained normals and excludes zero-area faces. It does not reconstruct geometry from the texture boundary or drop leaves. Two levels share the same source composition:

- Near: **727,601 leaf / 741,374 total triangles**, 34,724,676-byte GLB; simplifier target 12 triangles per leaf, relative error limit 0.025, branch target 12%. The error limit often retains more than the requested triangle count. Leaf surface area is 26.09 m²; mean face/normal agreement 0.9487; opposed and degenerate face counts are zero.
- Medium: **199,129 leaf / 206,013 total triangles**, separate GLB; target six triangles per leaf, relative error limit 0.16, branch target 6%. Every leaf component remains, with coarser curvature appropriate to distance. File sizes/hashes are recorded in `public/asset-manifest.json`.

Only large shared vertex/index buffers are reused across tree slots. Each tree has independent spatial bounds and a tiny stem-scale attribute, allowing offscreen trees to be culled. The existing total budgets remain 24 Balanced / 48 High / zero Performance. At most one third use the near mesh. Near selection enters within 27 m of the canopy and leaves beyond 34 m; all detailed selections remain within 140 m. Selection prioritizes canopies intersecting the camera view, accounts for camera elevation and updates after 3 m of movement or a small viewing rotation. Disabling detail restores every original mapped crown/trunk matrix. A failed tree model download now retains the mapped fallback and lets startup continue.

The source material response is held constant for comparison. This repair addresses leaf geometry and spatial selection; it does not add wind animation, species-specific scans or a complete distant canopy system. The game remains below AAA fidelity.

## Reproduce

```sh
node scripts/fetch-detailed-tree.mjs
node scripts/fetch-detailed-tree.mjs --medium
npm test
npm run build
```

Use `/scripts/inspect-street-tree.html` on the development server to inspect the candidate, medium or cached source under identical lighting through `treeInspect.show(name)`. The optional `before` comparison expects a locally archived `artifacts/local/street-tree-before.glb`; it is not distributed. Source-vs-candidate images and actual park close-ups were used for review. Tests check face/normal agreement, finite attributes, area, budgets/hysteresis/elevation, shared-buffer isolation, per-tree culling and restoration. Native gameplay and live release checks are recorded in the project log.
