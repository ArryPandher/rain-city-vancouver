# Robson mound stairs and soil shoulders

Original bounded reconstruction,2026-11-15. Existing OSM path coordinates establish topology; no contour/tread survey was recovered. No reference photograph is a runtime asset.

## Source anchors

`artifacts/local/robson-realism-reference/local-garden-map.json` and the registered aerial identify three actual **steps** traces, indexed 33/35/37 in that local research extract. The main trace is (−129.451401,49.87)→(−122.951401,59.37)→(−123.451401,69.87)→(−119.451401,73.37)→(−119.451401,76.87). A branch connects its central junction to (−132.451401,71.87); the southern exit runs (−128.951401,87.37)→(−133.951401,87.87). Two mapped footways,16/17, connect these flights and the surrounding garden routes. These local extract indices are **not invented OSM way IDs**. The shipped map does not provide IDs for these records.

[CSLA Robson Square](https://www.csla-aapc.ca/mission-areas/robson-square), `csla-mound.png`, establishes winding slab paths meeting lawn and mature planted banks. [TCLF](https://www.tclf.org/robson-square), Charles Birnbaum 2019 `tclf-078.jpg`, establishes short concrete garden flights and generous landings; its exact photographed flight is not conclusively registered to a particular mapped trace. `tclf-066.jpg` shows the connected paved seating setting. The independent review explicitly excludes unrelated plaza “stramps” as automatic mound evidence. Image licences are not assumed open; research only.

## Coherent estimated vertical section

The earlier smooth mound was an invented contour inside a vegetation polygon, not surveyed civil ground. It put one 10.5 m stair at a 6.16 m rise and the connected footway at inconsistent heights. Preserving that guess would require either compressed ladder-like treads or deep retaining trenches, neither supported by the photographs.

The final main junction heights are 0/.8331/3.50/3.85/4.20 m; the loop footway descends 4.20→3.40→2.95649 m. The west branch joins the existing 1.7913 m point and continues to grade. The full 5.02494 m southern exit accommodates 17 approximately 174 mm risers and 296 mm treads; its landings lie on the connected footway before it and the grade path after it, rather than consuming the tagged flight length. Other flights include 1.15 m terminal landings and a 1 m intermediate landing on the longer substantial climb. All risers are 160–180 mm; all tread runs at least 296 mm. Non-stair running grades are at most 12.04%, an estimate for a garden path, **not an accessibility certification**.

These heights, widths and tread counts are authored interpretations. XY centre lines remain exact to the decoded map. Stairs retain the existing 2 m width, footways 1.8 m; broad circular joint landings have maximum 2.2 m diameter. They do not imply that a full-width car fits every narrow garden stair. Existing lower Robson stairs, gallery entry and other routes remain untouched.

## Terrain and contact

`robsonMoundCirculationTerrainHeight` uses the original contour only as a normalized broad shape, with a **4.6 m maximum soil target** blended into the validated tread-free path envelope over at most 4.8 m inside the mapped outline. Continuous compact inverse-distance weights blend overlapping shoulders without a nearest-path switch. A boundary fade retains grade zero. There is no compact crest bump or forced peak coordinate; the high path is 4.2 m, leaving at most about 0.4 m of adjacent lawn above it.

This replaces the visually rejected two-peak candidate. Its old 7.62 m field survived between lowered paths, and an added localized crest adjustment preserved another summit. Native whole-view evidence showed conical banks unlike the gentle lawn/path relationship in the CSLA photograph. The 4.6 m target is a bounded visual-fit estimate, not surveyed elevation.

The datum remains uncertain. CSLA says “Perched almost eight metres above the plaza level”; TCLF says “At grade level, a twenty-five-foot-high grass mound ... curves towards a sunken plaza.” Neither identifies our modeled upper-ground zero or establishes civil contours inside this mapped vegetation polygon. It would be incorrect to claim both unambiguously measure from the sunken plaza, or to force their numerical height above every upper-ground perimeter. Existing stairs retain their native-validated heights and exact mapped XY; the revised soil must be judged from the same ordinary whole view and upper loop before acceptance.

Residual retained step edges receive finite-height actor/camera checks. There is no infinite obstacle over the route and no new high retaining trench. Terrain, planting roots and clipped path edges share this soil getter.


## Integration contract

- `robsonMoundCirculationHeight (x,z)` returns the exact owned tread/landing/footway surface, or undefined. Use before the shared terrain getter in collision.
- `robsonMoundCirculationTerrainHeight (x,z)` supplies mound soil, roots and vegetation; it calls the original contour as a base and does not recurse through collision.
- `createRobsonMoundCirculationGeometry ()` emits one metric-UV concrete assembly. Geometry and height use the same **disjoint polygon ownership**, with node landings partitioned away from stair interiors. No duplicated coplanar top slabs or analytic-circle/polygon mismatch.
- `clipRobsonMoundCirculation (geometry,height?,offset=0)` removes old mound/path surfaces from the exact owned polygons, preserving interpolated UVs and normals. Optional height resamples retained path vertices; use a continuous soil/global ground sampler before the adaptive path fitter, not a discontinuous tread sampler. With no height callback, original heights are preserved barycentrically.
- `robsonMoundCirculationBlocked (x,z,r,y,camera=false)` checks finite retained edges. It leaves the interior walking centre lines clear; cameras above the actual top can pass. Runtime capability/region activation belongs to the parent integration.

Geometry adds 2,928 triangles in one shared concrete material. Focused tests raycast every flight across its width, examine dense joint/corner samples, reject overlapping top areas/duplicate top hits, verify old terrain is clipped, preserve UV/normal attributes, test finite boundary barriers, and bound risers/treads/non-step grades and source perimeter and bounded soil shape. The source footprint itself may be a vegetation outline rather than a surveyed mound toe; that uncertainty is explicit and is not resolved by these geometry tests.
