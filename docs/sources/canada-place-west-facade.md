# Canada Place west terminal glazing

2026-11-14. Scoped replacement of the five trail-facing SAILS podium edges in the existing licensed source asset. This improves geometric depth and window scale; it is not an as-built reconstruction or a claim of complete terminal fidelity.

## Evidence and limits

- [Codriver geometry](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/geometry.js), CC BY4.0; attribution Codriver, geographic placement © OpenStreetMap contributors. Cached in `artifacts/local/canada-facade/geometry.js`. It creates solid SAILS prisms7.65–17.65, glass0.2m outside, and thick projecting trim. Geographic ring data is already recorded in `canada-place-deck-data.json`.
- [TourbyTransit west-trail photograph](https://cdn.tourbytransit.com/vancouver/images/Canadian-Trail-at-Canada-Place.jpg), cached `artifacts/local/canada-place-pedestrian-references/tour-trail.jpg`. Inspected actual pedestrian view toward the sails. Shows fine green-grey framing, green-tinted curtainwall, lower-level glass and a sloping glazed canopy. The old Canadian Trail entrance arch dates the scene before its2021 replacement; no historic signage was copied.
- [Dietmar Rabich, 12 June2022 west entrance photograph](https://upload.wikimedia.org/wikipedia/commons/7/7e/Vancouver_%28BC%2C_Canada%29%2C_Canada_Place%2C_Kunstwerk_%22Salish_Sea%2C_the_Journey_Within%22_--_2022_--_1863.jpg), CC BY-SA4.0. Cached review image `artifacts/local/canada-place-pedestrian-references/rabich-west-2022-review.jpg`. Confirms pale green framing/tinted panes and upper glazing under a projecting roof. Its bottom crop cannot establish sill height. The curved/sloped entrance conservatory is distinctive; this pass neither removes an existing canopy nor claims to reconstruct that missing feature.
- The older architectural `canada-material-reference.jpg` includes hotel frontage; its particular window schedule is not transplanted onto the terminal.

The lower row8.65–12.15, .34m recess, .07m secondary members and approximately1.35m lights are authored metric estimates. The upper row retains the original source band15–16.7 (1.7m high), rather than enlarging it to equal the lower row without photographic support. A thinner slab-edge profile remains centred at the source14.35m datum within the intervening opaque spandrel. Primary divisions follow the source podium envelopes. The first edge is4.887m long; the remaining four are24.36–24.74m. This avoids assigning the same number of lights to a five-metre edge and a twenty-five-metre edge. The approximate two-row interpretation still needs native daylight evaluation against the real-world continuous glazing/canopy composition.

## Selection, integration and preservation

Source `public/models/vancouver/canada-place.glb` SHA-256 `1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe`.

1. `canadaPlaceFacadeCompatible(originalScene)` checks original position/index counts and the exact spatial removal counts after decoding/baking node transforms. Fail closed: keep the original and do not append the replacement when false.
2. On each baked local primitive, perform paving extraction first, then `replaceCanadaPlaceWestFaces(geometry, originalMaterialName)` if preflight succeeded. Removal edits indices only:10 concrete wall triangles,100 glass triangles,480 trim triangles. The source horizontal trim bars are rotated in cross-section and reach roughly .8m outward; the selection accounts for their actual decoded envelope rather than assuming an axis-aligned .3m half-width.
3. Collect surface-adjusted concrete/trim/glass materials into a name-keyed map, then `addCanadaPlaceWestFacade(group, materialMap)` in the same source-local coordinate group. Three cloned materials avoid changing the hotel or other Canada Place surfaces. Opaque-backed reflective glazing requires no interior or new probe. Frame textures are cleared so thin painted-metal members do not inherit masonry grain. Concrete retains source mineral maps/joint shader.

Only west edges[0]→[1] of the SAILS rings are replaced. The lower pier, upward promenade plane, opposite/east facades, hotel, end hall, steel/masts, fabric, glow and roof are retained. No collision or loader module was edited by this change. New geometry stays within the reviewed wall envelope except a restrained75–80mm sill/head projection, less than the removed trim projection.

Added geometry:4,266 triangles in3 material batches (wall1,242, glass84, frame2,940), replacing590 source triangles. There are42 recessed openings. No per-frame work or texture downloads.

## Verification

`tests/canada-place-facade.test.ts` decodes the committed Meshopt GLB and checks the source hash, exact removal counts, retained source-vertex arrays and ordered original triangle subsequences. It casts normal rays through every opening and oblique rays toward both jambs, heads and sills using FrontSide materials; the pane is the first hit at the intended depth, rather than a glass overlay over an opaque front wall. Source material properties remain unchanged.

The same test fixture extracts the new paving before facade removal, then compares original and combined-scene route-ray heights. All remain identical. Gallery preflight is rejected, and existing gallery tests pass alongside this suite. Native shallow-angle daylight inspection remains the parent task's acceptance step; these offline rays do not establish final visual quality.
