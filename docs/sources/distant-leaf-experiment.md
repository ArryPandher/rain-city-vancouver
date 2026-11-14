# Distant leaf experiment — not for release

The 2026-11-14 profiler isolated detailed trees and their shadows as the largest tested rendering cost. This branch explores a third source-derived mesh level from the committed near GLB, avoiding a new source download.

The two-triangle target / 0.35 relative-error experiment produces 67,582 leaf and 68,646 total triangles. It processes 31,557 connected patches in the near derivative (the original source's 30,250 leaves were split into some disconnected patches during prior simplification). It corrects 2,581 face windings and produces no degenerate triangles during generation. Attribution remains Poly Haven Tree Small 02, CC0.

**Rejected for runtime integration:** direct front/oblique comparison against the near and medium meshes showed visibly reduced canopy coverage and a collapsed wedge at the lower trunk. It must not replace any current runtime model. Preserve more leaf-mask coverage, reuse the validated woody geometry, and inspect comparable projected sizes before reconsidering a far mesh.

Evidence: ignored artifacts/local/267-tree-{candidate,medium,far}-{0,0.7}.png in the active build worktree. All three were rendered with the same lights, camera, materials and source orientation. Runtime remains at the published 75dbf7e with two detailed mesh levels plus the layered far canopy.
