# Robson street grid clipping broad phase

## Measured problem

The full-data constructor profile at69b3179 attributed5,777ms to createRobsonStreetEdgeSite, mostly repeated polygon intersection against its0.8m triangular sampling grid. The existing algorithm scanned each polygon's rectangular bounds, including many empty cells around long diagonal street ribbons. Actual baseline-height callbacks consumed less than1% of sampled Robson CPU time; they were not replaced or approximated.

## Change and exactness contract

`robsonGridCandidates` builds a conservative index of square cells touched by every outer/hole ring edge. It clips each edge against grid-column slabs, marks every touched row interval, and expands boundaries by8nanometres at the0.8m grid size. This tolerance only admits extra candidates; it never moves a polygon vertex or emitted geometry.

A boundary cell always retains the original pair of triangle intersections. In a cell with no boundary edge, polygon membership is constant, so its centre determines whether it is wholly outside or inside a hole. Only those provably empty cells are skipped. Every retained cell still uses the original polygon-clipping calls, shape triangulation, Float32 rounding, sliver rejection, surface order and grid iteration order. No sample spacing, mask, tree opening, ramp, curb or contact function changes.

The only factory hook creates one candidate predicate per mask polygon and checks it before constructing the two grid triangles. The index is local to the factory iteration and adds no retained runtime world state.

## Full real-data equivalence and timing

An unchanged pre-optimization copy of the owning factory was compared with the candidate against the exact full-loader data:36,418buildings,30,063roads,2,354areas,45,600public trees and terrain. Both used the same actual CollisionWorld.baselineGroundHeight provider. The whole constructor was initialized once; then the old/new/new/old factories were timed in that order:

| Run | Factory wall time |
|---|---:|
| Old1 |6,084ms|
| New1 |2,785ms|
| New2 |2,754ms|
| Old2 |8,050ms|

These are bounded Node wall timings, not browser parity or FPS claims. Background load/JIT/GC can affect the variation. A separate combined constructor profile by the other optimization agent measured Robsonapproximately2,700ms versus its earlier5,777ms, independently consistent with this change; Canada broadphase savings belong to that other change.

Exact equality was verified for:

-8,051ordered Float32 top triangles and910side faces;
-all masks, coverage, trees, road/protected plans and bounds;
-every emitted position, normal and UV buffer for all four surface roles;
-height lookup at all8,051triangle centroids.

Combined site SHA-256: `4baf55249ec897063698d4ca248d588db772b58efc295b0fd0ef57325d5c71f5`.

Local reproducible probe and full buffer hashes: `artifacts/local/collision-performance/robson-grid-equivalence.ts` / `.json`; baseline copy `robson-before.ts`. The probe uses the actual full-loader copied from the live data loader and resolves public bytes locally. It does not omit eastern data or terrain and does not use a flat height provider.

## Regressions and limits

Two focused helper tests compare unfiltered triangle boolean output/order across long diagonal, concave, holed, closed, thin and negative-coordinate polygons, including exact boundary retention. Existing five street-edge tests and the actual World.roads crossing-contact test pass, preserving source roads, wells/mound exclusions, retained trees, Float32 support rays and road contact. Scoped strict TypeScript passes.

An initial synthetic exact-diagonal reference fixture encountered polygon-clipping's existing floating collinearity ring error before the new helper was involved. That fixture was offset from exact diagonal coincidence; independent exact-axis/corner retention cases remain. The runtime clipping library/tolerances were not changed, and the actual full-source before/after comparison completed without such an error.

No full build, browser, material, world integration or unrelated collision change was performed by this pass. Root owns the next native constructor timing and visual regression check.
