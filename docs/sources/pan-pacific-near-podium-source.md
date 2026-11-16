# Pan Pacific near-return source transaction

The retained source HOTEL faces 31–35 produce the blank near podium wall and two simple blue ribbons beside the finished southeast podium. This guarded transaction removes only their 70 vertical triangles across the lower, .94 and .80 tiers. It preserves horizontal caps, source PIER/floor, adjacent faces, the finished southeast podium and tower.

Source: [Codriver Canada Place generator](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/geometry.js), CC-BY-4.0; geographic placement © OpenStreetMap contributors. GLB SHA-256: `1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe`.

| Tier/material | Original triangles, inclusive | Vertex IDs | Local height |
| --- | --- | --- | --- |
| lower concrete | 278–287 | 834–863 | 7.653739–14.802530 |
| .94 concrete | 1718–1727 | 4002–4031 | 14.648794–20.200424 |
| .80 concrete | 1890–1899 | 4518–4547 | 20.046688–25.495827 |
| .94 glass | 846–855 | 1692–1711 | 15.502890–18.996149 |
| .80 glass | 934–943 | 1868–1887 | 20.900784–24.300091 |
| .94 trim | 17314–17323 | 33245–33264 | 19.551311–20.097933 |
| .80 trim | 17402–17411 | 33421–33440 | 24.846712–25.401876 |

The row ranges are audit data, never offsets into already edited geometry. Each concrete row is ten ordered triples of consecutive vertex IDs. Glass and trim each use five ordered quads `[b,b+1,b+2,b,b+2,b+3]`, advancing the base by four. Runtime selection verifies every exact ordered triple and the full Float32-baked position fingerprint.

## Loader contract

Call `panPacificNearPodiumCompatible(originalScene)` before any source edits. It requires exactly one original concrete, glass and trim primitive, with audited counts and complete position/index fingerprints. Then bake the original scene into local geometry; paving extraction must remain first.

Prefer atomic `replacePanPacificNearPodiumSource(entries)`: all three source primitives are validated and their new indices prepared before any mutation. It returns 70 on success or zero without changing any geometry. Add the near-return assembly only after both checks succeed. Per-primitive `replacePanPacificNearPodiumFaces` returns 30 concrete or 20 glass/trim triangles and is intended only for an independently staged loader transaction. Newly authored geometry must remain outside these source entries.

The transaction commutes with the existing full tower, southeast podium, west hotel, canopy and west concourse cuts after paving extraction. It never substitutes a global material edit or removes a horizontal cap.

## Contact anchors and verification

Existing floor: local PIER top **7.798935890197754**, with the usual +0.08 world transform. The end joins HOTEL vertex 36; middle/upper points retain exact source insets around `(-132,69)` at .94/.80. Geometry must close both terminal junctions without adding another floor or altering public support.

`tests/pan-pacific-near-podium-source.test.ts` loads the actual GLB through GLTFLoader/MeshoptDecoder. It verifies exact removal, all untouched indices/attributes, every insertion among existing cuts, original-scene rejection, three-material rollback, missing/reversed/duplicate/reordered triples and repeated-call safety. These source tests do not establish contact or visual acceptance of the replacement geometry; those require the actual candidate.
