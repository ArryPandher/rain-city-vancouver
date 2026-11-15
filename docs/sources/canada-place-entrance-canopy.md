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

## Whole-frontage visible depth revision — 2026-11-15

This section supersedes the earlier opaque-glazing/three-batch rendering description; source selection, coordinates, exterior profile and closed public footprint remain unchanged. The whole 51.8732m HOTEL15→16 frontage receives the same treatment, with no arbitrary material transition near the south end.

The original full-resolution Rabich photograph (`rabich-west-2022.jpg`,6462×3635) was inspected at the south entrance return, approximately pixels x4230–5980/y2450–3630. Unlike the smaller review image, it clearly shows deep pale curved members, short bearing connections and inboard uprights through the green end glazing. These are hotel-conservatory details; they are not evidence for copying an identical grid onto the separate hall concourse. The visible recurrence supports a coherent structural rhythm, but exact member dimensions and full longitudinal spacing remain estimates.

The new construction uses the existing every-fourth exterior rib rhythm plus both ends: eleven structural planes, primarily about5.32m apart, with a shorter final bay. Each contains a closed100mm-wide curved web extending50–280mm inward from the retained glass surface (230mm structural depth). The vertical lower portion bears directly on the existing sill floor. An inboard140mm upright at outward0.28m rises from sill8.65 to14.52 and joins the upper curved member through a short120mm crown connection. Two90mm longitudinal members connect the webs at existing spring/mid-curve levels. These estimated sections express the photographed structure without a dense independent interior grid, diagonal bracing or furniture. The end webs sit just inside the existing glazed end planes and join the existing perimeter framing.

The original full-width sill slab supplies the closed floor at sourceY8.65; its surface now uses a muted nonemissive lining material. A continuous inward-facing wall closes the volume on the original outward0 wall line from sill to crown14.8. The backing meets the existing curved crown; there is no rectangular ceiling spanning the convex envelope, and no duplicate coplanar floor. No original wall is restored immediately behind the curved panes. The original preflight and removal predicates remain byte-for-byte unchanged.

Glass geometry is divided only by physical orientation: the full convex front and two complete ends. Each retains its exact original positions, triangle topology and analytic/planar normals, and uses the shared canopy-specific attenuation/reflection pair supplied by `createCanadaPlaceCanopyGlazingPair` / `createCanadaPlaceCanopyGlazingMesh`. Both passes are transparent, depth-write-free and shadow-disabled. Opaque lining/frame/stone retain ordinary shadow behavior. Glass material calibration and native acceptance are owned separately; no new reflection capture is introduced here.

Measured cost is11,596 unique indexed triangles:1,326 front-glass,33 per end,10,180 frame/structure,4 lining and20 stone. The paired optical passes resubmit the1,392 glass triangles, totaling12,988 submitted triangles when all parts are visible. Six meshes use five shared materials and nine draw groups before any permitted opaque batching. No per-frame geometry generation is added.

The test owner retains source-pinned GLB removal, original exterior/end rays and route checks, and adds full-frontage backing/floor and inward-depth coverage. This implementation does not itself claim native acceptance or exact surveyed reconstruction; root performs the ordinary walking/oblique view comparison. The historical3m projection, sill/spring/crown values and complete source-edge extent remain explicitly approximate.

### Native acceptance of the depth revision

The final candidate was inspected in the existing Codex browser at the same southern-end comparison position as the opaque baseline: approximately (454.6, 7.88, −567.4), camera yaw 2.07, pitch −0.056, FOV 62. The former solid green end now shows connected ribs, inboard uprights and a floor receding through the conservatory. A 2.6 m lateral walk changes their relative positions; a roughly 41 m walk along the exterior reveals the same coherent treatment. Broadside viewing retains visible framing behind reflected clouds. No obvious open backing or floating connection was observed. Independent visual review accepted this as a meaningful improvement against Rabich, while identifying repetitive, simplified internal structure and the blank upper hotel junction as remaining gaps.

Native driving reversed approximately 58 m past the frontage, then returned approximately 64 m forward and braked to rest at the original deck height. Walking, entry/exit, pistol aim input/fire (14/180) and holstering passed; captured warning/error lists were empty. All eight focused canopy tests and the production build pass. The full release suite runs in the publish workflow. These checks establish the tested route and appearance, not exhaustive collision coverage or photographic parity.

At the southern-end diagnostic view, actual canopy attribution is three opaque beauty draws plus six glass draws, and three opaque shadow draws. Both glass passes have zero shadow submissions. The whole frame was 369 calls / 1,502,785 triangles; the earlier baseline was also 369 calls but 1,536,690 triangles. Small camera and population differences mean this is not a performance-improvement comparison. Geometry-only cost and the paired glass resubmission are stated above.

A 20-second stationary southern-end sample averaged 43.16 fps, p95 35.2 ms and max 216.1 ms; the diagnostic panel was being read at the start. A separate stationary car sample, with that panel collapsed and no further inspection until completion, averaged 39.82 fps, median 31.5 ms, p95 33.5 ms, p99 35.1 ms and max 35.2 ms, with no frames over 50 ms. Both used 723×670, pixel ratio 1.35, Balanced/day, unchanged start/end poses. The second view differs, so this does not prove the earlier hitch was diagnostic overhead or establish sustained smoothness. Future pacing checks should keep diagnostic inspection outside the sampled interval. Evidence: `artifacts/local/canada-canopy-depth-*` and `canada-canopy-before-*`.

Next, reconstruct the photographed overhang, soffit and adjacent louvered hotel facade above this conservatory. That broad blank junction now limits the whole gameplay view more than another isolated glass adjustment. Canada Place remains the first scene; Robson Square/Art Gallery, Granville and Stanley seawall, plus animation and sustained frame pacing, remain part of the active browser-only GTA VI/AAA goal.
