# Vancouver Art Gallery: west planted terrace edge

## Evidence and scope

The Gallery's official 2023 exterior photograph shows five narrow columnar conifers rising from a continuous low hedge/planter at the west side of the Robson entrance. Below the planted edge is a deep fascia, separate supports, and a recessed glazed lower/service frontage. A solid wall across the complete front would erase that characteristic void.

- Official reference: https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg
- Retained reference: `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg` (854×854).
- Detail: `artifacts/local/gallery-west-planting-reference.png`, cropped from x45/y290/w235/h310 and enlarged for inspection. The five crowns are separately visible; the rightmost is tallest.
- Prior native baseline: `artifacts/local/gallery-terrace-corrected-arrival.png`.

The reference is used to interpret architecture, not shipped as a texture. No image-reuse licence is asserted. All new meshes are original geometry. Tree species, metric heights, precise plant positions and service-bay dimensions are **photographic estimates**, not survey measurements. The construction deliberately names these columnar conifers rather than asserting a species.

The bounded addition comprises five crowns, their continuous hedge/planter, the edge fascia, four finite piers, and a recessed closed glazed service front. Existing mapped broadleaf trees, Gallery walls/roof, stairs, main portico, eastern bistro, roads and terrain remain separately owned and unchanged. This does not create a navigable service interior.

## Actual source cap and void

Original model: `public/models/vancouver/vancouver-art-gallery.glb`.
SHA-256: `bb1698be78e258a3da8bb0fe8953d8561748be9925dc9011be10fe49584f7a32`.

Audit decoded normalized POSITION attributes and applied each glTF node's world matrix, then the existing rear-entry repair and original-stair removal. Rotating by the registered entry angle 0.7769452205671321 gives the common authored u/y/v frame. The loaded Gallery later rotates by the opposite angle and adds the existing 0.08m datum.

The retained foundation already has a top cap at **local y3.199517011642456** across the entire new strip. No new terrace floor and no source removal are needed. Source triangle 2278 after the existing stair removal has vertex IDs 3277/3267/3314:

| Vertex |                   u |           local y |                  v |
| ------ | ------------------: | ----------------: | -----------------: |
| 3277   | -28.102706909179688 | 3.199517011642456 |  23.86869239807129 |
| 3267   | -21.030731201171875 | 3.199517011642456 | 63.001930236816406 |
| 3314   |  -8.872893333435059 | 3.199517011642456 |  23.81922721862793 |

Adjacent cap triangle 2261 uses 3277/3273/3271; triangle 2271 uses 3267/3266/3314. These are audit identifiers, not runtime offsets. Runtime neither mutates nor selects source indices. The source cap extends much farther back than this intervention; its entire existing extent is preserved.

Actual rays beneath the cap at u−25/−22/−19/−16/−13 and y1.5 reach a distant rear wall around v−22, rather than a near wall at v24–28. Therefore the new lower facade is set back to v24.15–24.25 and remains visibly recessed through the gaps between columns. Source cap audit artifacts: `artifacts/local/gallery-west-cap-audit.mts` and `.json`.

## Registered construction and contact

All figures below are local u/y/v except the explicit world datum. Horizontal placement uses the retained cap as a hard bound, while appearance dimensions remain estimated.

- Edge: u−27.8..−9.4, front v28.3, beam back v27.15, beam bottom y2.42, beam top exact source cap.
- Underside: v24.15..27.15, bottom y2.94, top exact cap. Beam/soffit boxes omit their upward face at the cap to retain a single visible floor owner.
- Four piers: u−27.25/−21.55/−15.85/−10.15, width0.65m, v27.5..28.15, local bottom−0.08 to y2.42. Their world bottoms are exactly y0; the beam meets each pier without a gap.
- Closed lower glazing: v24.15..24.25, local bottom−0.08 to y2.94, with finite side returns and framing. It is approximately4.05m behind the edge face. No front-spanning blind wall or new support route is introduced.
- Planter: u−27.8..−9.4/v27.05..28.1, height0.64m above the retained cap, walls0.12m. Crown roots are buried0.18m below its top and overlap the low hedge; no floating/exposed tree bases.
- Five crowns: local u−26.4/−22.65/−18.9/−15.15/−11.4, v27.58; estimated heights5.5/6.5/7.3/6.1/9.5m and widths0.98/1.08/1.2/1.05/1.48m. These give the visible alternating silhouette without claiming measured botany.

`galleryWestTerraceBoxes()` supplies both geometry and hard contact. Camera contact is sphere-to-finite-box distance; actor contact uses the existing foot/body interval and a horizontal circle. There is no infinitely high barrier and no foliage collision. The contact helper only adds finite obstacles; it does not exempt existing private Gallery mass or change support heights.

Exact existing footways w263530524 and w749560067 are tested over their full stored widths, with player/camera clearance. The arrival and central stair corridor are outside this addition. Existing broadleaf/tree arrays are never read or mutated by the addition.

## Integration contract

- In `addGalleryFacade`, call `addGalleryWestTerrace(mesh, base, frame, glass)` before `mesh.finish()`. It reuses the owning materials, including the existing rear-facing glass receiver.
- In `galleryStairFramingBlocked`, immediately after converting world x/z to u/v, return true when `galleryWestTerraceBlocked(u, v, radius, y, camera)` is true. Preserve the independent bistro/portico delegates. There is no support hook.

The complete addition is5,272triangles/3,340vertices in four material batches, comprising23hard members, five696-triangle crowns and a1,520-triangle hedge. Only the foliage material is new.

Static foliage has connected closed lobed crowns rather than stacked spheres or billboards. It uses one opaque, rough, vertex-coloured material, without new textures, downloads, custom shaders, animation, or per-frame work. Stone/metal/glass reuse the existing instances and batching.

## Verification and acceptance

`npx tsx --test tests/gallery-west-terrace.test.ts` verifies the real decoded GLB cap across a750-sample grid; unchanged source arrays; no duplicate cap-height upward faces; original and new lower frontage depth; closed front-side rays; all five crown orientation/closure/root contact; world-ground pier contact; finite rendered/contact member parity; actual source route clearance; and a<5500-triangle/four-material-batch budget. TypeScript checking is separate from native visual acceptance.

Native ordinary walking-view review is still required. Metric plant/frontage fits and shadow appearance are not claimed as surveyed or visually accepted by these source tests.
