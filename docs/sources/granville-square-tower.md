# Granville Square tower: source registration and replacement

2026-11-16. Dedicated reconstruction of **OSM w128409618, 200 Granville Street**, independent of the completed Howe wing w208599553, PwC w138256216 and parkade w116527978. Native acceptance remains separate from geometric verification.

## Observed architecture and references

The generic renderer shrank the tower inside a 15 m podium and applied its shared thin square lattice, scattered lit panes and generic roof details. The owner aerial shows a full-height rectangular mass, substantial pale concrete piers with splayed window reveals, dark inset paired panes, a distinct louver course, two larger base levels, a continuous roof coping over a dark slit, mechanical enclosure and an offset air-traffic-control cab. The broad structural grid and intact mass are more important to identity than small ornament.

- [Cadillac Fairview complete aerial](https://assets.cadillacfairview.com/transform/f5d7a51c-9cdf-44b1-9d3f-aac40189536a/200-Granville-Aerial), cached `artifacts/local/granville-tower-reference/owner-aerial.jpg`, 2000×1500. Clear front and side elevations, raised plaza and full roof. Photo capture date unverified. `aerial-registration.jpg` marks row controls; `aerial-tower-crop.png` retains a larger architectural crop.
- [Owner Suite 310 floor plan](https://assets.cadillacfairview.com/asset/8f6916b5-d3c2-4a07-9574-d124a2dd5ab0/310-200-Granville-Floor-Plan.pdf), cached `owner-suite310.pdf`. The complete inset plan confirms **12 long-face bays and 8 short-face bays**, projecting tapered piers, and solid L-shaped corner piers. The larger partial plan confirms glazing sits behind the perimeter structure. `owner-floorplate-crop.png` is a reference crop, not a runtime texture.
- [Owner mezzanine brochure](https://assets.cadillacfairview.com/m/2c171932c117cfaf/original/200-Granville_Mezzanine_2024.pdf), cached `owner-mezzanine.pdf`, two pages. Its PDF metadata says modified February 2026; the text describes 28 floors and the larger mezzanine connects into the adjoining complex. This does not authorize reconstructing those adjacent interiors. The URL's 2024 does not date the photograph.
- [City building footprints 2009](https://opendata.vancouver.ca/explore/dataset/building-footprints-2009/), group 150928: main roof **165045, H132.98 m**; mechanical **161152, H141.22 m**; control cab **165377, H145.84 m**; auxiliary roof **166944, H138.58 m**. Cached raw records are `artifacts/local/canada-approach-buildings-reference/city-parts-150928.json`. Contains information licensed under the Open Government Licence – Vancouver.
- [SkyscraperPage height note](https://skyscraperpage.com/b7191/vancouver/200-granville-square) distinguishes the 375 ft/114.3 m main facade above Granville Square from the lower harbour ground; its several roof entries have mixed confirmation levels. This is a datum cross-check, not authority to substitute a total height blindly. The [VPL historical register](https://localhistory.vpl.ca/link/buildings1036) records 32 storeys while current owner marketing uses 28 and OSM uses 30. Those counts use uncertain conventions.

The photographs/PDFs are reference-only; no open photographic texture licence is established, and no image from them ships in the game. Runtime minerals reuse the existing CC0 Canada Place material set. Map geometry remains © OpenStreetMap contributors, ODbL. No purchase or paid asset is involved.

## Plan and elevation registration

The retained live quad, in x-east/z-south game metres, is:

| Corner | x | z |
| --- | ---: | ---: |
| A | 575.548599 | −426.130000 |
| B | 559.048599 | −386.630000 |
| C | 531.548599 | −398.130000 |
| D | 549.048599 | −438.630000 |

A–B and C–D are the 12-bay faces, lengths42.808/44.119 m; B–C and D–A are the 8-bay faces, lengths29.808/29.300 m. This approximately1.47 aspect agrees with the plan's12:8 rhythm. The slight trapezoid is retained from the live footprint; the builder does not invent the generic procedural setback. The principal City roof extends roughly1–5 m beyond that live envelope. A bilinear map from its four principal corners to the retained quad registers the higher roof polygons while preserving their relative arrangement. All registered roof parts are wholly inside the live tower. Raw and registered rings remain in `granville-square-tower-parts.json`; `plan-registration.svg` is the research comparison.

At original aerial x934–942, dark opening runs y319–343,351–375,383–406,415–438,447–470,478–501,510–532,541–563,572–595,604–625,635–656,665–687,696–717,727–748,757–778,788–809,819–839,849–870,880–900,911–931,941–962,972–992,1003–1023,1034–1054,1065–1084,1096–1115,1127–1146,1158–1177 identify **28 body rows**. The fifteenth from the top is the visible broad louver row. Two larger base bands sit below. This **28 body plus 2 base** interpretation describes visible geometry, not verified operational floor numbering. The two observed faces share the rhythm; continuation on hidden faces is a symmetry inference supported by the full floor plan.

## Shared datum and bounded uncertainty

Use the established district conversion `worldY = published H − 7.52`: main roof125.46, mechanical133.70, cab138.32 and auxiliary131.06 m. Their +8.24/+12.86/+5.60 m relationships are preserved. The narrow mast is an explicitly inferred4 m extension above the cab; the aerial establishes a mast, not its surveyed height or instrument inventory.

The current live tower centroid terrain is6.9255 m. Thus the main roof is118.5345 m above current ground, approximately4.53 m taller than the former generic114 m extrusion. The difference is **not** silently repaired by moving the public plaza: the114.3 m reference implies historical plaza H18.68/world11.16, about4.23 m above current terrain. This is a material unresolved plaza/ground registration difference. The tower uses the better-supported City absolute roof and closes against the existing gameplay ground. Neither adjacent support nor the parked/walking route changes; a future raised-plaza reconstruction would need separate source/collision work.

The main body begins10.8 m above the caller's centroid ground; base divisions are4.6/10.8 m. Body rows span to2.2 m below the main roof, followed by a coping/slit section. These lower proportions are bounded photo estimates. Do not describe them as surveyed slabs or doors. Each facade foot follows existing sampled grade, entering it by40 mm, so the existing slight ground slope leaves no open hovering edge.

## Authored geometry and integration

The upper apertures have400 mm front side margins,640/260 mm lower/upper stone bands,200 mm splay, and780 mm recess. Paired panes have a55 mm central bronze mullion. Every aperture has physical splayed sides/head/sill, rear lining and closed backing380 mm behind its pane. These section dimensions are modeling estimates informed by the visible depth and plan, not dimensioned construction details. The louver row has real shallow blades, not painted squares. The two base levels use larger closed glazing behind1.05 m reveals, with four structural bays per face. No interior route or opening is introduced.

The roof coping uses exact mitered inner points; main roof caps subtract higher parts. The control cab has a closed tapered support, outward-flared glazing and separate roof cap. Mechanical/cab/auxiliary polygons preserve their registered positions. No duplicated main roof remains beneath those volumes. Six materials batch the complete assembly: pale concrete, muted bronze, coated room glass, base glazing, backing and roof. No per-window material, light, emissive random window or draw is added.

Integration hook supplied in `granville-square-tower-building.ts`: `granvilleSquareTower(building, shell, materials, reflections, collision.baselineGroundHeight.bind(collision))`, before the generic architecture fallback. It gates only w128409618. The builder temporarily uses absolute world Y and restores the caller's batch offset. One shared facade reflection probe is supplied; no new texture resource is downloaded for runtime. Coordinator owns the shared dispatch and native street-level comparison.

## Verification and cost

Five focused tests pass, with all1,080 ordinary body apertures and40 louver apertures checked by actual rays across all four elevations. Additional checks verify exact map registration within1 nm arithmetic tolerance, unchanged neighboring ID dispatch, all roof-part polygon containment, deep sloped reveals, solid corner faces, both base glazing/opaque closure layers,80 graded footer rays, distinct City cap heights and removal of underlying main roof faces. Every stored vertex has finite coordinates/unit normals and lies inside the retained route boundary within50 micrometres of float-buffer quantization. TypeScript and scoped diff checks pass.

The complete tower is45,138 triangles in six merged material batches, below the65,000-triangle focused budget. This is an authored geometry cost, not measured browser frame time or visual acceptance. Native full-silhouette and ordinary Howe walking views remain pending. The raised plaza datum, exact unseen entrance layout and current roof instrument inventory remain explicitly outside this bounded reconstruction.

## Exact architecture dispatch integration, 2026-11-16

The hook is now installed in `architecture.ts` immediately after the existing Howe-wing dispatch and before the generic fallback. The tower's exact ID also bypasses the generic pre-dispatch foundation, because its own grade-following footers already close the complete footprint. A second generic foundation would otherwise be redundant and could hide a narrow strip of the low-side glazing. Other foundation exclusions and all neighboring dispatches remain unchanged.

Two integration tests execute the actual `architecture()` pipeline against converted live map/tag records and the real CollisionWorld. Only browser image loading and canvas rasterization are stubbed. The tower produces exactly one reflection registration, six batches and45,138 triangles, with no generic facade, roof, foundation or detail batches. A combined tower/Howe-wing/unrelated-building run preserves the finished w208599553 wing and actual generic garage w459134074 geometry buffers byte-for-byte against their isolated run, and leaves their source/collision records unchanged. TypeScript passes. The integrated candidate has not yet received native visual acceptance or a production build in this subtask.
