# Gallery rear portico proportion and Ionic heads

Original exterior geometry, 2026-11-16. Source asset remains Codriver CC-BY-4.0 with existing OSM attribution; no source photographs become runtime textures.

## Evidence and corrected interpretation

The [official Gallery2023 rear photograph](https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg) and [Jason Vanderhill's2006 rear photograph](https://commons.wikimedia.org/wiki/File:Vancouver_Art_Gallery_Robson_Square_from_third_floor.jpg) both show **five rounded shafts with Ionic capitals and four banner bays**. The previous four-shaft/three-banner reading in the facade documentation was incorrect. The original source kit supplied only two outer columns; the earlier reconstruction added two instead of three inner columns. This pass corrects that count, rather than treating the previous interpretation as measured source evidence.

Inspection files are cached under `artifacts/local/robson-realism-reference/`; enlarged crops `gallery-portico-reference-review.jpg` and `gallery-rear-columns-2006-review.jpg` clearly separate the five shafts. The2022 Rabich close photograph corroborates the building's Ionic construction on the other frontage but is not used as a rear dimension control.

## Proportion fit and uncertainty

The old rendered horizontal cornice was only0.57m deep vertically (y13.48–14.05) over9.42m shafts (3.8–13.22). The real rear has a substantial plain frieze and stepped architrave, not a thin dentil stripe on long cylinders.

The oblique2023 control trace uses original854px coordinates: approximate pediment spring endpoints(272,371)/(464,320), apex(354,296), and bearing-line endpoints(292,404)/(465,357). Interpolating both horizontal architectural lines atx354 removes their across-image slope: spring349.22px, bearing387.16px, apex296px. Their same-station depth/rise ratio is37.94/53.22. Anchoring the existing2.7m pediment rise implies roughly1.93m for the entablature. The candidate uses2.00m, y12.05–14.05, with about±0.25m uncertainty from control selection, projective vertical convergence and projecting moulding depth. This is a shear-normalized elevation estimate, not a calibrated camera reconstruction or survey. Annotated inspection artifact: `artifacts/local/gallery-portico-proportion-trace.png`.

Retained source anchors are outer shaft centresu−8.8/4.95, column axisv23.5, original base top3.4212376, pediment centre−1.9, width18.1, spring14.05 and crest16.75. Five approximately equally spaced shafts fit the four repeated bays visible in both rear photographs; their source centres differ only25mm. Shaft shoulders now reach11.45; closed Ionic cushions/volutes/abaci bear at12.05. New banner tops11.55 and width1.9 fit four openings; artwork remains original identity text. Capital ornament is restricted to the visible scroll silhouette and stepped mass, with no invented figurative detail.

## Exact replacement and closure

`removeOriginalGalleryPortico` removes only repaired trim vertex ranges1162–1369 and1436–1643:712 triangles, comprising two old upper shafts, plain cap boxes and small source scrolls. The original scrolls sat behind the column axis and were not visible from the public rear. Both original plinth cylinders/caps (1096–1161 and1370–1435), all source stone/pediment triangles and every unrelated trim triangle retain their exact positions and indices. Changed counts/coordinate bounds fail closed. The existing facade preflight now requires the original trim1644-position/7560-index primitive alongside its previous materials. No GLB asset is edited.

Three interior plinths and all five closed shafts use the existing stone batch. The rendered shaft profile and contact share radius/height data. Capitals have solid rolled barrels and raised, capped spiral mouldings facing positivev. Closed architrave/frieze extrusion extends behind the column bearing into the retained wall; the projecting front, ends and underside are physical faces. Upper roof geometry, rear glass/probe, stair geometry, bistro, terrain and source floor data do not change.

## Walking and camera implication

The previous native endpoint local(u1.09248,v23.86440) is within36cm of the newly correct shaft at(u1.5125,v23.5). It must no longer be reported as a clear straight lateral route. Finite shaft/capital contact is delegated through the existing Gallery contact gate, with no global collision or floor changes. It also corrects ghosting through the existing outer column base.

A verified ordinary route across the upper treads is local(u,v):
(1.0925,24.5) → (2.75,24.5) → (3.0,24.1) → (4.15,24.1) → (4.15,24.5) → (6.1,24.5) → (7,24.5).
This passes around the shaft, through the existing rail gap, then around the outer base. Every60mm full-city movement sample passes; height changes stay under0.30m with ordinary step support and no forced promotion. The arrival-facing4.3m camera boom retains over80% clearance along the detour. The transverse ground route retains the existing source support/clearance. Root still must natively accept the new natural sidestep from a fresh walking approach; the earlier straight-D clip is historical evidence for the superseded spacing.

## Validation and budget

Focused checks prove exact old-triangle removal and retained vertex/index equivalence, changed-source rejection, five front-facing heads, four clear banner bays, capital bearing contact, closed oriented edges, unit finite normals, unchanged pediment crest, bounded material counts and full-city pedestrian/camera routes. The portico contributes7728 triangles in the existing stone batch; complete added Gallery facade/stair/bistro geometry is18690 triangles in7 draws. The previous two added shafts are removed from that assembly and712 old source triangles are removed. Banner count increases from3 to4 but remains two merged draws. No build, browser or full suite is run by this lane.

The missing east upper tensile terrace canopy remains a separate cap-registration proposal. It is not added in this pass.
