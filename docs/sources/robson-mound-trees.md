# Robson mound structural broadleaf trees

The eight mapped mound trees previously used the ordinary generic street-tree pipeline. Their narrow upright forms did not provide the mature branching and canopy enclosure seen in the garden references. The scoped replacement keeps the eight existing root positions and inherited estimated top heights, adding lower physical forks and wider irregular crown groups. It does not invent extra trees or assign unsupported pine species.

## Position and botanical evidence

The [live OSM map extract](https://www.openstreetmap.org/api/0.6/map?bbox=-123.1221,49.2820,-123.1213,49.28265), checked 2026-11-15, resolves all eight quantized game positions to nodes **13778746316–13778746323**. Every node has `natural=tree`, `denotation=urban` and `leaf_type=broadleaved`; none has species, height or diameter tags. Live coordinates are 0.14–0.25 m from the retained game positions, consistent with the map's half-metre quantization. OSM data is © OpenStreetMap contributors, licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright). The 98 KB research extract is `artifacts/local/robson-realism-reference/osm-mound-map.xml`.

The existing [City public-tree inventory](https://opendata.vancouver.ca/explore/dataset/public-trees/) snapshot was fetched 2026-11-14, with source modification 2026-11-09. It contains **no tree at any of the eight mound sites**. Nearest City specimens are red maples along the street, 11.8–34.9 m away. Their species, heights and diameters are not transferable to the mound. Contains information licensed under the Open Government Licence – Vancouver. See `docs/sources/vancouver-public-trees.md` for coverage and record-age caveats.

| Label / OSM suffix | Retained world x,z | Crown width estimate |
| --- | --- | --- |
| T1 / 316 | −125.951401, 95.87 | 7.2 m |
| T2 / 317 | −119.451401, 85.37 | 6.5 m |
| T3 / 318 | −114.451401, 79.37 | 6.2 m |
| T4 / 319 | −128.951401, 74.87 | 7.4 m |
| T5 / 320 | −134.951401, 83.37 | 7.2 m |
| T6 / 321 | −129.951401, 67.37 | 6.8 m |
| T7 / 322 | −126.951401, 61.37 | 7.6 m |
| T8 / 323 | −121.951401, 66.37 | 8.5 m |

The audit with live coordinates, node tags, nearest City records and matching errors is `artifacts/local/robson-realism-reference/robson-mound-tree-audit.json`. `robson-mound-tree-registration.jpg` overlays the retained centres and estimated crown envelopes on the registered aerial derivative. The underlying Esri imagery is research-only licensed imagery; its capture date was not established. The dashed crown rings are conservative visual estimates within mixed canopy groups, not measured individual crown polygons. Branch structure, cultivar and DBH remain unresolved. Existing fallback top heights, approximately 5.7–11.0 m above local ground, are retained as estimates rather than promoted to measurements.

## Reference interpretation and asset limits

- [CSLA, Robson Square](https://www.csla-aapc.ca/mission-areas/robson-square): `csla-mound.png`, credited Stuart McCall / North Light, date unspecified. The photograph shows rounded lawn, broad connected evergreen shrub masses and lateral pine boughs. No open photograph licence established; research only.
- [TCLF, Robson Square](https://www.tclf.org/robson-square): Charles A. Birnbaum's 2019 `tclf-066.jpg` shows low forks and interlocking deciduous crowns mixed with pines; `tclf-078.jpg` shows nearby pine needles, broad leaves and dense evergreen understory at short garden stairs. The text names pine, maple, photinia and rhododendron planting. No open photograph licence established; research only.
- These photographs prove a mixed garden canopy but do not reliably tie a particular pine to one of the eight OSM points. The generic broadleaved tags may be incomplete; the replacement preserves the point-supported category and leaves exact pine registration for better evidence.
- Existing CC0 [Poly Haven Tree Small 02](https://polyhaven.com/a/tree_small_02) supplies the broadleaf colour/normal depth atlas and bark texture. Atlas provenance remains in `public/textures/broadleaf/SOURCES.json`; original model provenance is `docs/sources/vancouver-street-tree.json`. Branch geometry and canopy grouping are authored here, not scanned from Vancouver.
- Existing CC0 Fir Tree 01 near and medium models, twig textures and depth atlases were audited. Their tall fir form is not a site-specific mature pine, and the eight mapped points lack needle-leaf evidence. They were not added. No large downloads or new runtime texture/model files were needed.

## Implementation and integration

`src/world/robson-mound-trees.ts` exports `isRobsonMoundTree(x,z)` and `buildRobsonMoundTrees(parent, materials, profiles, heightSampler)`. The selector matches only the eight registered positions within 0.35 m. Call the builder with reconciled profiles after the ordinary water/building exclusions; remove those matching profiles from the standard tree/detailed-tree pipeline to avoid two overlapping trees. The returned Group contains two named Mesh children; they have bounds and `userData.center` for the normal world chunk path. Group profiling metadata records count, triangle total and OSM IDs. No per-frame update dependency is added.

Each tree has a closed tapered trunk, four main forks, secondary branches and twigs supporting seventeen overlapping canopy groups. The main crown uses detailed atlas crop strips; peripheral groups use bounded depth slices with a top view. A per-clump view selector avoids tripled opacity, while the existing normal atlas supplies leaf lighting. This changes connected structure and canopy spread rather than simply increasing random branch-card density. One bark material and one foliage material serve all eight trees; foliage shadows use the same alpha/view selection.

`heightSampler` supplies each root datum. Low wood stays within the existing trunk footprint; overhanging foliage keeps 2.25 m nominal headroom over the shared ground, drawing inward where uphill terrain would otherwise exceed the inherited tree top. The geometry does not add collision obstacles or change path support. Root integration owns generic-tree exclusion, scene activation and movement acceptance.

## Validation and remaining gap

On 2026-11-15, four focused tests in `tests/robson-mound-trees.test.ts` passed. They verify exact mapped selection and City-tree exclusion, unchanged profiles and tops, finite bounds, the real trunk ray intersection, terrain clearance and two-mesh integration. The eight replacements total **21,776 triangles**: 9,696 wood and 12,080 foliage. This is submitted geometry, not a measured frame-rate gain; fragment overdraw and shadow work still require native review. Combined checks and native visual/walking/driving acceptance remain with the parent session.

The result is a bounded mature broadleaf interpretation. Exact species, measured crown outlines, seasonal variation, individually scanned branching, wind and registered mature pines remain unresolved. No AAA parity or final native acceptance is claimed from source tests.
