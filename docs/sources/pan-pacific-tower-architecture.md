# Pan Pacific tower — registered architectural replacement

2026-11-15. Replaces only the independently guarded complete source tower. The mapped podium cap, completed Howe podium, west work, sails and public circulation remain unchanged. Initial ordinary third-person native comparison shows a materially more recognizable asymmetric tower and facade hierarchy; final native acceptance belongs to the coordinator.

## Evidence and registration

References are the original MCM photographs [Handford20](https://www.mcmparchitects.com/wp-content/uploads/2025/09/Handford-MCM-CanadaPlace-20-WEB.jpg), [Handford16](https://www.mcmparchitects.com/wp-content/uploads/2025/09/Handford-MCM-CanadaPlace-16-WEB.jpg) and [Handford18](https://www.mcmparchitects.com/wp-content/uploads/2025/09/Handford-MCM-CanadaPlace-18-WEB.jpg), the cached Esri aerial export and its explicit Web Mercator extent, and Michael Rayner's _Urban Waterfront Renewal_ printed73/PDF76, which reproduces a labelled typical hotel floor from the historic Zeidler/Architectural Review plans. Reference files are in `artifacts/local/canada-place-pedestrian-references/`. Acquisition dates are not established. These images are research references only; no photograph becomes a runtime texture. Existing Codriver CC-BY-4.0 / OSM attribution and existing CC0 texture attribution remain.

The typical hotel plan and current photographs independently support a wider asymmetric southwest head, a narrow long body and a rounded northeast nose. They contradict the old hard-coded broad convex bow, whose width axis differs by roughly47° from the registered long body. The roof and podium were traced separately; the aerial's visible pool/terraces are not interpreted as the tower roof.

Review artifacts, prepared before runtime geometry, are `artifacts/local/pan-pacific-tower-registration.json`, `pan-pacific-tower-registration-aerial.png`, `pan-pacific-tower-registration-detail.png`, `pan-pacific-tower-registration-elevation.png` and `pan-pacific-tower-registration-historic-plan.png`. The aerial annotation distinguishes raw highest-roof pixels (yellow), exact retained cap (cyan), rejected original bow (red), and inferred ground-fit candidate (green).

The cached aerial maps approximately.343235m per pixel at the source origin. Two widely separated ground-waterfront direction changes, source PIER2 and PIER26, check the map registration at ground level; approximate picked pixels are(1025,361) and(527,997), versus projected(1023.34,359.88) and(523.15,993.64). They do not resolve elevated-roof parallax. The raw highest-roof trace is displaced from the source podium in this oblique view. Its candidate ground registration translates+60,-70image pixels, or approximately+20.59m east/-24.03m south. **This translation is an inferred cap-contact fit, not a measured displacement or surveyed tower location.** Alternative smaller shifts did not contain the complete candidate in the retained cap.

The accepted provisional upper plan has local bounds x[-168.925,-95.473], z[47.539,91.473], a long axis(cos28.6°,−sin28.6°), and a southeast axis(sin28.6°,cos28.6°). The near straight face is approximately23m across, with a separate faceted glazed return and a curved pale spine. The rounded nose uses the circular arc through traced controls I→L→N, sampled into20segments. The southwest curved spine uses an inward quadratic through its three controls; the complete ring has37vertices.

## Ground contact and silhouette

The exact retained cap is local **y25.495826721191406**, with44boundary vertices and42upward source triangles. The new tower starts at that datum and introduces no duplicate base floor or upward cavity-sill plane there. Glass cavity bottoms use the existing cap.

Three nested nose footprints create real terraces: lower depth/SE-width3m/1m, middle1.5m/.5m, upper0/0. Width increases toward the southeast along the arc while the constrained northwest endpoint remains registered. The lower and middle terrace levels are y32.4 and50.0, with physical slabs, fascia, setbacks and thin guards. The complete head remains stationary through these levels.

A proposed6m lower expansion was rejected after full polygon intersection found unsupported area; it was never retained as the implementation. The independent final contact audit found no unsupported lowest-plan area, all827sampled perimeter rays supported, minimum ring clearance1.077m, all sampled actual base skin/frame edges supported with minimum clearance1.037m, and exposed source cap preserved. The source owner's contact test is the durable verification; bounding boxes or isolated vertex tests alone were insufficient.

The broad source height envelope is retained provisionally: dark glazed crown begins y74.2, main roof y78.4, and the small roof object reaches y80.2. These are authored fit values, not surveyed elevations. VPL's record of23storeys does not establish the number of visible facade subdivisions or reconcile the conflicting public height datums. Native full-roof comparison is required before claiming correct scale.

The small low barrel crown is located from Handford20 at approximately60% across the near face B→A, close behind its front roof edge. Width6m, depth2.8m, inset1.65m and height1.8m are explicitly inferred. It is a closed low curved object with a flatter profile, not the old large generic hemisphere. The larger circular skylight visible in the aerial is a different, insufficiently correlated feature and is not used as this small skyline object's location. The main roof is closed independently beneath it.

## Facade geometry

The broad near face is continuous glazing with15pane intervals in five wider/narrower/wider groups traced at imagey610. Sixteen principal vertical grid cycles, with thinner intermediate transoms, continue through its height. This is a photo-pattern approximation, not a claim of16real floors. Pale encircling source bands and random lit-room quads are removed with the original tower.

A separate glazed faceted return changes reflection normals before the southeast long face. Its pale punched-window field has a stepped boundary: the near lower portion remains glass, while the farther portion continues pale openings down toward the podium. The provisional longitudinal step is.48 and near pale-field bottom is y53.1. These normalized/metric assignments preserve the observed L-shaped organization while remaining subject to viewpoint registration uncertainty.

The nose is predominantly pale punched windows. Eleven visible row centres from Handford16 determine its relative row pattern, with physical interruptions at the two terraces. Each paired aperture has subtly rounded corners, a thin central mullion, actual concrete reveals and closed backing. The northwest continuation is conservative because the supplied photographs do not equally resolve all hidden elevations. It is not described as a verified complete as-built facade.

All glazing has physical recess and opaque backing, without emissive room tiles. Vertical corner seals close the small gaps between independently offset facet skins. The complete roof, apertures and returns are closed. Four opaque geometry roles and one coherent glass geometry are merged independently; the material module supplies its two ordered optical passes.

## Verification and measured cost

The factory currently produces **79,278 unique triangles**, **3,636 pane entries** (including paired punched windows), **585 punched openings** and **five geometry batches**. Paired glass means six material submissions before shadows and whole-scene batching; this is not a complete scene performance claim. No per-pane material or draw call is created.

Focused geometry tests verify registered head/nose relationships; near-face and return glass with closed cavities; the stepped southeast field; real nose apertures; actual terrace surfaces; roof closure; absence of a duplicate source cap; exact base-height limits; finite arrays; and bounded batches. Independent source tests cover complete guarded tower removal, preservation of unrelated geometry and actual retained-cap contact. The coordinator owns final build, ordinary gameplay motion, full-height native comparison, probe/light assessment and integrated submission count.
