# Pan Pacific Howe podium — bounded architectural reconstruction

2026-11-15. Runtime geometry replaces only the guarded source HOTEL southeast faces 36–40, across the lower, .94 and .80 podium tiers. The unchanged tower, source tier caps, neighboring faces, source PIER and existing west work remain integration anchors. This is an authored reconstruction inside the approximate source massing, not a measured as-built model or a claim of final visual acceptance.

## Reference and trace

Inspected original 2048 × 1713 `Handford-MCM-CanadaPlace-20-WEB.jpg`, locally in `artifacts/local/canada-place-pedestrian-references/`. [MCM project](https://www.mcmparchitects.com/projects/canada-place/), [photograph URL](https://www.mcmparchitects.com/wp-content/uploads/2025/09/Handford-MCM-CanadaPlace-20-WEB.jpg). The capture date is unknown. The source photograph is visual reference only; it is not included in runtime textures or licensed as part of the game. Existing Codriver CC-BY-4.0 / OSM geometry attribution and existing texture licenses continue to apply.

Photo coordinates below refer to the original image, before scaling or cropping. Two visible long-face slab/band lines were traced as `(996,941)→(1497,1100)` and `(990,1203)→(1485,1262)`. Their intersection estimates an along-face vanishing point `(2321.684,1361.726)`. This is an approximate manually picked perspective constraint. The source OSM line itself bends slightly, so the reconstruction maps a common normalized run independently to each preserved tier instead of flattening the full elevation onto one plane.

For a photo x coordinate and a pair of registered endpoint x coordinates, normalized station is:

```
u(x) = ((x - x0) / (vanishingX - x)) /
       ((x1 - x0) / (vanishingX - x1))
```

This corrects perspective compression; equal pixel gaps are not interpreted as equal metres. Endpoint correspondence remains inferred. Columns sit behind the slab face, so the column trace uses a separately registered projected line `(x0,x1)=(952,1484)`; the upper mullions use `(996,1497)`. Neither the source intermediate vertices nor an arbitrary equally spaced support grid determines the column positions.

| Support      | Capital/shaft contact pixel | Normalized traced station | Authored base-run metres | Certainty                                                                                          |
| ------------ | --------------------------- | ------------------------: | -----------------------: | -------------------------------------------------------------------------------------------------- |
| Near support | 955,1224                    |                   .003456 |                      .62 | Partly hidden by tree; traced centre would be .21m, moved .41m to keep capital inside retained end |
| 2            | 1102,1237                   |                   .193648 |                    11.98 | Visibly resolved                                                                                   |
| 3            | 1206,1248                   |                   .358477 |                    22.18 | Visibly resolved                                                                                   |
| 4            | 1294,1258                   |                   .524005 |                    32.43 | Visibly resolved                                                                                   |
| 5            | 1367,1267                   |                   .684474 |                    42.36 | Visibly resolved                                                                                   |
| 6            | 1431,1274                   |                   .846799 |                    52.41 | Visibly resolved                                                                                   |

A further small bearing around `(1465,1278)` is uncertain: it may belong to the far return rather than the long-face column row. It is not extrapolated into a seventh generic bay. A closed terminal cheek supports and closes the end. The hidden near bays are not populated with invented repeated columns. This treatment retains uncertainty rather than claiming exact structural bay count.

The long upper pane rhythm was individually traced at x positions `996,1020,1042,1066,1089,1109,1132,1152,1171,1189,1207,1224,1241,1257,1273,1288,1302,1316,1330,1344,1357,1369,1381,1393,1404,1415,1425,1435,1445,1455,1464,1473,1481,1489,1497`. These normalized boundaries continue through the upper bands. Exact pane counts in tree-hidden areas are uncertain.

The broad lower pale upper-podium wall has three separately resolved near window groups `(1078–1120)`, `(1135–1174)`, `(1187–1223)`, then a continuous divided farther group `(1237–1485)`. Using wall endpoints `(990,1485)`, their normalized ranges are `.11960–.18286`, `.20653–.27099`, `.29346–.35846`, `.38490–1`. Pale masonry remains between those groups. This distinction avoids recreating the inaccurate pair of uninterrupted source blue strips.

## Height and depth interpretation

The photograph shows, in order, a raised stepped base with terrace rails, substantial columns with expanded capitals, a recessed closed frontage and intermediate gallery, the projecting pale underside, a broad pale wall with isolated near window groups, then alternating pale belts and divided glazing. Column/beam contact and facade depth are geometry, not painted shadows. Four opaque roles and one glass geometry batch are returned independently of materials.

All y values below are source-local; the existing loaded landmark group supplies +.08m. World origin remains `(644.6983737463511, -622.3401999996099)` in x/z.

| Assembly                       | Authored local datum / depth                  | Status                                                                                      |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Retained PIER floor            | y7.7989358902                                 | Verified decoded source geometry; no added upward floor surface                             |
| Retaining face                 | y3.7→7.798936, original lower boundary        | Vertical closure below raised PIER; lower extent is a conservative terrain-overlap estimate |
| Lower guard                    | floor→floor+1.08, inset .14m                  | Photo-supported terrace type; height and exact registration inferred                        |
| Main shafts                    | floor+.18→13.66, radius .43→.405m, inset .69m | Authored dimensions fitted to source envelope                                               |
| Capital and bearing            | y13.66→14.26                                  | Physical collar, widening capital and square bearing                                        |
| Recessed closed frontage       | 2.8m inward                                   | Inferred depth, with sealed dark backing .45m behind glass                                  |
| Intermediate gallery           | y10.85, inset1.08→2.8m, .25m slab             | Photo-supported intermediate terrace; metric datum inferred                                 |
| Lower beam                     | y14.26→14.802531                              | Contacts retained lower prism cap                                                           |
| Middle tier                    | y14.648794→20.200424, .94 footprint           | Retained decoded envelope                                                                   |
| Isolated middle windows        | y15.73→17.82                                  | Photo proportions fitted to preserved source height                                         |
| Middle continuous divided band | y18.48→19.67                                  | Same fitted height interpretation                                                           |
| Upper tier                     | y20.046688→25.495827, .80 footprint           | Retained decoded envelope                                                                   |
| Upper divided glazing          | y20.62→22.08 and22.69→25.02                   | Pale belt separates the two glazing levels                                                  |

Upper glass is .14m behind the face with backing at .60m, ≥.46m cavity depth, physical jambs, transoms, mullions, sill returns and soffits. Pale bands project .045–.16m from each inset source tier, while all geometry remains inside the original lower HOTEL footprint. The source bends are mitered at shared vertices so every strip meets without daylight cracks. Both cut ends have full-height returns.

The raised original boundary remains legible as a retaining face and thin open terrace railing. This is not a claim that the colonnade is a newly playable route. The loader/collision owner must verify this architecture against actual Howe approach support and the unchanged full HOTEL collision before calling gameplay accepted. The local3.7 retaining bottom is intentionally conservative and must be checked in the ordinary view for excessive exposed plinth or contact errors.

## Verification and budget

`tests/pan-pacific-howe-podium.test.ts` verifies perspective-derived nonuniform support spacing; preservation of all source tier vertices; continuous mitered bends; rays through glass to closed backing with physical cavity depth; the opaque gaps between isolated window groups; no broad upward-facing added floor at PIER elevation; column-floor contact; and full-height near/far end closures. All six geometry tests passed. Type checking passed at authoring.

Measured geometry factory result: **10,814 unique triangles**, **300 panes**, **six long-face supports**, **five merged geometry batches**. The material owner's paired glass requires two optical submissions, making six material draws before shadows/integrated batching. This is a factory budget, not a complete scene performance measurement.

The coordinator owns source-removal guards, real GLB preservation/ray tests, capability/collision integration, normal third-person browser comparison, motion/drive/exit inspection, actual submissions, and final visual acceptance. Remaining unchanged tower and neighboring hall inaccuracies must be reported separately; unit tests cannot establish GTA-reference realism.

## Native-view correction: upper gallery wall

The first integrated ordinary third-person screenshot (`artifacts/local/podium-first-near.png`) showed a material architectural error: two continuous glass strips behind the columns made the lower assembly read as a generic curtain wall. Reinspection of the original photograph crop `(955,1210,545,155)` shows that the upper gallery backing is predominantly pale vertically panelled wall. The lower gallery has the narrower window strip. The correction removes the 34 upper-gallery glass panes at y11.02–13.48 and replaces them with closed pale wall panels while preserving the lower strip, all traced columns and all upper podium apertures.

Manual seam picks from unobstructed upper-gallery patches are recorded in `PAN_PACIFIC_HOWE_PHOTO_TRACE.galleryPanelSeamPixelsX`. Examples: near wall x970,979,987,995,1003,1011…1067; middle x1227,1233,1239,1245…1275; far wall x1377,1382,1387…1417 and1446,1450,1454…1478. These approximate fine seams compress toward the same vanishing direction. A separately inferred back-wall endpoint registration x970→1484 rectifies these picks. Intervals hidden by columns, planters or terrace masonry are filled at the median rectified observed pitch; those inferred seams do not claim a verified hidden panel count. The resulting 89 boundary stations create much finer wall panels than the large window panes elsewhere.

Panels have physical 18mm joints with a pale substrate 65mm behind the front face. They are closed shallow solids, not a new applied photo or a painted glass grid. The substrate uses the existing soffit material role, preserving five merged geometry batches.

A dark bounded upper rectangle is visible approximately `(1072,1233)→(1084,1256)`. Only that bounded feature is interpreted as a shallow opaque service recess, normalized u.13302→.15011, with metric height y11.95→13.30 fitted inside the unchanged gallery datum. Its lower continuation is hidden by terrace masonry; no door, transparent pane or accessible interior is inferred. Physical jambs/sill/head return to an opaque backing .40m behind the pale front face. No parking openings below the retained PIER were added.

The added ray test verifies that sampled upper-gallery stations hit closed pale geometry and no glass, that the single bounded recess hits its opaque backing, and that the lower strip and isolated middle-tier windows remain glazed. Eight combined geometry/material tests pass. Final visual comparison remains the coordinator's responsibility; this correction addresses observed architecture, without asserting final realism or changing the retained envelope.
