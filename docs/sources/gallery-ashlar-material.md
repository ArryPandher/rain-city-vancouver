# Gallery rear ashlar wall finish

## Evidence and scope

The ordinary native `artifacts/local/robson-cornice-detail.png` shows the completed rear wall apertures and cornice but a nearly continuous pale wall field. The gallery's [official rear exterior photograph](https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg), cached as `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg`, shows ashlar courses and restrained differences between neighbouring stones at comparable whole-facade scale. The photo is a research reference, not a runtime asset; no open image licence is assumed. Different lighting and exposure prevent calibrated reflectance comparisons.

`rabich-gallery-2022-1930.jpg` corroborates mineral variation in close-up, but depicts another facade. It is not evidence for the rear geometry or a particular rear weathering pattern. No new downloaded asset, photo texture or speculative streak/stain mask is used.

The actual loading path in `vancouver-landmarks.ts` applies `LandmarkSurfaces.material` to the Gallery's named `stone`, puts that result into `galleryMaterials`, then passes it to `addGalleryFacade`. The replacement upper walls therefore already receive the licensed mineral maps and metric joints; no missing-map defect was established. This candidate changes their response within those existing cells. It does not introduce another masonry grid.

## Candidate implementation

`createGalleryAshlarMaterial(source)` in `src/world/gallery-ashlar-material.ts` accepts only a Gallery mineral material with an existing joint profile. Otherwise it returns the source unchanged. The profiled case creates one material clone, preserves the source shader callback explicitly (Three.js material cloning does not copy that callback), and adds a distinct program cache key.

The generated upper nine-bay wall, aperture reveals, sills and shallow surrounds use this clone. Existing source stone, added column shafts, capitals, cornice, foundation and its physical rustication retain their previous materials. The hookup is confined to `gallery-facade.ts`; no world, camera, lighting or other building hook changes.

- Existing course dimensions remain 1.2 × 0.55m, 4mm joint width and 3mm shader relief. These are the existing authored scale, not dimensions measured from the oblique source photo.
- Existing block-cell identity drives a neutral linear-light albedo multiplier of 0.88–1.12 instead of 0.98–1.02. The symmetric range preserves the nominal stone hue and unit mean. This is a bounded art-direction candidate, not measured reflectance. It strengthens stone-scale variation without increasing joint darkness or width.
- Roughness varies by at most 0.04 around the existing mapped response using the same cell. This correlation is authored, not a measured property of the building.
- Existing footprint filtering, normal detail, joint relief and map scale remain intact. The metric tangent-plane UVs supplied by `gallery-facade.ts` are required; one UV unit is one metre.
- No weathering was added: a defensible registered weathering mask is absent, and arbitrary dark bands would duplicate architectural shadowing.

All three map samplers are reused by identity, with no texture transform or shared-source mutation. The existing assets are `public/textures/landmarks/mineral-{color,normal,roughness}.webp`, derived from Poly Haven's CC0 Granite Tile by Charlotte Baglioni; see their local `SOURCES.json` and `landmark-surfaces.md`. They provide generic mineral microdetail rather than a scan of the Gallery's stone.

The clone owns no textures. Dispose the material with the facade; shared maps retain their existing Materials lifetime. There is one additional opaque wall batch: five generated facade draws rather than four, with exactly the same geometry and no per-block meshes.

## Validation and next review

Seven focused tests pass: the new material tests plus `gallery-facade.test.ts`. They exercise the real `LandmarkSurfaces` callback, confirm a single joint field and preserved relief, shader ordering, maps/source immutability and disposal ownership, wall-only assignment, unchanged complete vertex multiset, bounded material count, and the existing actual-GLB replacement/reveal invariants. Scoped TypeScript checking passes with the project's Vite/Node ambient types.

No full build, browser or native capture was run for this candidate. Root should compare the same ordinary Gallery start and daylight view with the previous cornice screenshot in the combined dome build. Accept only if the upper walls read as coherent pale masonry without a checkerboard effect or mismatch against the retained columns/trim. This is not a claim of native visual acceptance.
