# Vancouver daylight gameplay target

User direction, November 14, 2026:

> Build a browser-only Vancouver game aiming for GTA 6–level, AAA world-class
> realism in ordinary daylight walking, driving and shooting. Prioritize Canada
> Place and its sails, Robson Square and the Vancouver Art Gallery, Granville
> Street, and Stanley Park's seawall. Match real Vancouver views with exceptional
> architecture, materials, lighting, vehicles and animation, creating
> jaw-dropping, clippable gameplay while keeping it smooth.

This is the target, not the current quality claim. The game remains a prototype.
The current renderer uses rasterized shadow maps, environment/reflection probes
and physical materials; hardware ray tracing is not implemented. Concentrate art
review on the existing Pacific daylight preset. No new photo mode or interiors.
Use only the existing Codex browser tab and one game instance for local review.

## Places and connected views

| Region | Recognizable scene | Ordinary gameplay route | Current source and remaining work |
| --- | --- | --- | --- |
| Canada Place | Five tensile white sails, terminal promenade, Pan Pacific massing, harbour and North Shore | Canada Place street approach, then the Canadian Trail promenade; continue west toward Jack Poole Plaza and Harbour Green | Existing mapped licensed landmark is an approximation. Check mast/membrane attachments, sail curves, terminal glazing, deck levels and waterfront foreground against the architect's exterior views. See `sources/canada-place.json`. |
| Robson Square / Vancouver Art Gallery | Former courthouse's copper dome and portico, terraced concrete gardens, broad stairs, planted edges and Law Courts glass roof | Walk the public garden's lower approach toward the gallery and traverse the terraces; drive on the adjoining city streets | Existing source-guided gallery and Law Courts models are approximate. Stair/terrace proportions and their relationship to the gallery need pedestrian-height comparison. See `sources/law-courts-robson-square.md` and `sources/vancouver-art-gallery.json`. |
| Granville Street | Vogue blade and marquee, Orpheum entrance, varied historic facades and overhead wires | Walk and drive the theatre blocks; use oblique storefront views to expose depth and repetition | Existing theatre geometry and licensed photographic details establish identity. Surrounding repeated storefronts, street width perception, vehicle variety and pedestrian motion still need work. See `sources/granville-theatres.md`. |
| Stanley Park seawall | Coastal forest, stone sea edge, exposed cliffs, water and North Shore; recognizable stretches around Brockton Point and Siwash Rock | Ride and walk connected seawall stretches from Coal Harbour, with driveable game access retained | Existing contour reconstruction and licensed vegetation establish a base. Rock silhouettes, edge/paving detail, plant scale and loading transitions need route-based review. See `sources/stanley-terrain.md`, `sources/stanley-cliffs.md` and `sources/stanley-forest.md`. |

Harbour Green remains the first detailed comparison area within the connected
Canada Place–Coal Harbour route. Cambie Bridge, the Ironworkers Memorial Bridge,
Gastown and other mapped landmarks remain part of the wider game. The four
regions above receive the concentrated fidelity work first.

The Canada Place front entry and western Canadian Trail now connect to an
estimated elevated Howe/Canada Place approach. Native local walking has reached
the sail-side promenade and returned through the same opening. The source hotel,
exhibition halls and private terraces remain closed. See the
[connection checkpoint](CANADA-PLACE-APPROACH.md) for geometry, tests and limits.
The earlier [access audit](sources/canada-place-access.md) records the original
whole-pier blocker. Photographic facade/paving correspondence remains unfinished.

The [City seawall guide](https://vancouver.ca/parks-recreation-culture/seawall.aspx)
establishes the continuous waterfront route. Destination Vancouver's
[coastal walks guide](https://www.destinationvancouver.com/inspirations/outdoors/9-scenic-coastal-strolls-in-vancouver)
identifies the Coal Harbour connection from Canada Place to Stanley Park, with
the Convention Centre, The Drop and Olympic Cauldron along it. The official
[Stanley Park map](https://vancouver.ca/files/cov/stanley-park-map-and-guide.pdf)
provides route/landmark context. These are location references, not downloaded
game art. GTA screenshots supplied in the chat establish an art-quality target;
their Miami architecture, people and textures are not Vancouver source material
or distributed assets.

## Review standard

Match the camera height, view direction, relative scale and daylight conditions
of real reference photographs. Check at least six persistent structural anchors
before judging materials. Save source URL, commit, camera pose, viewport and
quality preset beside each comparison. Preserve visible mismatches; do not use
perspective warps, darkness or a high free camera to conceal them.

Review motion along a connected route: vehicle start/turn/brake, normal exit,
walking/stairs, aiming/fire and nearby NPC animation. Still images support that
review but do not prove gameplay quality. Retain the sustained 30 fps at 1080p
working target and five-minute performance gate from `QUALITY-ASSESSMENT.md`.
The latest short local samples remain below that gate; more objects alone are
not a successful fidelity improvement. Document actual frame distributions and
loading stalls, and maintain the named remaining gaps after each checkpoint.
