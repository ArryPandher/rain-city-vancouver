# Vancouver Art Gallery: west planted terrace edge

## Evidence and scope

The Gallery's official 2023 exterior photograph shows five narrow columnar conifers rising from a continuous low hedge/planter at the west side of the Robson entrance. Below the planted edge is a deep fascia, separate supports, and a recessed glazed lower/service frontage. A solid wall across the complete front would erase that characteristic void.

- Official reference: https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg
- Retained reference: `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg` (854×854).
- Detail: `artifacts/local/gallery-west-planting-reference.png`, cropped from x45/y290/w235/h310 and enlarged for inspection. The five crowns are separately visible; the rightmost is tallest.
- Prior native baseline: `artifacts/local/gallery-terrace-corrected-arrival.png`.

The Gallery reference is used to interpret architecture, not shipped as a texture. No image-reuse licence is asserted for that reference. All new meshes are original geometry; the separate licensed generic twig atlas is described below. Tree species, metric heights, precise plant positions and service-bay dimensions are **photographic estimates**, not survey measurements. The construction deliberately names these columnar conifers rather than asserting a species.

The bounded addition comprises five crowns, their continuous hedge/planter, the edge fascia, four finite piers, and a recessed closed glazed service front. Existing mapped broadleaf trees, Gallery walls/roof, stairs, main portico, eastern bistro, roads and terrain remain separately owned and unchanged. This does not create a navigable service interior.

## Rejected first registration and corrected exterior strip

The first implementation (9e8a77c/4619b0d, integrated d269) placed a transverse row at u−26.4..−11.4/v27.58. **Native review rejected this placement.** It was inside the retained southwest Hooper wing, hidden behind the long side wall and below copper roofs. The earlier cap audit started just above y3.2 and established only floor support; it did not test the overhead enclosure. The earlier support conclusion must not be interpreted as proof of a valid exterior position.

Original model: `public/models/vancouver/vancouver-art-gallery.glb`, SHA-256 `bb1698be78e258a3da8bb0fe8953d8561748be9925dc9011be10fe49584f7a32`. The full decoded source, after current entry/facade/stair cuts, shows:

- The real west-wing side lies near u−8.8 and extends to v58, with the projecting western end around v63. Its mapped source parts380105927/380105931 carry stone y13.15–14 and copper roofs y14–18.
- Arrival sight rays from u0.814/y1.6/v51.3 to every old crown hit retained stone/glass at u≈−8.8, v32.6–42.9.
- Top rays over old roots hit source copper y14.76–17.30 or stone y13.15/14.00. Those roofs and side walls are valid retained geometry, not disposable occluders.
- Native evidence: `artifacts/local/gallery-west-approach-obstruction-native.png`; exact ray/vertex evidence: `gallery-west-occlusion-audit.json`.

The cached georeferenced aerial `artifacts/local/robson-realism-reference/esri-garden-context.jpg` and its EPSG3857 extent in `esri-garden-export.json` confirm the long wing. The registered overlay `artifacts/local/gallery-west-plan-registration.png` shows the first red row over its roof, and the planted/terrace strip outside its east side. The official oblique photograph's row and recessed service frontage are interpreted as running longitudinally along that exterior strip toward the stairs. An independent architecture-agent read agreed with this orientation. Individual centres and extent remain inferred from imagery, not surveyed.

The correction uses a proper90° assembly rotation and translation; it does **not** remove, hide, shorten or exempt the existing wing. The service strip now occupies Gallery-local **u−8.5..−4.85, v34.5..52.9**. The source wing side remains approximately0.2–0.3m west of the strip's back. It is a new closed exterior platform at the existing Gallery terrace datum, not the old buried source cap. Source geometry and original positions/indices remain untouched.

## Corrected construction and gameplay contact

The authoring helpers retain their internal assembly coordinates. `galleryWestPoint(along,out)` converts them to Gallery coordinates as `[out−33.15,25.1−along]`; its inverse is used by collision. Rendering applies the same rigid transform, preserving normal winding and atlas UVs. The Gallery's existing final rotation and +0.08m datum remain unchanged.

- New cap: local y3.199517011642456 (world3.279517), matching the existing Gallery terrace datum. Beam and soffit boxes now include their upward faces; the two adjoining regions have no overlapping floor area.
- Front edge: u−4.85; beam underside y2.42. Ceiling underside y2.94. Side returns, rear closure and four square0.65m piers join the cap/beam without gaps.
- Every ground-reaching member starts at local−0.08, exactly world y0. Actual full-city ground samples at the four feet match that plane.
- Closed service glazing is at u−8.5..−8.4, approximately3.55m behind the east edge, with closed end returns and metal framing. Gaps remain between the piers; no full-height blind front wall is added.
- Planter walls start on the new cap and rise0.64m. Roots are buried0.18m below the top and overlap the low hedge. No floating trees or new navigable interior are introduced.
- Corrected tree centres: u−5.57, with v51.5/47.75/44/40.25/36.5 and estimated heights5.5/6.5/7.3/6.1/9.5m. The tallest tree is nearest the stairs. Widths remain0.98/1.08/1.2/1.05/1.48m. Heights and botanical detail are interpretations; perspective in the source does not establish a precise tree inventory.
- The northern end atv34.5 leaves **1.13m beyond the existing stair footv33.37**, enough for the0.36m player to turn laterally across the entire stair mouth. It does not consume any tread width.

`galleryWestTerraceBoxes()` continues to supply both render and finite contact. Camera contact uses sphere-to-box distance; actors use their existing vertical interval and horizontal radius. No foliage collision, ground-height override, private-building exemption or infinitely high wall is added. Full widths of mapped footways w263530524 and w749560067 remain clear. Existing mapped broadleaf trees remain untouched.

A normal inspection route runs from Gallery-local `(0.814,51.3)` through `(0.8,43)`, `(0.8,36)` to `(0.8,34)`, looking west toward the row. These points are east of the new edge, so they do not require crossing the old wing wall. Full-city movement/support and ordinary4.3m chase-boom checks pass along this route. Native visual review remains required.

## Integration and cost

Existing root hooks remain valid: `addGalleryWestTerrace(mesh,base,frame,glass)` before `mesh.finish()`, and `galleryWestTerraceBlocked(u,v,radius,y,camera)` after world-to-Gallery coordinate conversion. Keep the independent bistro/portico delegates. There is no support hook. Preserve atlas UVs only for `galleryFoliageAtlas` material.

The complete correction is **13,004 triangles / 14,932 vertices in five material batches**: hard members276 triangles, backing/hedge5,000 and folded sprays7,728. The four-triangle increase closes the previously omitted cap faces. The full current Gallery facade factory totals31,694triangles/nine batches. No new textures, captures or per-frame work are added by this registration repair.

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

`npx tsx --test tests/gallery-west-terrace.test.ts tests/gallery-west-foliage.test.ts` verifies750 full-height source rays over the corrected strip; regression rejection of the roof-enclosed old placement; crown-volume and ordinary-arrival source sightlines; unchanged source arrays; a single new closed cap; recessed lower frontage depth; closed front-side rays; all five crown orientation/closure/root contact; actual world-ground pier contact; finite rendered/contact member parity; full-width mapped route and stair-mouth clearance; walking/chase-camera integration; a bounded five-material geometry budget; image provenance and actual alpha gaps; atlas orientation and normal convention; load failure/disposal; and actual Gallery batch UV/contact integration. TypeScript checking is separate from native visual acceptance.

Native ordinary walking-view review is still required. Metric plant/frontage fits and shadow appearance are not claimed as surveyed or visually accepted by these source tests.
