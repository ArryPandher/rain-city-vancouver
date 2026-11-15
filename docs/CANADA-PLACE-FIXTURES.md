# Canada Place west promenade

2026-11-15 checkpoint. Four original globe-light/banner fixtures and dry paving composition improve the approximately 60 m entrance-side walking/driving route. This is an incremental realism improvement; the surrounding frontage, materials, population and animation remain well below the GTA VI/AAA goal.

## Changes

- Four rail-side poles follow the actual source pier edge, with 20 m estimated spacing. Stepped bases, cranked stems, sockets, clear globes, internal unlit lamp elements and joined banner brackets use five shared instanced batches. Original antialiased waterfront artwork is readable on both sides. The row adds 12,384 triangles and 119,120 shared geometry bytes, plus matrices, materials and one 512×1024 texture. No lights or reflection captures are added.
- Fixture placement preserves the existing 3 m route and actual car centre/nose/tail clearance. Loaded capability gates finite pole collisions. The high seaward banner overhang adds no walking support. Collision encloses the pole, not the offset upper globe or cloth.
- The paving pattern now uses original metre UVs, preserving alignment when geometry is transformed and batched. A darker building-side strip, lighter divider and crossing bands follow the mapped west pier edge. Dry field/strip/band tint ratios and grain contrast are authored estimates checked in gameplay, not measured photo reflectance. Roughness, normals, route height and original deck triangles are preserved.

The [fixture model](sources/canada-place-promenade-fixtures.md), [placement](sources/canada-place-promenade-fixture-placement.md) and [paving](sources/canada-place-paving.md) notes document references, estimated dimensions and limitations. TourbyTransit and Brenco photographs are reference-only. Existing Codriver/OSM and CC0 material provenance is retained.

## Verification

The combined candidate passed the full 338-test suite before two final banner tests were restored/added. Final focused fixture tests passed (8), and the refined paving tests passed (9). Tests exercise actual model transforms, source deck support, the clear route, both banner faces, physical bracket joins, loaded collision gating, and paving UV registration after spatial batching. The production build passes. Exact final full-suite results are recorded by the publish workflow.

Native input in the sole Codex game tab reached the pier from the Canada Place road, walked along the row, reversed the Pacific GT north past all four fixtures and drove south again, braked to rest, exited, selected/aimed/fired the pistol (14/180). These checks passed before the final paving-only colour/grain refinement. The row was inspected near and from both walking directions; no obvious floating joints or route intrusion were seen. This is not an exhaustive collision sweep or sustained performance certification.

The final darker, lower-grain paving was separately reviewed at the entrance after reloading the production build and traversing the road-to-pier route again. Reverse driving, braking, exit, pistol fire (14/180) and holstering also passed on that final build, with an empty captured warning/error list. It retains the dry mineral appearance and gives the bands clearer separation. The nearby hotel conservatory still reads too flat; that larger gap is not resolved here.

Local evidence is under `artifacts/local/canada-fixtures-*`. Walking views toward the pier showed approximately 40 fps; the car view toward downtown was approximately 25 fps. Turning the stationary car camera back toward the pier reduced the frame to 407 calls / 1,846,197 triangles, versus the preceding walking profile's 372 / 1,480,693. This comparison retains similar view direction but not identical camera position, height or actor population, so it is not a controlled A/B. It confirms the approximately 1,100-call downtown-view increase cannot be attributed to one car. The already-batched car template has 16 body draws and six wheel draws per pass. Any further optimization needs a matched-view profile.

A final stationary 20-second car-view sample at 723×670, pixel ratio 1.35, Balanced/day averaged 37.85 fps: median 32.9 ms, p95 33.7 ms, p99 35.2 ms, maximum 233.4 ms and one frame over 100 ms. Start/end position and settings match. The isolated hitch remains unexplained; this does not establish sustained smoothness or 1080p performance. An earlier walking sample was interrupted before completion and is excluded. Static batch CPU accounting remains 104 batches / 9,105 records / zero retained source-buffer bytes; fixture instancing is outside that accounting scope.

## Next

Reconstruct a bounded photographed hotel-conservatory section with convincing glazing and visible structural depth; the existing long blue-green wall dominates the remaining visual gap. Improve local daylight shadow/contact depth alongside that geometry. Profile and reduce avoidable nearby-car draw/shadow cost while preserving its detailed wheels and silhouette. Keep Canada Place first, followed by Robson Square/Art Gallery, Granville Street and Stanley seawall. Browser-only ordinary gameplay remains the acceptance view.
