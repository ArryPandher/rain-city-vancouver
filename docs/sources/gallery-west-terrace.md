# Vancouver Art Gallery: west planted terrace edge

## Evidence and scope

The Gallery's official 2023 exterior photograph shows five narrow columnar conifers rising from a continuous low hedge/planter at the west side of the Robson entrance. Below the planted edge is a deep fascia, separate supports, and a recessed glazed lower/service frontage. A solid wall across the complete front would erase that characteristic void.

- Official reference: https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg
- Retained reference: `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg` (854×854).
- Detail: `artifacts/local/gallery-west-planting-reference.png`, cropped from x45/y290/w235/h310 and enlarged for inspection. The five crowns are separately visible; the rightmost is tallest.
- Prior native baseline: `artifacts/local/gallery-terrace-corrected-arrival.png`.

The Gallery reference is used to interpret architecture, not shipped as a texture. No image-reuse licence is asserted for that reference. All new meshes are original geometry; the separate licensed generic twig atlas is described below. Tree species, metric heights, precise plant positions and service-bay dimensions are **photographic estimates**, not survey measurements. The construction deliberately names these columnar conifers rather than asserting a species.

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
- Preserve atlas UVs for the single material marked `galleryFoliageAtlas`; all stone/other facade UV handling remains unchanged.
- In `galleryStairFramingBlocked`, immediately after converting world x/z to u/v, return true when `galleryWestTerraceBlocked(u, v, radius, y, camera)` is true. Preserve the independent bistro/portico delegates. There is no support hook.

The complete addition is **13,000 triangles / 14,932 vertices in five material batches**: 23 hard members (272 triangles), five compact inner crowns plus hedge (5,000), and folded needle sprays (7,728). Stone/metal/glass reuse the owning instances; the backing and needle finish add two materials. No new model download, custom shader, animation, or per-frame update is needed.

## Licensed close foliage finish

The initial closed spindle meshes were retained only as compact internal backing, scaled to 68% of the fitted radial envelope. They are not the final visible foliage surface. Small upward folded branch sprays surround them, preserving the narrow photographic silhouette while giving the surface and outer edge actual needle alpha/normal detail. Each branch card is at most 0.48m wide and 0.76m tall; the twelve-sided arrangement changes phase every row and remains within the explicit crown bound. It does not stretch an entire fir-tree model into a different species.

The separate RGBA and OpenGL normal atlas are extracted **byte-for-byte** from the already committed `fir_tree_01_twig` material in `public/models/forest/fir_tree_01-medium.glb`. Source: [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), photography Rob Tuytel, modelling Rico Cilliers, **CC0**. This is a generic fir-needle approximation for columnar conifers; exact scale foliage/species scanning remains unresolved. Source geometry is not copied.

- RGBA atlas: 1024×1024, 153,126 bytes.
- Normal atlas: 1024×1024, 93,372 bytes.
- Total added image files: **246,498 bytes**, extracted locally without network requests.
- Exact source/derived SHA-256, attribution and reproduction: `public/textures/gallery-conifers/SOURCES.json`.
- Reproduce with `node scripts/prepare-gallery-conifer-foliage.mjs`.

Four selected image regions contain actual alpha-connected sprigs plus six-pixel filtering margins. Their coverage is approximately 14–30%, excluding the opaque trunk strip and unrelated atlas areas. Upward card tips sample smaller image rows. Both textures use `flipY=false`, matching glTF image orientation, with sRGB color, linear normal data and derivative normal scale `(0.75, -0.75)`. A white material leaves the photographed needle color intact. Standard double-sided rough material uses alpha cutoff 0.12 and alpha-to-coverage; Three's existing shadow pass approximates the latter using its normal 0.5 shadow cutoff.

The material marks `userData.galleryFoliageAtlas=true`; the final Gallery batching loop must skip metric `landmarkSurfaceUV` only for this material. That actual integration is regression-tested. Incomplete/failed texture loads hide the cards and leave the compact geometric backing; they never show opaque untextured rectangles. Owned image textures are disposed with the material.

An offline front-view alpha ray preview is recorded at `artifacts/local/gallery-conifer-alpha-preview.png`. Among 24,875 rendered tree samples, 17,660 first hit real twig alpha and 7,215 reached inner backing. It checks needle-edge coverage, not native shader lighting or visual acceptance. The ordinary native view remains decisive.

## Verification and acceptance

`npx tsx --test tests/gallery-west-terrace.test.ts tests/gallery-west-foliage.test.ts` verifies the real decoded GLB cap across a750-sample grid; unchanged source arrays; no duplicate cap-height upward faces; original and new lower frontage depth; closed front-side rays; all five crown orientation/closure/root contact; world-ground pier contact; finite rendered/contact member parity; actual source route clearance; a bounded five-material geometry budget; image provenance and actual alpha gaps; atlas orientation and normal convention; load failure/disposal; and actual Gallery batch UV/contact integration. TypeScript checking is separate from native visual acceptance.

Native ordinary walking-view review is still required. Metric plant/frontage fits and shadow appearance are not claimed as surveyed or visually accepted by these source tests.
