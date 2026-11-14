# Third-party credits and licenses

## Geographic data — OpenStreetMap / ODbL

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).

`public/data/vancouver.json` is a derived database extracted for Arry Pandher's Penguin Party on 2026-10-11. It contains public map geometry and public feature labels, not Penguin Party's private characters, personal notes, game content or server code. The data was converted to metres at runtime. Additional eastern Vancouver map data, when present, was obtained from the public Overpass API; the fetch script and source date are included. `public/data/vancouver-roads.json` replaces the rendered road layer with a consistent 2026-11-14 Overpass extract, retaining one-way, lane, width and sidewalk tags. Reproduce it with `node scripts/fetch-roads.mjs`; exact source timestamp and exclusions are embedded in the file. `public/data/vancouver-building-tags.json` adds current building-use, height and roof tags to matching footprints (source timestamp embedded; `node scripts/fetch-building-tags.mjs`). All derived geographic database files remain under ODbL. Building façades, procedural decoration and interpretation are not surveys.

## Public-tree inventory — City of Vancouver

Contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/).

`public/data/vancouver-public-trees.json` is a bounded extract of the [City public-tree inventory](https://opendata.vancouver.ca/explore/dataset/public-trees/), reprojected into local metres with species, recorded height and trunk diameter. It is a separate source layer from the OSM database. Empty planting sites, invalid coordinates and duplicate assets/positions are excluded. Crown width/form and the generic tree meshes are interpretations. Records can lag the current landscape and do not inventory private trees; no City endorsement is implied. [Source and reproduction details](docs/sources/vancouver-public-trees.md).

## Stanley Park terrain — City of Vancouver and OpenStreetMap

Contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/). The [City 1-metre contours](https://opendata.vancouver.ca/explore/dataset/elevation-contour-lines-1-metre-contours/) are an approximate **2002** product. `public/data/stanley-terrain.json` and `stanley-height.u16` combine the interpolated contour heights with OSM park, water and road geometry. The combined geographic derivative is distributed under ODbL, retaining City and OpenStreetMap attribution. Road grades, lake beds, seawall levels and the transition to the existing flat city are interpretations. [Source, method and reproducible export](docs/sources/stanley-terrain.md).

## Photography — Poly Haven / CC0

Asphalt 02, Concrete Pavement, Aerial Grass Rock, Belfast Sunset PureSky, Kloofendal Overcast PureSky, Kloofendal 48d Partly Cloudy PureSky, Modern Evening Street, Tree Small 02 detailed tree and foliage, Cobblestone Floor 05, Fir Tree 01 branches and bark, and additional architectural texture maps are from [Poly Haven](https://polyhaven.com), licensed [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Exact files and source URLs are recorded in `public/asset-manifest.json`. The broadleaf and fir branch cards are modified/cropped/composited from those photographs. Night reflections use **Modern Buildings Night** by **Greg Zaal** (CC0), as a generic lighting environment rather than visible Vancouver scenery. Reflection radiance is limited to prevent excessive panoramic lamp highlights; [source record](docs/sources/night-reflections.json).

Photographed shop rooms use **Comfy Café** and **Decor Shop** by **Sergej Majboroda**, and **Phone Shop** by **Philip Modin**, from Poly Haven under CC0. They are resized WebP panoramas projected into virtual room boxes behind the windows. These are fictional interiors and do not depict the actual Vancouver business at an address. [Exact sources and modifications](public/textures/interiors/SOURCES.json); [reproduction script](scripts/fetch-shop-interiors.mjs).

Nearby residential door and window geometry is extracted from **Modular Urban Apartments Facade**, **James Ray Cock**, [Poly Haven](https://polyhaven.com/a/modular_urban_apartments_facade), CC0. Selected parts are pivot normalized, scaled and instanced; textures are converted to WebP. [Source manifest](docs/sources/architectural-details.json) and [reproduction script](scripts/fetch-architectural-details.mjs). These details are generic architectural interpretation, not an address-specific survey.

Arthur Erickson Place uses original geometry and **Concrete Wall 009** photography by **Charlotte Baglioni**, [Poly Haven](https://polyhaven.com/a/concrete_wall_009), CC0. Its reference photographs are not included in the game. [Architectural references and approximations](docs/sources/arthur-erickson-place.md); [texture sources](public/textures/cast-concrete/SOURCES.json).

Small houses use **White Planks Clean** and **Grey Roof 01** by **Rob Tuytel**, [Poly Haven](https://polyhaven.com/a/white_planks_clean), CC0. Color, OpenGL normal and roughness maps are converted to 1K WebP, with original window masks and geometry. These are generic painted-wood and grey roof-tile materials; they do not identify the real material of each address. [Source records](public/textures/houses/SOURCES.json); [reproduction script](scripts/fetch-house-materials.mjs).

The Law Courts and Robson Square use original reference-guided geometry, the same CC0 cast-concrete material, and existing licensed foliage photography. Architectural reference images are not distributed. [References, map identifiers and approximation limits](docs/sources/law-courts-robson-square.md).

Stanley Park woodland uses **Fir Tree 01** and **Fern 02** by **Rob Tuytel / Rico Cilliers**, **Moss 01** and **Tree Stump 01** by **Rob Tuytel**, **Rock Moss Set 01** by **Kless Gyzen**, **Shrub 04** by **Rico Cilliers**, **Nettle Plant** by **Rob Tuytel / Rico Cilliers**, **Forest Ground 06** by **Charlotte Baglioni**, and **Leaves Forest Ground** by **Dimitrios Savva / Dario Barresi**, all Poly Haven CC0. Modified with selective geometry extraction, wood simplification, missing-UV repair, source-alpha restoration, WebP conversion, two conifer variants, needle sampling/flattening with coverage compensation, branch-normal refitting, four-view silhouette baking and depth-sliced color/normal foliage with branch-shaped geometry. Placement, canopy dimensions and density are interpretations. [Detailed source and reproduction notes](docs/sources/stanley-forest.md).

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
