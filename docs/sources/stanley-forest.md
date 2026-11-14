# Stanley Park woodland rendering

Woodland placement uses the unnamed OSM forest polygons inside Stanley Park, excluding the broad park boundary, mapped lawns/open spaces, water, buildings and holes. A seeded, jittered grid with clustered density supplements the point-tree inventory. Trunks remain at least 2.4 m beyond mapped carriageway/path edges and five metres from existing trees. New forest trunks have circular movement collision. Planting density and tree heights (22–42 m) are authored interpretations, not a forest census. The terrain is still approximate and flat away from authored bridges/gardens.

Conifers use **Fir Tree 01**, photography by **Rob Tuytel**, modelling by **Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/fir_tree_01), CC0. Variants C and B are extracted from the 478 MB shared source buffer using separate byte ranges of approximately 33 MB and 157 MB. Variant C retains every original twig in its near model (463,490 triangles total). The fuller B variant uses a deterministic one-in-six needle sample with transverse coverage compensation and simplified wood (390,441 triangles). Missing trunk UVs are generated cylindrically, separate original alpha masks are restored before WebP packing, and reduced branch normals are refitted. These generic firs are visual interpretations, not surveyed Stanley species models.

The original intermediate models (C: 48,048 triangles; B: 76,555) remain a download-failure fallback. Their sampled needle strips retain corrected winding, original texture coordinates and width compensation. The current middle-distance representation retains their wood and replaces sampled needles with the layered foliage described below. Full and middle detail share the near model's height/width reference and root placement. A 12% selection preference keeps neighbouring trees from swapping levels after tiny movements; crossing a level boundary is still discrete, without a crossfade.

Balanced uses up to 8 near and 64 medium trees; High uses 24 and 128, and Performance uses distant silhouettes. The scene mixes the fuller B shape with C at an approximate two-to-one ratio using a stable position hash. Distant trees use two crossed, alpha-cut silhouettes for their assigned variant, including its trunk. Four unlit orthographic views share a 4096×2048 atlas under a new filename to avoid loading the old two-view layout from browser caches. Ground detail uses bounded nearby pools. Rocks and stumps are simplified with a 0.002 error limit, preserving their material maps and shape while reducing their rendering cost.

Forest soil uses **Forest Ground 06**, **Charlotte Baglioni**, and **Leaves Forest Ground**, photography **Dimitrios Savva**, processing **Dario Barresi**, Poly Haven CC0. The 2K soil color/OpenGL normal/roughness and leaf-litter color maps blend in broad world-space patches at their source metre scales. This is generic forest photography, not a scan of Stanley Park. The named park boundary remains grass; explicit lawns render above the forest soil.

