# Stanley Park woodland rendering

Woodland placement uses the unnamed OSM forest polygons inside Stanley Park, excluding the broad park boundary, mapped lawns/open spaces, water, buildings and holes. A seeded, jittered grid with clustered density supplements the point-tree inventory. Trunks remain at least 2.4 m beyond mapped carriageway/path edges and five metres from existing trees. New forest trunks have circular movement collision. Planting density and tree heights (22–42 m) are authored interpretations, not a forest census. The terrain is still approximate and flat away from authored bridges/gardens.

The nearby conifer is **Fir Tree 01**, photography by **Rob Tuytel**, modelling by **Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/fir_tree_01), CC0. Only variant C is extracted from the 478 MB shared source buffer, using an HTTP byte range of approximately 33 MB. Solid wood is simplified; every original twig surface is retained (446,074 twig triangles, 463,490 total). Missing trunk UVs are generated cylindrically. Original alpha masks are restored from the separate source files before WebP packing. Height/crown dimensions and lower-stem scale are adapted at runtime; the same stem deformation is used by sunlight shadows. This generic fir is a visual interpretation, not a claim to be an exact Douglas-fir species model.

Distant conifers use two crossed, alpha-cut silhouettes baked from the same geometry and photography, preserving the actual branching shape rather than a cone of generic cards. They include the trunk and replace the older duplicate cylinder. The atlas has two orthographic views, 90° apart, rendered without scene lighting so the game's lighting remains responsible for shading.

Forest soil uses **Forest Ground 06**, **Charlotte Baglioni**, and **Leaves Forest Ground**, photography **Dimitrios Savva**, processing **Dario Barresi**, Poly Haven CC0. The 2K soil color/OpenGL normal/roughness and leaf-litter color maps blend in broad world-space patches at their source metre scales. This is generic forest photography, not a scan of Stanley Park. The named park boundary remains grass; explicit lawns render above the forest soil.

Understory uses **Fern 02**, **Rob Tuytel / Rico Cilliers**; **Moss 01** and **Tree Stump 01**, **Rob Tuytel**; **Rock Moss Set 01**, **Kless Gyzen**; **Shrub 04**, **Rico Cilliers**; and **Nettle Plant**, **Rob Tuytel / Rico Cilliers**. All are [Poly Haven CC0 assets](https://polyhaven.com/license). Several original plant/rock forms are pivot-normalized and instanced near the player. Shrubs and nettles use bounded geometric simplification. Their density and the fern/soil distribution are interpreted. Moss retains a centimetre scale. The distribution excludes mapped routes and buildings, with 2.2 m site clearance before small clump offsets. Ferns and small ground props are visual detail; tree trunks block movement. Roots are sunk into the soil while the canopy keeps its intended above-ground height. The nearby conifer pool uses 8 trees in Balanced, 24 in High and distant silhouettes in Performance. Ground-detail pools are bounded by graphics settings; distant tree coverage remains.

Exact files, URLs, authors and modifications: [model source manifest](stanley-forest-assets.json), [ground source manifest](../../public/textures/forest/SOURCES.json), and the main [asset manifest](../../public/asset-manifest.json).

## Reproduction

1. `node scripts/fetch-forest-assets.mjs` extracts the conifer, restores alpha, fixes its UVs and prepares the six smaller model sets.
2. `node scripts/fetch-forest-ground.mjs` prepares soil and leaf maps.
3. Run `npm run dev`, open `http://127.0.0.1:5178/scripts/bake-forest.html`, and wait for `window.ready`. Save `forestBake.frame(0)` and `forestBake.frame(Math.PI / 2)` PNG data URLs as `artifacts/local/forest-conifer-0.png` and `forest-conifer-1.png`.
4. `node scripts/assemble-forest-atlas.mjs` creates the final WebP atlas. Rebuild and visually check the scene after changing any source material or geometry.

No Rockstar assets or Vancouver reference photographs are distributed in this forest pass.
