# Layered broadleaf canopies

The distant street/park trees derive from the same CC0 [Poly Haven Tree Small 02](https://polyhaven.com/a/tree_small_02) used for nearby trees. They replace the random large branch-texture planes with source-positioned foliage layers. The source remains a generic broadleaf tree, not an individual Vancouver tree or species scan. Public-tree positions, height and DBH records remain unchanged; crown widths are still interpreted by `tree-profile.ts`.

## Assets and geometry

The bake reads the committed near model `models/vancouver-street-tree.glb` (SHA256 `67a348ffd8b871d422a4102c0bbc818cd851cc6d7269923eae4f1b805c1bb093`). Only leaves are captured. Eight depth slabs in each of three perpendicular views, including the top, store unlit colour/alpha and model-space normals. Each atlas is 4096×1536. Transparent-edge RGB is corrected for multisample premultiplication, padded by eight texels and stored beneath alpha=1/255 pixels to survive WebP filtering. Runtime cutoff is 0.18.

The captured alpha bounds define horizontal strips so empty sky and the bare lower trunk do not require full-size transparent planes. The resulting leaf geometry has **806 triangles**. A view-dependent pixel choice selects one of the three projection stacks, avoiding compounded opacity. Stored normals respond to the game's actual lighting; fixed shadows or highlights are not baked into the colour map. Oblique views remain an approximation and can show stippling; the nearby full models retain actual leaf surfaces.

Trunks and branches use **1,234 triangles of real mesh geometry** nearby and **312 triangles** when the 350 m group centre is more than 600 m away, returning to fuller branches within 550 m. Both derive from the committed near model with meshoptimizer; a millimetre-scale vertical correction preserves the source root anchor after reduction. An initial experiment also sliced the woody geometry, but diagonal views broke up the trunk; that representation is not used. Lower-stem calibration is shared by the visible meshes and their shadow materials. The distant and close trees now use the same source origin, normalized height and width, rotation and tint. Source UVs/normals are retained where mesh reduction selects vertices; the small root correction translates positions vertically.

Atlas and branch hashes, byte sizes, license and transformations are recorded in `public/asset-manifest.json`; atlas provenance is also in `public/textures/broadleaf/SOURCES.json`. Runtime buffers are shared between chunks, with separate per-instance stem-scale attributes. Visibility bounds ignore hidden zero-scale instances so they do not inflate remote groups toward the world origin. A same-view diagnostic reduced submitted geometry by about 5.93 million triangles; frame-rate improvement was not established by that diagnostic. Failed asset loading retains the existing mapped crown fallback. Close-detail exit restores the saved layered leaves and branch matrices. Quality settings continue to control the more expensive close meshes.

## Rebuild and inspect

1. Run the Vite development server on port 5178.
2. Select the owned authoring tab with browser-harness, then execute `scripts/capture-broadleaf-volume.py` through the harness. This reuses that tab and writes temporary captures below `artifacts/local/broadleaf-volume/`.
3. Run `node scripts/assemble-broadleaf-volume.mjs` and `node scripts/build-broadleaf-branches.mjs`.
4. Open `/scripts/inspect-broadleaf-volume.html` through browser-harness. `farInspect.frame('source'|'volume', angle, elevation)` compares the two representations under the same lighting and camera.
5. Run `npm test` and `npm run build`, then inspect actual park views, native walking/driving and asset-failure fallback.

This change improves outdoor planting fidelity. It does not add interiors, species-specific scans, wind or a complete seamless LOD transition. AAA fidelity remains unfinished.
