# Pan Pacific tower source transaction

The original Canada Place GLB contains 3,140 separable tower triangles. This module removes that complete generated tower, including its old roof and random glow, while preserving every earlier triangle and every source attribute. It does not register or construct the replacement tower.

Source: [Codriver Canada Place generator](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/geometry.js), CC-BY-4.0; geographic placement © OpenStreetMap contributors. Audited asset SHA-256: `1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe`.

| Material | Original tower triangles, inclusive | Tower vertex IDs | Triangles removed |
| --- | --- | --- | ---: |
| concrete | 1916–3717 | 4596–8367 | 1802 |
| glass | 960–1127 | 1920–2423 | 168 |
| trim | 17428–18065 | 33473–34748 | 638 |
| glow | 0–63 | 0–127 | 64 |
| roof | 0–467 | 0–298 | 468 |

Original offsets above are audit data, never offsets into a previously edited index buffer. The runtime identifies complete triples by their audited vertex ownership and checks the count and FNV of the entire ordered selection. The complete baked position fingerprint remains mandatory even after earlier cuts. PIER, source podium caps, west hotel junction, canopy, concourse, sails, end hall, steel and fabric remain outside this selection.

## Loader contract

1. Call `panPacificTowerCompatible(originalScene)` before any source edits. It requires exactly one of all five source primitives and their original counts, position fingerprints and full index fingerprints. Baking to Float32 preserves the actual normalized Int16 loader semantics.
2. Bake the original source geometries into local coordinates. Paving extraction must remain first. The existing west, canopy, hotel and Howe podium cuts can run before or after tower removal.
3. Prefer `replacePanPacificTowerSource(entries)` with every original baked primitive and its original material name. It prepares all five index replacements before changing any geometry, returning 3140 on success or zero without mutation. Unknown materials remain untouched. A missing, duplicate, altered or partially removed source primitive aborts the entire transaction. Keep newly authored geometry outside these source entries.
4. Add the replacement tower only after both checks succeed. Preserve the original source and skip the entire tower addition on failure. Do not retain the old crown or glow separately.

`replacePanPacificTowerFaces` is also available for an independently staged loader transaction; it is atomic only for one primitive. Empty roof/glow index buffers are intentional, with their original attribute arrays retained. Integration may omit those empty draw calls without modifying other source geometry.

## Validation

`tests/pan-pacific-tower-source.test.ts` loads the actual GLB through GLTFLoader and MeshoptDecoder. It checks exact removal of 3,140 triangles, every retained index in its original order, attribute data and identity, integer index width, repeated-call rejection, whole-scene guard failures, all-material rollback, and tower removal at every position among the four existing facade edits after paving extraction. Corrupted ordered tower triples after those cuts fail without mutation.

These tests establish source isolation and fallback behavior. Registered tower massing, podium contact and normal-gameplay visual acceptance require separate integration verification.
