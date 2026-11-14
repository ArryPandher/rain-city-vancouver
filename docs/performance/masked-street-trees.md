# Medium street-tree leaves

The medium street-tree derivative now uses leaf-shaped alpha masks on fitted cards, with original geometry retained for difficult patches and the complete near-model wood unchanged. The previous medium mesh lost more canopy coverage while still rendering 206,013 triangles. The replacement has 95,375 triangles and downloads as 7,080,728 bytes instead of 12,049,320 bytes. See [source and reproduction notes](../sources/street-trees.md).

## Controlled comparison

Local Chrome, 1440×900, Balanced, Pacific daylight, Harbour Green. The comparison swaps only the medium tree geometry, material and depth material within the same game instance. Tree positions, selection budgets, near trees, camera, quality, shaders and shadow resolution stay fixed. Shadow reuse is forced off for every sample so the measurements include full shadow-map rendering. Each sample runs for four seconds after a two-second settling period, alternating previous/new/previous/new.

| View | Previous fps | New fps | Previous submitted triangles/frame | New submitted triangles/frame |
| --- | --- | --- | --- | --- |
| Fixed camera | 19.17, 18.85 | 20.88, 21.63 | 22.54 million | 17.67 million |
| Native walking route | 19.53, 19.53 | 20.39, 20.12 | 27.38, 28.35 million | 24.92, 24.69 million |

The walking runs start at the same position/heading, hold W for four seconds and cover 11.93–12.52 m. NPC/traffic state continues to evolve, and the walking endpoints vary with frame timing. This is a short local comparison, not a broad benchmark or an assertion of stable frame rate throughout Vancouver. The gain while walking is modest (~3.7% across these samples); near trees and other city rendering remain expensive.

The fixed view retained two near and 22 medium trees; the walking view retained eight near and 16 medium trees. Paired captures were visually reviewed, including leaf-shaped gaps, trunk continuity and canopy density. The source-model comparison covers three angles and three distances. Foreground image weight stayed at 98.7–103.3% of the near model; this is an image diagnostic, not a physical coverage measurement.

## Verification

Geometry tests require correctly directed, nondegenerate faces, unit normals, finite UV/position attributes, 24–29 m² of sampled alpha-masked leaf area, and byte-identical woody vertices, indices and node transforms against the near model. Runtime tests verify that both visible and shadow materials retain the 0.18 mask cutoff, and that quality changes restore the distant tree instances. Existing camera-distance hysteresis and budgets are unchanged.

Local evidence is in `artifacts/local/masked-tree-comparison.json`, `masked-tree-comparison-summary.json`, `leaf-card-coverage.json`, and `276-tree-*.png`. The full test suite, production build, native controls, day/night and released asset checks are recorded in the project log. This change does not achieve AAA fidelity.
