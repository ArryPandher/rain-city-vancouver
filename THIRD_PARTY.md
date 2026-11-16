# Third-party credits and licenses

## PwC Place

`src/world/pwc-place-parts.json` combines © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) part outlines with City of Vancouver **Building footprints 2009**, roof parts 161154/161155/162140. The geographic derivative retains [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/). Height normalization and source conflicts are documented, not represented as a current survey. Original rendering code is MIT; existing CC0 mineral maps retain their credits. Cadillac Fairview photography and City design drawings are reference only and are not distributed. [Sources, interpretation and limits](docs/sources/pwc-place.md).

## Fairmont Waterfront and Robson garden reconstruction

Fairmont Waterfront hotel part plans and the Robson garden route/tree positions derive from © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The compact hotel plan in `src/world/fairmont-waterfront-parts.json` retains that source attribution; original procedural rendering code is MIT, not a relicensing of the geographic database.

Hotel roof/canopy data includes City of Vancouver **Building footprints 2009**, group 151150 and roof part 162733. Contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/). Historical roof outlines and heights were projected, clipped and interpreted for the game. Existing CC0 Poly Haven mineral, bark and foliage maps are reused. Reference photographs are not distributed. [Hotel sources and modifications](docs/sources/fairmont-waterfront.md); [Robson circulation and height limitations](docs/sources/robson-mound-circulation.md); [tree sources](docs/sources/robson-mound-trees.md).

## Geographic data — OpenStreetMap / ODbL

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).

`public/data/vancouver.json` is a derived database extracted for Arry Pandher's Penguin Party on 2026-10-11. It contains public map geometry and public feature labels, not Penguin Party's private characters, personal notes, game content or server code. The data was converted to metres at runtime. Additional eastern Vancouver map data, when present, was obtained from the public Overpass API; the fetch script and source date are included. `public/data/vancouver-roads.json` replaces the rendered road layer with a consistent 2026-11-14 Overpass extract, retaining one-way, lane, width and sidewalk tags. Reproduce it with `node scripts/fetch-roads.mjs`; exact source timestamp and exclusions are embedded in the file. `public/data/vancouver-building-tags.json` adds current building-use, height and roof tags to matching footprints (source timestamp embedded; `node scripts/fetch-building-tags.mjs`). All derived geographic database files remain under ODbL. Building façades, procedural decoration and interpretation are not surveys.

## North Shore elevation — Mapzen Terrain Tiles / Canada / USGS

