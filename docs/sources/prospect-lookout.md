# Prospect Point lookout terraces

The upper plaza, stair routes and fence follow a fresh [OpenStreetMap map extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.1442,49.3125,-123.1413,49.3142), retrieved 2026-11-14. The derived coordinates and tags are committed in `src/world/prospect-lookout-map.json`, with the response SHA-256 and © OpenStreetMap contributors / ODbL 1.0 attribution. Reproduce with `python3 scripts/prepare-prospect-lookout.py`; `--cached` uses the local XML response.

The concrete upper plaza is way **1158086219**, its mapped fence is **361265984**, and the connecting steps/paths are **190392418**, **190392419**, **190392424**, **361266150–153** and **1158086217**. The map identifies Lowden's Lookout nearby. The existing compiled routes remain available for navigation; the generic road ribbons at these IDs are replaced by constructed surfaces.

Reference photography reviewed:

- [Prospect Point operator](https://prospectpoint.com/galleries/) and its [2026 view-deck image](https://prospectpoint.com/wp-content/uploads/2026/08/Prospect-Home-CTA-Desktop-856x482.jpg): angular black picket railings, timber viewing surface and visitor-scale proportions. The precise location of that timber deck was not established, so it was not substituted for the explicitly mapped concrete plaza.
- [Capilano Group's Prospect Point property](https://capilanogroup.com/properties/prospect-point/): current café exterior, exposed canopy structure, timber patio and visitor furniture. The café is not rebuilt in this checkpoint.
- [Bridge and Tunnel Club's historical Prospect Point gallery](https://www.bridgeandtunnelclub.com/bigmap/outoftown/canada/britishcolumbia/vancouver/stanleypark/prospectpointlookout/): lower semicircular paved court, stone piers, metal rails and raised planting. These photographs predate the 2009 restoration. They inform original lower-court detail, not a claim that every detail still exists today.

Reference photos remain local and are not distributed. Original geometry/code uses the repository's MIT license. Concrete, stone and bench timber photography reuse the existing attributed CC0 assets (including Rob Tuytel’s White Planks Clean, tinted for the benches); no new texture or model downloads are needed.

## Construction and playable access

The upper plaza is interpreted at 66 m, the main intermediate landing at 61.4 m, the lower connecting path at 58.4 m and the lower court at 56.3 m. These levels are construction choices guided by the approximate 2002 contour surface, not surveyed elevations. Four stair flights have risers no greater than 17 cm. Actor height uses the actual flat tread at each horizontal position. Mapped connecting paths use asphalt, with rounded caps keeping the path corners at their construction level. The small planted island also supplies its raised walking height. Visible surfaces are partitioned so adjoining levels cannot draw overlapping floors. The underlying terrain is cut out, and perimeter stone faces connect each exterior edge to the original terrain, including terrain-triangle and tread breakpoints.

Black railings, stone piers and original benches provide scale. Stair-rail ends leave room to turn onto the mapped connecting paths. Collision barriers agree with the visible rails; generated foliage is excluded from constructed areas. Both mapped approaches to the lower court remain open. Cars and bikes remain usable on the approach roads and seawall.

## Limits

The upper outline and routes are map-derived, but structural thickness, stair count, construction grades, lower-court perimeter, furniture placement and planting are interpreted. The lower court is based partly on historical images. This does not establish a current measured reconstruction or AAA fidelity. The café, exact timber viewing deck, detailed regional canopy and more natural cliff transitions remain further work.
