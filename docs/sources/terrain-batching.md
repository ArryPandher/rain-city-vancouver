# Exact terrain-tile submission candidate

2026-11-15. Integrated and locally verified; publication is recorded in the project log. The Fairmont
public profile records 81 grass draws / 117,601 triangles and 63 forest-soil draws
/ 123,992 triangles in beauty. World.terrain adds terrainMeshes output directly,
while only the separate flat-polygon Batcher output enters static batching.
Terrain's forest/cliff/coastal shader callbacks also correctly exclude it from
the generic adapter. There is no runtime occlusion test: geometry behind opaque
buildings can remain inside the frustum and 2,900 m tile-centre distance policy.
This candidate consolidates submissions without guessing what buildings hide.

`batchTerrainTiles(root, ground, multiDraw)` is called after root.add(...ground)
and before any render, with sole ownership of generated tile buffers. It accepts
only named Stanley terrain meshes, indexed Float32 position/normal/UV layouts,
identity source transforms, no geometry groups/morph-like extra attributes,
standard opaque materials with the reviewed cliff/coastal cache-key suffix,
and default mesh callbacks. Other geometry (including cut walls) remains intact.
It groups by exact material identity; mismatched layer/order/receiveShadow groups
are skipped. No generic adapter eligibility is broadened.

The forest shader and cliff shader compute world positions from modelMatrix
and the source vertex; coastal cover consumes the cliff coordinate. Tile source
matrices and batch instance matrices are exactly identity, and both source and
batch inherit the same parent transform. Therefore those custom coordinates,
normal transforms and original material callbacks are preserved without shader
rewrites. Reflection cameras and shadow cameras use Three's independent
per-instance frustum evaluation. Existing World.chunks records still own each
tile's visibility/cast flags; hooks copy these before each pass. No distance,
terrain geometry, texture/material, receiver or caster policy changes.

Setup is staged: a failure preparing any later material batch disposes prepared
batches while leaving all original parents and source geometries intact. Root
may catch setup errors and retain that original path. With multiDraw=false it
returns immediately. Only after all batches succeed do sources detach and their
geometry references become cloned bounds-only records. Packed buffers stay for
context restoration; originals were never uploaded, so no shared external
geometry is disposed. Per-batch `userData.terrainBatchMemory` records source
count, historical released source bytes, current zero retained source bytes,
packed bytes and matrix/indirection texture bytes. These are separate from the
existing static-batch weak-map accounting; root may expose them separately.
No GPU/RAM-saving claim is made.

Focused actual committed Stanley elevation-grid tests generate 204 tiles /
523,252 triangles using the real forest/cliff/coastal callbacks. They verify
all packed position, UV and normal components, material identity, unchanged
bounds-only source records, exact frustum-submitted index totals, independent
shadow eligibility and beauty restoration. Original source buffer footprint
was 11,992,472 bytes; packed buffers 15,131,984 plus 17,284 texture bytes. Larger
packed indices cost more bytes, despite avoiding retained duplicate originals.
This single-material fixture is not the mixed full-city memory total. A second
test injects failure after the first material group is prepared and verifies
complete original-source preservation, as well as capability-off fallback.

At least the 63 forest-soil native draws share the dedicated material name;
subject to exact material identities the candidate can reduce these to one.
Most of the 81 grass draws belong to terrain, but flat base/area draws may remain.
Do not promise 144→2 without the native post-integration profile. Exact visible
triangles should stay unchanged at a matched pose/state. No FPS claim follows
from fewer draw calls. The former fallback-tree batch experiment remains off:
its controlled native on/off/on samples were 24.26/24.71/24.03 fps despite fewer
submissions, with an extra 20 MB tracked allocation. This terrain path neither
re-enables nor changes it, and does not change the 31 tree-part submissions.

The offline full World.terrain reproduction now applies the actual 2,900 m
centre limit and saved Fairmont view. It identifies **78 terrain grass draws /
117,254 triangles**, leaving 3 draws / 347 triangles of the native grass total
outside this terrain subset; soil reproduces **63 / 123,992 exactly**. Those
source tiles share one material identity per category. Expected narrowed native
result is therefore grass **81→4**, soil **63→1**, with both original material
triangle totals unchanged: **139 fewer beauty submissions** if runtime pose and
state match. Twelve full-world material batches are prepared, not just the two
visible categories. This is the offline expectation, not a native result.
Reproduction: ignored `artifacts/local/measure-fairmont-terrain.ts`, using actual
mapped data/elevation and World.terrain with texture transport stubbed; no full
scene constructor, browser or GPU benchmark.

## Native result

The exact saved hotel camera matched at player (489.133024, 5.193602,
−459.896598), yaw 4.369913, pitch −0.215, first-person mode. Native profiles
`terrain-native-before.json` and `terrain-native-after.json` confirm grass
**81→4 calls / 117,601 triangles**, soil **63→1 / 123,992 triangles**. Grass
shadow remains one call / three triangles, with no soil shadow in this view.
Thus 139 identified beauty submissions were removed with those material triangle
totals unchanged. Dynamic traffic/pedestrians differed; whole-frame totals and
FPS are not an isolated before/after result. Twenty-six reflection captures in
the subsequent integrated city completed without a reported reflection error.

Runtime accounting records 12 batches / 351 source tiles, 16,310,408 historical
source bytes released, zero retained original geometry bytes, 19,680,410 packed
geometry bytes and 30,056 matrix/indirection texture bytes. This adds about
3.4 MB of tracked allocation relative to original geometry; it is a submission
optimization, not a memory saving. Decoded textures and driver/process overhead
are not included. The render diagnostics expose this separately as
`terrainBatchMemory`, without changing static-batch accounting.

Ordinary walking at Prospect Point crossed from (−1656.45,64.17,−3179.76) to
(−1657.50,64.67,−3189.99), then the verge at (−1647.48,64.61,−3191.02).
Road/soil contact and surrounding terrain remained visible, with no captured
warnings/errors. Dense forest streaming subsequently showed roughly 16 fps and
24 million reported triangles; that remains a separate unresolved load, not
evidence of a terrain-batching FPS regression or acceptable smoothness.
