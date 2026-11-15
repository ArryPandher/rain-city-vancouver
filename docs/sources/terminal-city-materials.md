# Terminal City Club exterior materials

`createTerminalCityMaterials(library)` supplies six isolated shared materials: glass, spandrel, metal, stone, dark and roof. The exported `TerminalCityMaterials` type is the geometry interface. No per-pane materials, emissive daytime windows, window-grid photograph, transparency pass or custom GLSL is introduced. The assembly wrapper shares these materials and one exterior static reflection probe across both registered parcels.

## Evidence and interpretation

The architect's [Terminal City Club project page](https://www.mcmparchitects.com/projects/terminal-city-club/) and its [Hastings](https://www.mcmparchitects.com/wp-content/uploads/2017/07/exterior_bldg_hastings-WEB.jpg) and [Howe](https://www.mcmparchitects.com/wp-content/uploads/2017/07/exterior_bldg_howe-WEB.jpg) photographs establish blue-green reflective glazing, fine pale silver frames and warm pale mineral cladding on the podium and upper opaque faces. Inspected local files are `artifacts/local/terminal-city-reference/mcm-hastings.jpg` and `mcm-howe.jpg`; retrieval hashes/provenance are in that folder's `downloads.json`. No open image licence was found. These are research references only, not runtime images or calibrated albedo measurements.

The architectural brief identifies Tyndall limestone. **The supplied texture is not a Tyndall limestone scan** and does not reproduce its characteristic fossil/mottled structure. It is a restrained generic fine-grain mineral fallback, tinted warm to establish the observed cladding/glass contrast. Native close-up calibration remains necessary; no photograph determines the chosen RGB, coating or roughness values.

## Runtime provenance and parameters

Stone reuses the existing three 512px maps under `public/textures/canada-place-plinth/`: color, OpenGL normal and roughness. Their underlying source is Charlotte Baglioni's [Concrete Wall 009](https://polyhaven.com/a/concrete_wall_009), [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). The committed `SOURCES.json` records source URLs and the joint/tie-hole-free crop, neutralization, mirrored normal-sign correction and compression. Those prior prepared maps were labelled painted mineral for the plinth; reusing their subdued granular modulation here is an approximation, not a material-identification claim. No downloads, new image generation, reference-photo texture use or shared asset modifications were performed. The failed ambientCG Tiles142 CDN path was not retried.

The stone color is warm pale `0xd9ceb5`; roughness multiplier 0.92 gives approximately 0.68–0.79 with the prepared roughness map, and normal scale 0.20 avoids exaggerated grain. All samplers repeat every estimated 1.5 m. Geometry must provide metre UVs on every stone face, including box sides and caps. Sampler wrappers are cloned, so another landmark's repetition and color-space settings are not changed. Albedo is sRGB; normal and roughness data are linear. Authored joints/reveals belong to geometry; this material adds no competing grid.

Glass is an opaque blue-green coated-glass proxy (`0x719991`, metalness 0.65, roughness 0.14, clearcoat 1). It is deliberately distinct from Waterfront Centre's bluer glass, but is not a measured optical coating stack. Existing environment/probe reflections supply broad variation across panes; no pane image or emission does so. Muted blue-green spandrels, silver metal, closed dark backing and a matte roof complete the six groups. Visible interiors are outside scope.

## Verification

Focused tests check licensed source-file existence, shared sampler isolation, color/data color spaces, six bounded opaque standard/physical groups, non-emissive grid-free glazing, and matching metric map transforms after real world-space geometry baking. No custom shader is patched, so the factory retains the existing Three/Batcher program path. Native daylight review accepts the blue-green glass/pale-cladding separation and visible recesses in close and wide Cordova views. Broad glare and uniform stone response remain limitations; neither tests nor this visual checkpoint establish photographic equivalence.
