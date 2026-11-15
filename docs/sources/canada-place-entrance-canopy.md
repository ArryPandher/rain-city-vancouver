# Canada Place west entrance conservatory

2026-11-14. A bounded, photo-guided entrance envelope on the complete HOTEL15→16 west segment. It does not reconstruct the full west exhibition-hall concourse or its stepped/nested curved glazing. That separate architectural work remains necessary.

## Anchors and evidence

- Codriver's CC BY4.0 source HOTEL ring supplies local endpoints(-138.049607,28.531185) and(-183.741826,53.088265), length51.8732m. Geographic placement © OpenStreetMap contributors. [Geometry source](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/geometry.js).
- Georeferenced aerial/source-ring overlay, `artifacts/local/canada-place-pedestrian-references/aerial-rings-review.jpg`, identifies the southwest entrance turn16/17 and north hotel tip13/14. Edge15→16 is the continuous hotel west elevation between these landmarks. Overhang obscures exact conservatory endpoints; covering the complete intervening source edge is an authored extent estimate.
- [Dietmar Rabich, 12 June2022 west entrance](https://upload.wikimedia.org/wikipedia/commons/7/7e/Vancouver_%28BC%2C_Canada%29%2C_Canada_Place%2C_Kunstwerk_%22Salish_Sea%2C_the_Journey_Within%22_--_2022_--_1863.jpg), CC BY-SA4.0, shows a bowed/sloping glazed entrance envelope, pale green framing and tinted panes. Cached `rabich-west-2022-review.jpg`.
- [TourbyTransit trail photo](https://cdn.tourbytransit.com/vancouver/images/Canadian-Trail-at-Canada-Place.jpg), cached `tour-trail.jpg`, shows lower glazing and a glazed canopy near the entrance. Old arch dates it before2021; signage is not copied.
- Historical Rayner architectural section, cached `rayner-section.png` printed75, and [BC Museums Association Roundup Fall2012](https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf), p21/Juan Tanus photo cached `museum-west-photo.png`, show that the exhibition-hall west concourse has THREE nested/stepped curved profiles. This corrects the earlier hotel-only interpretation of all west-side curved glazing. The single entrance envelope here must not be extended unchanged along all five SAILS faces.

The3m outward projection,8.65m sill,10.6m spring and14.8m crown are local artistic integration estimates, not measured building dimensions. The quarter-ellipse returns to the original hotel slab line. The existing .94-scale tier begins14.65 farther inboard and stays intact. No imagery is shipped as a texture or copied as a model.

## Geometry and API

Pure `canada-place-canopy-data.json` contains origin, local endpoints, local footprint and section parameters. The parent may import it in collision code without a rendering dependency/cycle.

- `canadaPlaceCanopyCompatible(originalScene)` validates counts and exact spatial removal on decoded/baked source geometry. Use before any source edits; failure keeps the original and skips the append.
- `replaceCanadaPlaceCanopyFaces(bakedGeometry, materialName)` removes2 concrete wall triangles,24 original flat glass triangles and156 trim triangles. The156 comprise12 original vertical bars and one horizontal bar. Only the HOTEL15→16 lower facade is selected. No original vertices move.
- `addCanadaPlaceCanopy(group, surfaceMaterialMap)` appends three static batches: opaque-backed green glazing with smoothly varying curve normals, physical pale-green ribs/rails, and mineral plinth/threshold/crown flashing. Closed glazed ends join the original wall line; a downward-facing crown underside and slab overlap provide contact. The base penetrates below the7.8m deck slightly to avoid a floating seam.
- `CANADA_PLACE_CANOPY_FOOTPRINT` and `CANADA_PLACE_CANOPY_WORLD_FOOTPRINT` provide the new CLOSED volume's footprint. The parent must add it to above-deck solids; opaque-backed glazing is not a walkthrough interior.

World footprint corners:
`(506.6488,-593.8090), (460.9565,-569.2519), (459.5363,-571.8945), (505.2285,-596.4515)`.

Approximately9.8k added triangles in3 shared materials; no per-frame geometry work or interiors. Existing pier, paving, hotel upper tiers/tower, SAILS facades, masts and sails remain untouched. Loader order is preflight original scene, then paving extraction, canopy face removal, existing west-SAILS face replacement, and append both new assemblies.

## Tests and acceptance

`tests/canada-place-canopy.test.ts` pins the committed GLB hash, decodes actual Meshopt positions, verifies exact source removal and unchanged unrelated primitive indices/vertices, and checks simultaneous paving plus existing SAILS replacement counts. Oblique rays from both directions hit the curved pane at three heights. End glazing and capped base are front-sided and ray-visible. Every sampled existing promenade route point stays outside the new footprint by more than0.95m and retains its original source support elevation.

Native review should use the entrance itself: a valid public-deck stand near `(480.489,-587.696)` looking southeast, yaw approximately0.493rad, frames the hotel segment. The previous531,-616 forward-sails view is beyond this segment and cannot demonstrate entrance canopy acceptance. Offline rays establish contact/clearance, not final photographic parity or native movement quality.

Parent integration registers one128px static harbour/city reflection capture for this glass through the existing SceneReflections system (and a separate one for the hall). Native oblique views confirmed the curved profile, grounded base and environmental response. Repeated forward walking stopped at the closed collision boundary; the promenade route stayed passable.
