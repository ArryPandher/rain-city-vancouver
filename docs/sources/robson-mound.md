# Robson / Hornby planted mound

The ordinary gallery approach previously rendered this mapped woodland as a flat grass polygon. The new landform restores the conspicuous planted rise on the Hornby side of the Robson Square approach. It uses existing licensed turf/foliage textures; no reference photograph is a runtime texture.

## Evidence and registration

- [Canadian Society of Landscape Architects, Robson Square](https://www.csla-aapc.ca/mission-areas/robson-square) identifies Oberlander's mound at Robson/Hornby and describes it as almost eight metres above the plaza. Its mound photograph is credited to Stuart McCall/North Light; capture date and an open image licence are not supplied. Research copy: `artifacts/local/robson-realism-reference/csla-mound.png`.
- [The Cultural Landscape Foundation, Robson Square](https://www.tclf.org/robson-square) gives a twenty-five-foot mound and identifies pine, maple, photinia and rhododendron planting. Charles A. Birnbaum's 2019 photographs show mature, connected planting masses and open paths. Research copies include `tclf-robson-2019-060.jpg`, `tclf-066.jpg` and `tclf-078.jpg`. No open licence was established.
- The footprint is the existing twelve-vertex `forest` area in `public/data/vancouver.json`, transformed with the same `ORIGIN`, `KX` and scale as `loadCity`. It spans world x−142.951401..−109.451401,z54.37..101.87; grid U−166.04..−126.45,V−54.50..−14.55. Source-ring equality is tested. This is separate from the upper roof-garden building `w1384440657`; the latter gates regional activation.
- An Esri World Imagery export, saved with its request and exact returned EPSG:3857 extent, registers the ring against the gallery, Robson Street, the circular skylight and existing footway/stair traces. `garden-registration-review.jpg` shows the old planters behind the native baseline at U−193.79,V−12.19. Imagery capture date was not established; service imagery is licensed research material, not an open game asset. See `esri-garden-export.json` and `esri-garden-context.jpg`.

## Bounded interpretation

The 7.62 m crest converts TCLF's 25 ft and is consistent with CSLA's approximate 8 m. No contour survey was recovered. A smooth inverse-sixth-power blend of distances to the mapped boundary interprets the interior rise; it rounds the former hard medial ridges over roughly one to two metres. A 10 m blended-distance shoulder reaches the unchanged 7.62 m crest. The exact boundary retains zero height and slope. The broad lawn and four contained planting bands interpret the current aerial/photo composition. They do not claim surveyed shrub positions, species-accurate foliage or an exact 1978/2009 planting plan. Existing mapped trees retain their coordinates and dimensions and gain the same ground datum; no extra tree locations are invented.

`robsonMoundHeight` owns terrain, collision, road and vegetation support. The authored mound covers the old flat grass, whose −0.02 m surface remains below it. Mound-intersecting road ribbons use subdivision, edge heights and adaptive local fitting. The original two-metre ribbon missed a curved bend by 0.54 m; the fitted version passes a 2 cm interpolation bound. Understory remains at least 1.45 m beyond each mapped road's half-width; no new planter or wall collision is invented. The existing lower staircase, parallel V−22 route, pools, gallery stairs and gallery paths remain separate.

The mound's internal mapped `steps` still use continuous path grades; this pass does not claim a surveyed reconstruction of individual garden stairs or retaining walls. Final whole-view acceptance is recorded below; ordinary uphill/downhill walking and a vehicle traverse remain separate checks. The visible improvement is a landform and planted enclosure, not AAA asset parity.

## Validation

Focused tests cover exact source outline, bounded crest, grade-level perimeter, terrain ray height versus collision, mapped path interpolation, lower-route preservation and foliage/path clearance. On 2026-11-15, all nine tests in `robson-mound.test.ts` and `robson-square.test.ts` passed. The first candidate passed `tsc --noEmit`; the parent session owns the revised combined check. Terrain ray/collision error is bounded below 4.5 cm; path interpolation below 2 cm. The mound adds 6,072 terrain triangles and 4,840 foliage triangles (110 contained clusters) in two shared batches, plus local path refinement. Eight existing mapped trees receive terrain-supported roots from the same revised height function. These code checks do not establish native movement or performance acceptance.

## Native correction after the first candidate

The first whole-view candidate restored the missing landform, but its eight upright compound-leaf cards per shrub looked like sparse weeds. They were replaced with broad overlapping 2.4–2.7 m leaf volumes, roughly 0.7–1.2 m tall, reusing the existing CC0 Poly Haven broadleaf depth atlas (`public/textures/broadleaf/SOURCES.json`). Side and top leaf layers give the clumps volume; clump normals replace support-plane shading. The maximum 1.35 m canopy radius stays inside the retained 1.45 m path clearance, and every leaf-volume vertex follows the shared ground. The original shrub card material is removed. No new runtime texture or model was added. The smoothed field and low foliage are bounded interpretations; source photographs still show more varied mature planting and better-defined built edges.

## Final native whole-view review

Accepted on 2026-11-15 from `artifacts/local/robson-whole-scene-final.jpg`, compared with the closely matched `robson-whole-scene-before.jpg`, first candidate `robson-whole-scene-after.jpg` and CSLA mound reference. The final image restores the missing landscape enclosure, rounds the artificial shoulder and replaces conspicuous upright weed rows with broad low foliage masses. No new material defect is visible that requires another edit in this bounded pass.

The scene remains substantially sparser and less varied than the mature source planting. The sloping path ribbons also remain an approximation of the built garden routes; individual stairs and retained edges need separate source-grounded work. This accepts the ordinary whole-view correction only. Native walking, driving and quiet performance acceptance were still pending at this review; the image alone establishes none of them.
