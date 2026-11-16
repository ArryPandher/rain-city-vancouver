# Ironworkers path boundary candidate

2026-11-16. Pure candidate following `1527380`; **not installed in the scene, support or collision**. Shared alignment `48f1e8f` and all road coordinates remain unchanged. Reference links and dimension provenance are in `ironworkers-path-fence-proposal.md`.

## Contract

`createIronworkersPathBoundary(deckHeight, approachHeight)` returns:

- `topTriangles`, `ties`: world-space supported finish geometry, including four curved approach ties and exact external source vertices.
- `members`: finite oriented boxes, with one transform/extent specification used by both rendering and physical collision.
- `supportAt(x,z)`: height on a rendered path triangle, otherwise undefined. The four source carriageways receive no new support.
- `blockedAt(x,z,r,y,camera,bodyHeight=1.8)`: exact sphere-to-box contact for camera calls. Actors use a vertical capsule touching the supplied feet height. The capsule is at least `2*r` tall; the optional bodyHeight must match the caller's desired proxy. Full car footprint checking stays in the existing vehicle system.
- `createRenderGroup(concrete,steel)`: independent group and cost statistics. Pass opaque concrete and galvanized steel materials. The group owns its generated geometry and the cloned double-sided far material; dispose these when the candidate is removed. No per-frame mesh generation.

`deckHeight` uses the original bridge grade parameter. `approachHeight(x,z)` must return the existing **rendered external path finish**, ordinarily baseline+.07 here. Do not pass a height lookup that already includes this candidate: that creates recursion. The interior path is deck+.12 (estimated rise), tapering to deck+.07 over each existing 6 m approach tie. The external ties interpolate into the supplied source finish. Rendering uses a nearby origin to retain submillimetre endpoint precision while support keeps the source coordinates.

The curb, rail and picket dimensions are explicit photographic estimates; the documented 2.5 m clear path width and 3 m outer-fence height are preserved. The outer pickets are galvanized flat sections, not chain-link. Roadside rail gaps remain physically open for cameras that fit. There is no continuous invisible roadside wall or below-deck fence volume.

## Approach registration

Each connector starts at the existing aligned path-end section and follows a sampled tangent-continuous curve. Shared miter sections keep at least 2.5 m perpendicular clear width through each turn. Source endpoints are checked directly against `vancouver-roads.json`.

| End | Exact external source vertex x,z | Way |
| --- | --- | --- |
| South/east |6825,−932.7|w503135269|
| South/west |6795.7,−937.9|w336869485|
| North/east |6784.6,−2308.2|w62125827|
| North/west |6751.5,−2307.4|w336868165|

The initially proposed south/east node `[6823.1,−942.6]` was too close for the required turn at full width: its inner strip folded. The candidate uses the next exact external vertex, creating a gentle approximately 13 m tie. The original node and all source data remain intact.

There are no cross-path end gates. Side members end at their actual finite boxes; all four entries pass player/bicycle-radius clearance checks. The ties are supported only inside their rendered footprints. No new water exemption, broad bridge footprint or vehicle steering is supplied.

Future integration must deliberately substitute the old inboard bridge-cycleway rendering for `w35260598` and `w62125826`, and clip existing approach finishes only where they overlap the new tie footprints. Review short inboard approach stubs, including w880719215, as part of that bounded substitution. This candidate does **not** edit, remove or automatically clip any source road. Its geometry should not simply be layered over existing finishes in a release build.

## Rendering cost and physical indexing

20,462 pickets are instanced in 21 chunks of at most 64 m. Each chunk has real box depth within 180 m and a double-sided flat picket representation farther away. Both keep the actual picket centres, widths, gaps and heights; no opaque fence sheet is used. The physical boxes remain unchanged by visual LOD. Curbs and other steel use two additional instanced batches, with one path mesh: **at most 24 draw calls**, before normal frustum culling.

There are 27,578 finite collision members and 2,278 supported top triangles. Four-metre spatial cells restrict collision/support queries to nearby candidates. Member AABBs reject distant boxes before exact distance work; reusable visitation stamps prevent duplicate member checks. Actor contact minimizes the piecewise-quadratic distance between its vertical capsule axis and the box. Camera contact uses the exact sphere/box distance, so empty space diagonally above the top is not blocked by a coarse vertical interval test.

The added candidate costs 160,126–191,826 triangles before frustum culling at five sampled on-bridge cameras (t=0,.25,.5,.75,1), including paths, curbs and rails. Three to six nearby picket chunks use full box geometry in those views; the others use two triangles per picket. This is a bounded rendering candidate, not a measured native performance acceptance. Root must inspect actual frame cost before release.

## Verification

Focused command: `npx tsx --test tests/ironworkers-path-boundary.test.ts` — five tests passed. The scoped TypeScript check of the module/test import closure passed (`--types node,vite/client`). The earlier project check passed; a later project-wide check encountered a concurrently written Granville test, so root will run the combined check after all owners commit.

- All 9,373 actual source carriageway strip vertices and 11,160 complete lane-car footprint corners exclude new support and boundary collision.
- All 2,278 path top triangles have upward winding and match analytic support; sampled actual mesh rays match the same heights. Interior finish edges and curb clearance are checked along both sides.
- All four external source vertices are preserved. Perpendicular path width stays at least 2.5 m at every connector section, and sampled bicycle footprints remain supported through the turns.
- Finite picket/rail contact, a small sphere fitting a real gap, ordinary chase spheres meeting adjacent pickets, high/under-deck clearance, diagonal top clearance and actor sweep samples pass.
- Render batches are bounded, far LOD selects correctly, and collision members do not change with LOD.
- Additional read-only audit found **no path-support overlap with any nearby source street-strip vertex**, including streets beyond the four named bridge carriageways. Reproduction and exact costs: `artifacts/local/ironworkers-path-candidate-audit.mts/.json`.

No browser, full build, full suite, push or shared runtime integration was performed. Root still needs source-finish substitution, placement of support lookup before plain bridge height, member collision before the elevated-bridge early return, and native driving/walking/camera acceptance. Other bridges are untouched.