The diagnostic North Shore terrain uses [Mapzen Terrain Tiles distributed through AWS Open Data](https://registry.opendata.aws/terrain-tiles/), sampled from the public Terrarium PNG endpoint. **Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).** Applicable global fallback terrain is courtesy of the **U.S. Geological Survey**. Provider attribution and source descriptions: [Tilezen/Joerd](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). The RGB tiles do not identify per-pixel source lineage; the applicable fallback credit is retained.

The bounded derivative in [`src/world/north-shore-dem-data.json`](src/world/north-shore-dem-data.json) records all 12 original tile URLs and SHA256 checksums, geographic bounds, projection, sampling and quarter-metre quantization. It is resampled at approximately 80 m; rendering transitions the outer boundary strips to existing zero ground while retaining unexaggerated interior elevation. This is a visual interpretation, not a navigation or engineering survey. Reproduce with `node scripts/extract-north-shore-dem.mjs`, or verify cached originals with `node scripts/extract-north-shore-dem.mjs --verify`. [Source, transformations, diagnostic gate and limits](docs/sources/north-shore-dem.md). Original geometry/material code is separate from the elevation data; the elevation derivative itself contains no imagery. The diagnostic colour layer is credited separately below.

## North Shore diagnostic satellite colour — Copernicus Sentinel

**Contains modified Copernicus Sentinel data 2024.** The dated scene `S2A_10UDV_20240830_0_L2A` is distributed as a public Cloud-Optimized GeoTIFF by [Element 84 / AWS Open Data](https://registry.opendata.aws/sentinel-2-l2a-cogs/). The [Copernicus Sentinel Data legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice) permits lawful reproduction, distribution and adaptation with source notice; the imagery is not represented as MIT or CC0. A bounded 20m-overview crop is reprojected, resized and converted to WebP. Missing scene coverage blends to the neutral terrain; baked lighting and 2024 appearance remain. [Public provenance](public/textures/north-shore-dem/SOURCES.json), [source and limits](docs/sources/north-shore-imagery.md), [reproduction script](scripts/prepare-north-shore-imagery.mjs). This first diagnostic colour crop remains in the repository but is superseded at runtime by the licensed DNV2013 forward-slope orthophoto; the default photograph remains separately credited. Rejected cloudy EOX imagery is not shipped.

## Public-tree inventory — City of Vancouver

Contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/).

`public/data/vancouver-public-trees.json` is a bounded extract of the [City public-tree inventory](https://opendata.vancouver.ca/explore/dataset/public-trees/), reprojected into local metres with species, recorded height and trunk diameter. It is a separate source layer from the OSM database. Empty planting sites, invalid coordinates and duplicate assets/positions are excluded. Crown width/form and the generic tree meshes are interpretations. Records can lag the current landscape and do not inventory private trees; no City endorsement is implied. [Source and reproduction details](docs/sources/vancouver-public-trees.md).

## Stanley Park terrain — City of Vancouver and OpenStreetMap

Contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/). The [City 1-metre contours](https://opendata.vancouver.ca/explore/dataset/elevation-contour-lines-1-metre-contours/) are an approximate **2002** product. `public/data/stanley-terrain.json` and `stanley-height.u16` combine the interpolated contour heights with OSM park, water and road geometry. The combined geographic derivative is distributed under ODbL, retaining City and OpenStreetMap attribution. Road grades, lake beds, seawall levels and the transition to the existing flat city are interpretations. [Source, method and reproducible export](docs/sources/stanley-terrain.md).

## Photography — Poly Haven / CC0

Daylight uses **Rustig Koppie Pure Sky**, **Greg Zaal** (original) / **Jarod Guest** (sky edits), [Poly Haven](https://polyhaven.com/a/rustig_koppie_puresky), CC0-1.0. The 2K HDR is unchanged on disk; runtime radiance limiting and a vertical-axis rotation align its solar disc with the direct light and water. The same map supplies distant daylight reflections, while local probes capture the Vancouver scene. This is generic summer-afternoon lighting, not a Vancouver sky survey. [Measured direction, hash and source](docs/sources/afternoon-daylight.json); [reproduction](scripts/fetch-afternoon-sky.mjs).

Asphalt 02, Concrete Pavement, Aerial Grass Rock, Belfast Sunset PureSky, Kloofendal Overcast PureSky, Kloofendal 48d Partly Cloudy PureSky, Modern Evening Street, Tree Small 02 detailed tree and foliage, Cobblestone Floor 05, Fir Tree 01 branches and bark, and additional architectural texture maps are from [Poly Haven](https://polyhaven.com), licensed [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Exact files and source URLs are recorded in `public/asset-manifest.json`. The broadleaf and fir branch cards are modified/cropped/composited from those photographs. Night reflections use **Modern Buildings Night** by **Greg Zaal** (CC0), as a generic lighting environment rather than visible Vancouver scenery. Reflection radiance is limited to prevent excessive panoramic lamp highlights; [source record](docs/sources/night-reflections.json).

Photographed shop rooms use **Comfy Café** and **Decor Shop** by **Sergej Majboroda**, and **Phone Shop** by **Philip Modin**, from Poly Haven under CC0. They are resized WebP panoramas projected into virtual room boxes behind the windows. These are fictional interiors and do not depict the actual Vancouver business at an address. [Exact sources and modifications](public/textures/interiors/SOURCES.json); [reproduction script](scripts/fetch-shop-interiors.mjs).

Nearby residential door and window geometry is extracted from **Modular Urban Apartments Facade**, **James Ray Cock**, [Poly Haven](https://polyhaven.com/a/modular_urban_apartments_facade), CC0. Selected parts are pivot normalized, scaled and instanced; textures are converted to WebP. [Source manifest](docs/sources/architectural-details.json) and [reproduction script](scripts/fetch-architectural-details.mjs). These details are generic architectural interpretation, not an address-specific survey.

A selective **Modular Factory Facade** roller-shutter component by **James Ray Cock**, [Poly Haven](https://polyhaven.com/a/modular_factory_facade), is retained under [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). The selected geometry and three source images are preserved, with the library-layout translation recentered. This donor is **not loaded or installed at runtime**; it is not a measured Vancouver asset. [Exact selection, source hashes and license](public/models/terminal-service-detail/SOURCES.json); [status and limits](public/models/terminal-service-detail/README.md).

Arthur Erickson Place uses original geometry and **Concrete Wall 009** photography by **Charlotte Baglioni**, [Poly Haven](https://polyhaven.com/a/concrete_wall_009), CC0. Its reference photographs are not included in the game. [Architectural references and approximations](docs/sources/arthur-erickson-place.md); [texture sources](public/textures/cast-concrete/SOURCES.json).

Small houses use **White Planks Clean** and **Grey Roof 01** by **Rob Tuytel**, [Poly Haven](https://polyhaven.com/a/white_planks_clean), CC0. Color, OpenGL normal and roughness maps are converted to 1K WebP, with original window masks and geometry. These are generic painted-wood and grey roof-tile materials; they do not identify the real material of each address. [Source records](public/textures/houses/SOURCES.json); [reproduction script](scripts/fetch-house-materials.mjs).

The Law Courts and Robson Square use original reference-guided geometry, the same CC0 cast-concrete material, and existing licensed foliage photography. Architectural reference images are not distributed. [References, map identifiers and approximation limits](docs/sources/law-courts-robson-square.md).

Stanley Park woodland uses **Fir Tree 01** and **Fern 02** by **Rob Tuytel / Rico Cilliers**, **Moss 01** and **Tree Stump 01** by **Rob Tuytel**, **Rock Moss Set 01** by **Kless Gyzen**, **Shrub 04** by **Rico Cilliers**, **Nettle Plant** by **Rob Tuytel / Rico Cilliers**, **Forest Ground 06** by **Charlotte Baglioni**, and **Leaves Forest Ground** by **Dimitrios Savva / Dario Barresi**, all Poly Haven CC0. Modified with selective geometry extraction, wood simplification, missing-UV repair, source-alpha restoration, WebP conversion, two conifer variants, needle sampling/flattening with coverage compensation, branch-normal refitting, four-view silhouette baking and depth-sliced color/normal foliage with branch-shaped geometry. Placement, canopy dimensions and density are interpretations. [Detailed source and reproduction notes](docs/sources/stanley-forest.md).

The Vancouver Art Gallery west terrace uses the same **Fir Tree 01** twig color/alpha and normal photography by **Rob Tuytel / Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/fir_tree_01), CC0. The embedded atlas images are extracted unchanged and used on original bounded branch sprays. Placement and columnar form are photographic estimates; fir needles approximate foliage detail without asserting the actual species. [Exact image sources and hashes](public/textures/gallery-conifers/SOURCES.json); [architecture, source cap and foliage limitations](docs/sources/gallery-west-terrace.md).

Landmark surface detail uses **Red Brick** and **Green Metal Rust** by **Rob Tuytel**, and **Granite Tile** by **Charlotte Baglioni**, [Poly Haven](https://polyhaven.com), CC0-1.0. Maps are converted to WebP; a cropped, mirrored mineral face has corrected normal-map mirror signs and neutralized colour. Weathered painted-metal variation supplies an authored patina approximation. These are generic material photographs, not Vancouver scans. [Source records](public/textures/landmarks/SOURCES.json), [reference and interpretation limits](docs/sources/landmark-surfaces.md), [reproduction script](scripts/prepare-landmark-surfaces.mjs).

## Glass façade materials — ambientCG / CC0

The curtain-wall color, normal, roughness and metalness maps are adapted from [Facade006](https://ambientcg.com/view?id=Facade006), **ambientCG**, [CC0](https://docs.ambientcg.com/license/). This is an artist-authored procedural PBR material, not Vancouver photography. A sparse night-light texture is derived from its glass mask; the material is calibrated to 1.6 m panes and 3.2 m floors and paired with modeled mullions. [Source manifest](public/textures/curtain-wall/SOURCES.json); [reproduction script](scripts/fetch-curtain-facade.mjs).

## Vancouver landmark models — Codriver / CC BY 4.0

Canada Place, Harbour Centre, Science World, BC Place, Rogers Arena, Vancouver House, Fairmont Hotel Vancouver, Marine Building, Vancouver Public Library, Vancouver Art Gallery, Waterfront Station and Gastown Steam Clock are from [Codriver's 3D asset library](https://3d-assets.codriver.io/). © 2026 Codriver; geographic placement © OpenStreetMap contributors. Models are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source models remain unchanged; runtime adaptations add material response, photographic surface textures and geographic placement. Geographic estimates and simplifications are recorded in each source manifest.

See [the model catalog](public/data/vancouver-landmarks.json), [source manifests](docs/sources/) and [the original model license](docs/sources/CODRIVER-MODEL-LICENSE.md). These are detailed authored interpretations, not surveyed photogrammetry.

## Vancouver photography — Wikimedia Commons / CC BY-SA

- [North shore pan.JPG](https://commons.wikimedia.org/wiki/File:North_shore_pan.JPG), **Selmo**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Cropped/feathered photographic horizon, with weather tinting. The horizon is scenery rather than explorable mountain terrain.
- [Vancouver Hotel Vogue 2010.jpg](https://commons.wikimedia.org/wiki/File:Vancouver_Hotel_Vogue_2010.jpg) and [Vancouver Palms Hotel 2011.jpg](https://commons.wikimedia.org/wiki/File:Vancouver_Palms_Hotel_2011.jpg), **Canadian2006**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- [Gastown-19.JPG](https://commons.wikimedia.org/wiki/File:Gastown-19.JPG), **Xicotencatl**, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Façade derivatives are perspective corrected, cropped, colour balanced, and accompanied by derived roughness maps. All image derivatives retain their source's CC BY-SA license; they are not covered by the code's MIT license. Heritage photographs are used as surface references across appropriate districts, not claimed as an exact photographic reconstruction of every address. Full attribution and modifications: [photography sources](public/textures/vancouver/SOURCES.json). Reproduction script: [vancouver-photo-textures.py](scripts/vancouver-photo-textures.py).

## Concept car — CC BY 4.0

Car Concept © 2024 Darmstadt Graphics Group GmbH. Model and textures by **Eric Chadwick**, based on the public-domain source model by **Unity Fan**. Licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Source: [Khronos glTF Sample Assets: CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept). Original README and legal notice: [docs/CAR-ASSET-SOURCE.md](docs/CAR-ASSET-SOURCE.md).

Changes for Rain City: orientation/scale conversion, material recolouring, removal of expensive transmission, mesh batching, wheel pivots and game control integration. An optimized traffic version may be generated from the same source and retains the same attribution and license.

Khronos and 3D Commerce marks embedded in the original asset belong to their respective owners. No endorsement or affiliation is implied.

## E30 coupe — CC BY 4.0

`public/models/e30-coupe.glb` derives from **[FREE] BMW M3 E30**, **Martin Trafas** ([original model](https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422), [artist](https://sketchfab.com/TinoD2)), licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). The input redistribution by **pedrosoandre/carros**, [commit 2d18dfd](https://github.com/pedrosoandre/carros/tree/2d18dfd9db96bbf0d9cffa949deaf7f571388cbf), declares prior weld, simplify, prune and meshopt processing. Rain City retains three key wheel maps at 1024px, resizes the other fifteen maps to 512px, renormalizes resized normal vectors, and repacks PNG images with explicit attribution. Geometry, source transforms, material names and physical material settings in the prepared asset are unchanged. This asset retains CC BY 4.0 separately from the game's MIT code.

BMW and Brembo names/marks belong to their respective owners; no endorsement or affiliation is implied. [License evidence and exact source chain](docs/sources/e30-coupe-license-evidence.json), [preparation, hashes and limitations](docs/sources/e30-coupe.md), [reproduction script](scripts/prepare-e30-coupe.mjs).

## Software and typefaces

- Three.js: MIT, three.js authors.
- Vite, TypeScript, and build dependencies: their included package licenses.
- Barlow and Barlow Condensed: Jeremy Tribby, SIL Open Font License 1.1.
- Rain City code, procedural characters, bicycles, fallback vehicles, bridge/boat/Robson terrace models and generated effects: original work, MIT (see LICENSE).

This game is independent and is not affiliated with Rockstar Games or Grand Theft Auto. No Rockstar assets are used.

## Rigged protagonist — CharacterCreator / MakeHuman / CC0

The clothed protagonist, 53-joint skeleton, skin/hair/clothing textures and twelve animation clips were exported from [CharacterCreator](https://github.com/kblood/CharacterCreator) by Kasper Olesen, using MakeHuman's CC0 system assets. Generated asset data is **CC0-1.0**, as explicitly granted in the upstream [license notes](docs/sources/CHARACTER-ASSET-LICENSE.md). The generator's GPL program code is not included in Rain City; this game loads a static GLB using Three.js and its own animation/pose controller.

The body was configured for this game, exported with baked proportions, short hair, T-shirt, jeans and boots, and fitted animations. In-game changes include a plain forest-green shirt, darker denim, 1.84 m scale, animation blending, hand/weapon attachments and bicycle pose fitting. Export settings are preserved in [rain-city-protagonist-settings.json](docs/sources/rain-city-protagonist-settings.json). The character is original to this configuration and does not reproduce a Rockstar character.

Pedestrian variations also use the male export above and a second CC0 female export with ponytail, hoodie, jeans and boots. The same generated-asset license applies. Its [settings](docs/sources/rain-city-pedestrian-settings.json) are preserved; runtime changes include clothing/skin colours, height/build variation and independently phased locomotion.

## Granville theatre details

Vogue Theatre's carving and Diana neon figure are cropped/adapted from [Vogue Theatre 2026.JPG](https://commons.wikimedia.org/wiki/File:Vogue_Theatre_2026.JPG), **Canmenwalker**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The carving is converted to grayscale and relit; the figure is isolated with an alpha mask. Both image derivatives retain CC BY 4.0. The theatre plaster maps are **Painted Plaster Wall** by **Amal Kumar**, [Poly Haven](https://polyhaven.com/a/painted_plaster_wall), CC0. Exact [sources and modifications](public/textures/theatres/SOURCES.json); [reproduction script](scripts/fetch-theatre-materials.mjs). Vogue and Orpheum geometry and text are original interpretations; [architectural references and limits](docs/sources/granville-theatres.md). Reference-only Orpheum imagery is not distributed.

## Commodore Ballroom imagery

The brick, woven-brick, tile-frieze and rosette maps derive from [Vancouver — Commodore Building pano 01.jpg](https://commons.wikimedia.org/wiki/File:Vancouver_-_Commodore_Building_pano_01.jpg), **Joe Mabel**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). They are cropped/resized, with mirrored masonry repeats and image-derived normal/roughness estimates, and retain CC BY-SA 3.0. The entrance sign derives from [The fabulous commodore ballroom neon (3683353819).jpg](https://commons.wikimedia.org/wiki/File:The_fabulous_commodore_ballroom_neon_(3683353819).jpg), **Ben Aston**, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), cropped/resized with a separate emission mask. These image derivatives are not covered by the code's MIT license. [Exact source records](public/textures/commodore/SOURCES.json), [reproduction script](scripts/fetch-commodore-materials.mjs), and [architectural references/limits](docs/sources/commodore-ballroom.md).

## Stanley coastal rock

**Rock Face 03**, photography **Dario Barresi**, processing **Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/rock_face_03), CC0-1.0. Three maps are converted to 2K WebP and projected/blended over steep terrain at runtime. Generic rock photography, not a Vancouver scan. [Exact sources](public/textures/cliffs/SOURCES.json), [reference and limits](docs/sources/stanley-cliffs.md), [reproduction script](scripts/fetch-cliff-ground.mjs). GeoTour reference photographs are not distributed.

## Prospect Point and seawall

The lighthouse geometry is an original interpretation of its OSM footprint and public reference photography; reference photos are not distributed. Seawall/railing centreline data is © OpenStreetMap contributors, ODbL. **Japanese Stone Wall**, Charlotte Baglioni (photography), Dario Barresi (processing), Rico Cilliers (tiling), [Poly Haven](https://polyhaven.com/a/japanese_stone_wall), CC0-1.0, supplies converted 2K masonry maps. **Herringbone Pavement**, **Charlotte Baglioni**, [Poly Haven](https://polyhaven.com/a/herringbone_pavement), CC0-1.0, supplies 2K paving maps. [Sources and interpretation limits](docs/sources/prospect-seawall.md), [exact material records](public/textures/seawall/SOURCES.json). Polygon clipping uses `polygon-clipping` (MIT), with [MIT notice](public/licenses/polygon-clipping-MIT.txt), [splaytree MIT notice](public/licenses/splaytree-MIT.txt) and [robust-predicates Unlicense](public/licenses/robust-predicates-Unlicense.txt).

The coastal broadleaf model uses **Shrub 04** leaf photography/material maps, **Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/shrub_04), CC0-1.0. Its 240-leaf cluster geometry is original Rain City work under MIT. Two seamless leaf-cover image derivatives retain CC0. Original retaining walls and forecourt are photograph-guided interpretations; reference images are not distributed. [Source, reproduction and limitations](docs/sources/prospect-bank.md), [model provenance](docs/sources/coastal-plant-assets.json), [texture provenance](public/textures/coastal/SOURCES.json).


## Convention Centre West

Building geometry, roof planting layout, foyer scenery, glazing and waterfront deck/rails are original Rain City interpretations (MIT), guided by LMN/DA Architects photography and the City’s 2006 development drawings. Photographs and drawings are reference only and are not distributed. Existing OpenStreetMap footprint/path data retains ODbL; reused Poly Haven cast-concrete, aerial-grass-rock and painted-wood maps retain the CC0 notices above. The wood maps approximate timber grain and are not scans of this building. [Architectural sources, mapped routes and limitations](docs/sources/convention-centre.md).

## Jack Poole Plaza and Olympic cauldron

The plaza, café, planted roof, mapped stair/ramp construction and cauldron are original game geometry informed by owner, landscape architect and structural-engineer references. **Digital Orca (2009), Douglas Coupland**, is represented by an original simplified voxel interpretation; the sculpture design is credited to its artist. Reference photography and third-party sculpture meshes are not distributed. The fresh OSM map extract remains © OpenStreetMap contributors, ODbL 1.0. Existing Poly Haven CC0 materials are reused. Delaunator 5.1.0 is distributed under the [ISC notice](public/licenses/delaunator-ISC.txt); robust-predicates retains the [Unlicense notice](public/licenses/robust-predicates-Unlicense.txt). [Sources, elevation interpretation and limits](docs/sources/jack-poole-plaza.md).


## Fairmont Pacific Rim

Original tower/podium geometry, interior scenery, palms and generated branch-pattern texture are Rain City interpretations (MIT), guided by James K. M. Cheng Architects, DIALOG, RDH and Zahner references. The real forest metal façade derives from James Cheng’s photography; our generated drawing does not reproduce that photograph. The real text artwork is by Liam Gillick; the current game uses plain architectural bands and does not distribute an artwork texture. Reference photographs are not distributed. Eight mapped OSM outlines and heights retain © OpenStreetMap contributors / ODbL 1.0. Existing Poly Haven cast-concrete maps retain CC0. [Sources, reproduction and limits](docs/sources/fairmont-pacific-rim.md); [generated pattern provenance](public/textures/fairmont/SOURCES.json).


## Rogers Tower and Light Art

Original tower, podium, balcony, window-depth and outdoor pool geometry are Rain City interpretations (MIT), guided by Westbank and Vincent Helton photography. Architecture: **James K. M. Cheng Architects**, landscape: **PFS Studio**. **Diana Thater, Light Art (2005)** is represented by simplified original geometry and green-to-blue light, coloured fins, reflecting water and mist. No artist media, reference photographs or third-party tower meshes are distributed. Michael / sagamiono's CC BY 2.0 photograph was viewed as reference only. The seven OSM outlines retain © OpenStreetMap contributors / ODbL 1.0; reused Poly Haven materials retain CC0. [Sources, reproduction and limits](docs/sources/rogers-tower.md).

## Harbour Green Park

Original park, fountain, stair, furniture, lawn and sign geometry/artwork are Rain City interpretations (MIT), informed by City of Vancouver, PWL Partnership, Vincent Helton and Darwin Construction references. Reference photographs are not distributed. The fresh OSM extract retains © OpenStreetMap contributors / ODbL 1.0. **Grass Ground** and **Granite Tile**, **Charlotte Baglioni / Poly Haven**, provide CC0-1.0 diffuse, normal and roughness maps converted to 2K WebP; lawn colour is adjusted toward green. Generic materials are not site scans. Reused CC0 paving, stone, concrete, timber and shrub assets retain their existing credits. [Sources, reproduction and limitations](docs/sources/harbour-green.md); [exact asset provenance](public/textures/harbour-green/SOURCES.json).

## Harbour Green tower exterior geometry

One, Two and Three Harbour Green use 19 OpenStreetMap podium/upper-part outlines (© OpenStreetMap contributors, ODbL 1.0) with original modeled facades. ASPAC exterior photography informed shapes and materials but is not redistributed or used as game textures. Overall heights follow ASPAC's published dimensions, with the conflicting source tags retained. Existing credited concrete maps are reused. [Sources, reproduction and interpretation limits](docs/sources/harbour-towers.md).

## Corrected broadleaf tree surfaces

The near and medium street/park trees derive from [Poly Haven Tree Small 02](https://polyhaven.com/a/tree_small_02), CC0. Both retain all 30,250 connected leaf components, use per-leaf 3D simplification with original UVs/normals and corrected winding, and reuse WebP-converted source maps. The near model has 741,374 triangles; the medium model has 206,013. [Sources, geometry audit, reproduction and limits](docs/sources/street-trees.md). Exact file hashes are in the asset manifest.

The medium street tree also uses a source-UV alpha mask and fitted leaf cards, with original connected patches retained where fitting fails; the full near trunk and branches remain unchanged. This derivative retains Poly Haven CC0. Reproduction and coverage limitations are in [street-tree sources](docs/sources/street-trees.md).

The source-derived broadleaf volume atlases and both simplified woody models retain Poly Haven Tree Small 02's CC0 license. Atlas baking, normal transformation, source-root anchoring and runtime geometry are documented in [broadleaf volume sources](docs/sources/broadleaf-volume.md). The model is generic foliage, not a scanned Vancouver species.

## Ironworkers eastern bridgehead workshop

The source-registered workshop w23776223 preserves its OpenStreetMap outline (© OpenStreetMap contributors, ODbL1.0). Its roof registration uses District of North Vancouver 2024 orthophotography: **Contains information licensed under the Open Government Licence - North Vancouver.** No aerial or contractor photograph is shipped as a texture. [Sources, bounded export, model estimates and checks](docs/sources/ironworkers-eastern-workshop.md).


The adjacent paired repair shed w23776220 also retains its exact OpenStreetMap outline (ODbL1.0). Retained aerial and contractor views informed original roof geometry only; their photographs are not shipped. [Registration, estimates and native visibility limits](docs/sources/ironworkers-paired-repair-shed.md).

## North Shore diagnostic orthophoto colour — DNV2013

**Contains information licensed under the [Open Government Licence - North Vancouver](https://geoweb.dnv.org/data/).** The [District of North Vancouver Orthoimagery2013 dataset](https://geoweb.dnv.org/data/metadata.php?dataset=ImgOrthoimagery2013) provides the forward-slope colour crop. Its publicly served NAD83 UTM10N cache is resampled to a geographic2048×504 WebP with conservative exterior coverage fade. Photographed June2013 snow and baked shadows remain; this is not measured albedo. [Source/licence/reproduction and limits](docs/sources/north-shore-ortho.md), [public manifest](public/textures/north-shore-dem/DNV-SOURCES.json). Only the diagnostic DEM uses this asset; default panorama is unchanged. DNV2024 imagery was inspected for research but is not included.

## Gallery west terrace concrete

The Gallery west planted terrace uses a joint- and tie-hole-free derivative of **Concrete Wall 009**, Charlotte Baglioni / [Poly Haven](https://polyhaven.com/a/concrete_wall_009), **CC0-1.0**. The committed source maps are cropped, mirrored with normal-sign correction and compressed; this generic material is not a Gallery scan. [Derivative provenance and hashes](public/textures/gallery-west-concrete/SOURCES.json), [regeneration script](scripts/prepare-gallery-west-concrete.mjs), [scope and scale limits](docs/sources/gallery-west-concrete.md).
