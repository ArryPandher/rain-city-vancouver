# Second Narrows north bank surface roles

The rejected native views `artifacts/local/rail-north-bank-ground-native.png` and `rail-north-bank-side-native.png` show a huge white triangular facade under the north railway end. This was **the full vertical bank-end closure assigned to the untextured concrete role**, not failed soil texture loading. The coordinated geometry correction replaces that broad face with real sloping `ground` triangles and retains only the6m bearing cap as `concrete`. Merely putting a grass texture on the old vertical wall would not fix the problem.

This material-only change does not modify any positions, normals, UVs, indices, terrain heights, road contacts or geometry roles. The architect owns the bank-front shape and its finite support/navigation tests.

## Existing licensed finishes

- Ground retains the existing [Poly Haven Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) CC0 color and OpenGL normal maps, now including its matching roughness map. World-XZ metric UVs repeat every4m along those projected axes. The front earth incline therefore has a nondegenerate ground projection rather than a vertical wall's collapsed UVs. Surface distance across an incline naturally exceeds the horizontal projected repeat;4m is not a surveyed local vegetation patch size.
- The ground base color remains0xa5af98, normal scale0.4 and roughness multiplier1. No global lighting/tint adjustment or artificial dark crevice is added.
- Remaining bearing cap retains its0x96988c base color and0.94 roughness multiplier. Existing joint-free [Poly Haven Granite Tile](https://polyhaven.com/a/granite_tile) derived mineral normal/roughness maps provide restrained0.8m repeat detail at normal strength0.22. No tile-joint/color map is applied to the concrete, so it does not become a tiled wall.
- Existing ballast, timber and steel colors and geometry remain unchanged. There are still five material roles/draws before the normal World batching/culling pipeline. No new image payload, material role, light or probe.

These are generic licensed surface scans, not photogrammetry of this railway bank. Aerial/photo registration and the inferred bank layout remain documented in `second-narrows-rail-north-context.md`.

## Texture ownership and checks

`Materials.texture` already returns independent sampler wrappers sharing cached Sources. This factory now uses those wrappers directly instead of cloning and abandoning the first wrapper. Each material disposes its own map wrappers exactly once; sibling materials and later factories retain their shared loaded images. Per factory there are seven map requests across six unique URLs; repeated factories reuse Sources. These are ownership/request counts, not GPU-memory measurements.

Focused tests use the actual source-derived bank geometry and verify every input attribute and geometry reference is unchanged by the material factory; earth/map repeat and color spaces, retained cap hue, existing CC0 provenance, asynchronous image completion, independent repeat settings and exactly-once consumer disposal are checked. The actual corrected slope/contact/coastline validation belongs to the geometry candidate. Native acceptance should show a continuous grass/rock earth front, a narrow mineral cap beneath the track and unchanged open service-road clearance; this document does not claim that native acceptance occurred.