Understory uses **Fern 02**, **Rob Tuytel / Rico Cilliers**; **Moss 01** and **Tree Stump 01**, **Rob Tuytel**; **Rock Moss Set 01**, **Kless Gyzen**; **Shrub 04**, **Rico Cilliers**; and **Nettle Plant**, **Rob Tuytel / Rico Cilliers**. All are [Poly Haven CC0 assets](https://polyhaven.com/license). Several original plant/rock forms are pivot-normalized and instanced near the player. Shrubs and nettles use bounded geometric simplification. Their density and the fern/soil distribution are interpreted. Moss retains a centimetre scale. The distribution excludes mapped routes and buildings, with 2.2 m site clearance before small clump offsets. Ferns and small ground props are visual detail; tree trunks block movement. Roots are sunk into the soil while the canopy keeps its intended above-ground height. Distant tree coverage remains in every graphics mode.

Exact files, URLs, authors and modifications: [model source manifest](stanley-forest-assets.json), [ground source manifest](../../public/textures/forest/SOURCES.json), and the main [asset manifest](../../public/asset-manifest.json).

## Reproduction

1. `node scripts/fetch-forest-assets.mjs` prepares variant C, ground models and their shared source textures.
2. `node scripts/fetch-conifer-variant.mjs` extracts B into the local source cache and restores its UVs/alpha.
3. `node scripts/prepare-conifer-lod.mjs` prepares C medium detail.
4. `node scripts/prepare-conifer-lod.mjs artifacts/local/forest-source/fir_tree_01/variant-b.glb public/models/forest/fir_tree_01-b.glb 6 2.3 0.18` prepares B near detail.
5. `node scripts/prepare-conifer-lod.mjs artifacts/local/forest-source/fir_tree_01/variant-b.glb public/models/forest/fir_tree_01-b-medium.glb 16 5 0.04` prepares B medium detail.
6. `node scripts/fetch-forest-ground.mjs` prepares soil and leaf maps.
7. Run `npm run dev`, open `http://127.0.0.1:5178/scripts/bake-forest.html?variant=c` or `?variant=b`, and wait for `window.ready`. Save `forestBake.frame(0)` and `forestBake.frame(Math.PI / 2)` PNG data URLs as `artifacts/local/forest-conifer-c-0.png`, `c-1.png`, `b-0.png`, and `b-1.png` with the same prefix.
8. `node scripts/assemble-forest-atlas.mjs` creates the four-view WebP atlas. Rebuild and visually check the scene after changing any source material or geometry.

Exact LOD counts, sampling, bounds and modifications are recorded in [C medium](stanley-conifer-lod.json), [B near](fir_tree_01-b-lod.json) and [B medium](fir_tree_01-b-medium-lod.json). Source caches can be deleted after validation; the scripts reproduce them.

No Rockstar assets or Vancouver reference photographs are distributed in this forest pass.


The later terrain pass grounds these models on City contour-derived heights; see [Stanley terrain](stanley-terrain.md). Earlier flat-ground limitations above describe the preceding build.

## Spatial rendering and coastal slopes

Near/middle conifers are grouped into 32 m cells; ground props use 24 m cells. The renderer can reject each batch independently for the view and shadow cameras. Reused slots have compact matrix/color buffers that grow only as needed. Source geometry/materials are shared, while per-tree stem attributes remain independent. The total selected detail budgets are unchanged. The sunlight target and rain emitter follow ground elevation.

Generated planting avoids gradients above 0.75, retaining mapped point trees; see [coastal ground](stanley-cliffs.md). This changes the procedural tree/site count on steep slopes. Forest density and species remain interpretations.

## Layered middle-distance foliage

The committed near C/B models supply eight depth slices along each of their X and Z axes. Each slice captures unlit foliage color/alpha and model-space vertex normals. The actual low-poly wood remains three-dimensional. Every pixel chooses one of the two view families with a stable screen-space dither; normal lighting and sunlight depth use the same family selection. This avoids doubling the opacity where perpendicular views intersect. Lighting normals account for each tree's rotation and nonuniform scale.

The capture resolves antialiasing against transparent black. Assembly corrects its premultiplied RGB before adding an eight-pixel color margin; WebP padding alpha is 1/255, below the rendering cutoff. Separate color and normal atlases are 4096×2048, arranged as eight columns and two rows. Four WebP files total **2,118,894 bytes**. [Exact sources](../../public/textures/forest/volume/SOURCES.json): Fir Tree 01, photography Rob Tuytel, modeling Rico Cilliers, Poly Haven CC0. No new reference photography or external model was added in this pass.

Instead of full rectangular cards, each slice uses horizontal bands fitted around its branch pixels, including a filtering margin. The bands retain all pixels above the draw cutoff while occupying about **15.6% (C) / 24.0% (B)** of the original rectangular area. They use 206/286 triangles. Including the retained wood, middle trees total **3,304/3,949 triangles**, down from 48,048/76,555. This is a geometry/coverage comparison, not a frame-rate guarantee. The near geometry and tree count are unchanged. Any failed foliage-image request disposes the successful partial loads and retains the original geometric middle trees.

Selection measures distance to each tree's vertical extent as well as horizontal distance. A tree high on the Prospect Point cliff no longer consumes a close-up slot simply because its map coordinate is nearby. Photo mode updates scenery around the moving camera, including height changes; ordinary play follows the player. Balanced/High budgets remain 8+64 / 24+128; Performance restores distant crowns.

To reproduce the new layer from the committed near models:

1. Start the Vite development server on port 5178.
2. Run `browser-harness < scripts/capture-conifer-volume.py` from the repository root. This opens one authoring tab, visits `scripts/bake-conifer-volume.html` for C and B, and saves 64 PNG frames into the ignored local artifact directory. The page's `coniferVolumeBake.capture(axis, index, pass)` API can also save those same frames manually.
3. Run `node scripts/assemble-conifer-volume.mjs`. This writes the four WebP atlases, source manifest and `src/world/conifer-volume-cuts.json`.
4. Use `scripts/inspect-conifer-volume.html?variant=b` (or `c`) on the development server to compare near, original middle and layered forms at different angles. Run the tests/build and inspect actual gameplay, including night and oblique views.

These are generic fir-derived approximations, not scanned Stanley Park trees. Two vertical view families have limited fidelity from steep overhead angles; dither, repeated forms and discrete LOD changes can remain visible. Normal maps approximate needle lighting, and middle foliage has no branch wind animation. Forest fill cost and near-tree geometry remain substantial. AAA fidelity is unfinished.
