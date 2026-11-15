# Waterfront Centre exterior reconstruction

Target only OSM w143683980, Waterfront Centre/200 Burrard Street. Original procedural geometry; no reference photograph or unlicensed texture is shipped. Source-world centre approximately(344.199,-512.680), mapped ring retained, baseY0, height91.75m from cached OSM-derived metadata. This is not a surveyed height: City2009 matching previously reported88.6m. Cached26-level base-map metadata is not used for the facade schedule.

## Independent reference registration

- Cadillac Fairview, [Suite650 sheet](https://assets.cadillacfairview.com/m/79b711ef733ef8ab/original/200-Burrard-Suite-650.pdf), PDFp1 whole exterior and p2 floor-six keyplan; cached `artifacts/local/waterfront-centre-reference/cf-office-exterior.jpg` and `cf-floor-six-keyplan.jpg`. The plan labels Canada Place/top, Burrard/left, West Cordova/bottom. Its6,389sqft is the suite area, not the whole floor. It states21 office floors above food offerings, consistent with22 total levels. The PDF's2026 modification date is not a photo date.
- Jim Steinhart, [BCVD071](https://travelphotobase.com/v/CDNBC/BCVD071.HTM), [BCVD072](https://travelphotobase.com/v/CDNBC/BCVD072.HTM), [BCVCH073](https://travelphotobase.com/v/CDNBC/BCVCH073.HTM),2011, all rights reserved: whole tower/skirt, close lower drum and elevated context. Research only. Local images/provenance are in the same reference folder/downloads.json.
- CF [2024 construction guide](https://assets.cadillacfairview.com/m/3718756ea3b6db32/original/Waterfront-Properties-Construction-Improvements-Guide-2024.pdf), p9, verifies the office identity/address, not facade dimensions.

The continuous full-height rounded return belongs to the Burrard/Cordova corner, mapped points6→7→8→9→0. Canada Place points1→2 stay flat. The pale skirt climbs away from the rounded corner along the adjoining flats, continuing at its maximum crest on Canada Place/east. The small lower glazed drum is separate at the eastern Cordova corner around points4/5. Do not move the main curve toward the NE camera or confuse this building with the neighbouring Fairmont Waterfront.

## Authored geometry and estimates

`waterfront-centre-site.ts` preserves the mapped footprint and supplies a smooth24-segment corner through the source polygon, with a slight300mm inward allowance. Main flat vertices inset approximately2.1m to leave supported ledges: the former uniformly.686-scaled upper tower is not retained. Upper glass has smooth interpolated corner normals; pale punched-window faces retain planar reveal normals.

Height comprises an estimated5.5m taller ground zone plus21 equal4.107m office divisions, ending at91.75m. Slender52mm tower mullions,70mm horizontal edges and320mm spandrels are distinct from the skirt's480mm pale piers and430mm recessed square glazing with500mm jamb/head/sill returns. No random emissive windows or per-pane materials. Closed dark backing lies40mm behind upper glass and850mm inward at ground, behind the750mm-recessed lobby glass; it cannot occlude the latter.

The skirt has up to four square-window rows above ground and estimated one-floor crest steps9.61/13.71/17.82/21.93m. Each crest has a supported2.35m ledge, closed side returns and selective modest planted strips; plantings are schematic and are not a current tenant/garden inventory. The lower drum is an inside-footprint rounded/faceted return to13.7m with three glazing bands. Its exact dimensions are photo-fit estimates.

A continuous850mm-high mapped-footprint mineral footing supports the inset lobby/rounded columns and keeps the existing closed collision perimeter visually tangible. It is an inaccessible base, not a newly walkable terrace or a rise in the street datum. Curved ground supports use a6m cumulative arc-length rhythm, independent of24-segment tessellation; they must not become one pillar per glass segment. No accessible entrance/interior is introduced. Existing north approach/retaining support remains parent-owned; the Canada Place lower face stays opaque where the raised approach buries it.

## Integration and verification

`buildWaterfrontCentre(batch,building,materials)` returnsfalse for any other ID without emission. `ArchitecturalMesh`/Batcher produce eight bounded shared material groups; stone UVs use metres rather than stretched per-box0..1 coordinates. The dedicated material factory is separate; root's dispatch replaces the generic shell and owns a single static exterior reflection probe. No other building metadata, footprint or geometry is changed.

Focused tests read the real city ring and verify identity/height/floor anchors, in-envelope corner registration, finite vertex/normal data and winding, metric stoneUVs, actual tower and recessed square-window first hits/jambs, visible lobby glass ahead of backing, and continuous mapped foundation/roof support. Root owns old-shell exclusion/integration tests and native acceptance. Geometry dimensions between evidence anchors remain estimates; test success is not photographic parity or a claimed performance improvement.

Final local geometry budget:13,034 triangles in8 material batches. Seven focused
geometry tests and TypeScript pass. Cap UVs explicitly use metre scale, matching
walls and the material factory's2m repeat. Cumulative curve columns also exclude
5m at each flat-face transition to avoid doubled nearby supports. Independent
reference review accepted street/curve/skirt/drum registration and identified
the corrected lobby-backplane and column-spacing issues.

Native daylight review on 2026-11-15 compared the prior generic building and the
replacement from nearly identical ordinary first-person positions on Burrard
Street (280.08,0,-517.76) and the northeast pier (470.65,7.88,-578.91). The
Burrard camera crops the crown; the pier view shows the flat north/east tower
and upper outline, partly framed by the conservatory. A separate Cordova view
checks the pale skirt and lower corner. Connected walking, car summon,
acceleration, braking and exit were exercised. An initial car encounter stopped
against traffic; subsequent steering/reverse movement cleared it. This is not
a comprehensive traffic-navigation test. Runtime warnings/errors were empty;
all 23 scene reflection captures completed without error.

All 411 tests (including 11 new geometry/material/integration checks) and the
production build passed. A quiet 20-second native sample at the pier on Balanced
at 723×670 and pixel ratio1.35 averaged25.53fps, with33.4ms median,50.4ms p95,
51.9ms p99 and66.9ms maximum frame time. There is no equivalent quiet baseline
for this pass, so no FPS improvement or isolated draw-call delta is claimed.
The closed lobby, simplified reflection field, neighboring generic buildings,
crowd animation and sustained frame pacing remain substantial quality gaps.
Local images/profiles and the full logs are under
`artifacts/local/waterfront-centre-*`; research photographs are not distributed.
