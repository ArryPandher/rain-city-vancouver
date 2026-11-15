# Robson routes and Fairmont Waterfront checkpoint

2026-11-15. Improve ordinary daylight gameplay at Robson Square and around Canada Place. This is a bounded reconstruction, substantially below the requested GTA VI/AAA realism target.

## Visible changes

- Replace the incorrect short brick fallback for **Fairmont Waterfront hotel, w363651936**, with its mapped curved body, stepped wings, recessed crown, pale panel grid, inset blue glazing and projecting Howe Street canopy. This is distinct from Waterfront Centre and Fairmont Pacific Rim. The main body is 64 m and the upper bound 69.44 m, synthesized from OSM parts and historical City roof data. Total: 32,275 triangles, seven shared material groups and one exterior reflection probe.
- Add real treads, landings and connecting footways on the three mapped Robson mound step traces. One disjoint surface definition controls both geometry and collision. Clip the former draped terrain/path surfaces; leave microscopic Float32 cut slivers out of adaptive subdivision. The stairs add 2,928 triangles in one concrete batch.
- Recontour the lawn around the paths. The former forced 7.62 m contour produced two conical peaks in the first gameplay review. The final broad soil target is capped at an estimated 4.6 m; the highest path remains 4.2 m. The source descriptions do not resolve the game's upper-ground datum. This is a photo-informed estimate, not a surveyed elevation.
- Replace exactly eight mapped broadleaved fallback trees with connected wood and fuller branched crowns, using existing CC0 bark/foliage assets. Source positions and inherited tree heights remain; canopy widths are estimates and species are unresolved. Total: 21,776 triangles in two meshes. These source trees are excluded from the ordinary fallback/detail pool to prevent duplicates.
- Cull only detailed street-tree shadow parts whose conservative projected bounds cannot reach the gameplay view. The policy is scoped around the final render and restores authored casting flags before reflection captures and after exceptions. It does not reduce tree geometry or disable every off-camera shadow.

Source and rights records: [hotel](sources/fairmont-waterfront.md), [stairs and soil](sources/robson-mound-circulation.md), [trees](sources/robson-mound-trees.md), [shadow policy](sources/tree-shadow-receivers.md), and [reusable exterior asset review](sources/exterior-asset-options.md). Reference photographs are research only, not distributed textures. No paid assets were acquired.

The final combined local suite passed all **457 tests**, TypeScript checking and the production build. Tests cover source geometry, surface/collision agreement, canopy clearance, exact replacement-tree membership and shadow-policy restoration.

## Native gameplay evidence

All interaction used the existing single Codex browser tab. No photo-mode view or hidden-state teleport was used. Settings were Balanced/daylight, 723 × 670 CSS pixels, pixel ratio 1.35.

The main stair route reached successive heights 0, 0.83, 3.50, 3.85 and 4.20 m, then followed the loop through 3.40 and 2.96 m to grade. All centreline junctions remained walkable. After the final soil correction, walking again reached the upper path at approximately (−119.51, 4.20, 76.73). Matched whole and upper-path images show the two peaks removed, stairs meeting the bank, and rooted foliage without visible terrain tears. Independent visual review accepts this bounded correction.

At the hotel, matched before/after views expose the wrong brick fallback and its source-informed replacement. Walking reached beneath the new canopy at approximately (478.58, 4.44, −456.26). A Pacific GT drove from (486.64, 4.68, −453.34) to (504.21, 6.74, −474.31), braked to zero and exited successfully. A subsequent ordinary view at (511.38, 6.91, −475.67) exposed the curved body and crown. The western stepped wing was not fully visible in these captures. Pistol, carbine and shotgun firing left 14/28/7 rounds in their magazines. Captured browser warnings/errors were empty; the final Robson profile recorded 25 reflection captures and no reflection error.

Local evidence lives under `artifacts/local/robson-circulation-*` and `artifacts/local/fairmont-waterfront-*`, including route waypoints, exact frame samples, render profiles and screenshots. The tested production bundle is `index-DHa6NrBZ.js`. Release/CI/public verification are recorded separately in the project log.

## Performance and remaining work

In the near-matched Robson view, the detailed street-tree policy retained 42 of 72 eligible mesh parts. Leaf shadow submission decreased from 24 draws / 1,958,448 triangles in the earlier release profile to 14 draws / 1,142,428 triangles. Camera and dynamic object selection differed slightly; this is evidence of reduced leaf shadow work, **not** controlled overall FPS improvement.

The final quiet 20-second sample contained 411 frames: **20.55 fps**, median 50 ms, p95/p99 66.7 ms, maximum 68.4 ms, 110 frames over 50 ms and none over 100 ms. The earlier release sample was 23.34 fps. Different dynamic load and laptop conditions prevent attributing that difference to a single change; smoothness remains inadequate. Startup also stalled browser controls during concurrent local test execution before completing without recorded errors.

The hotel's broad uniform reflections, simplified room grid and heavy opaque canopy underside remain less convincing than the real glazed structure. Robson needs denser, better varied planting and less angular ground transitions. PwC/Granville Square and other generic surrounding buildings, animation, crowd routing and sustained performance remain major gaps. The four-scene goal stays active; this checkpoint does not establish GTA V or GTA VI parity.
