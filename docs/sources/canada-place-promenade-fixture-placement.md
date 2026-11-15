# West promenade globe-light row placement

2026-11-15. A bounded four-fixture entrance-side row, not a surveyed whole-pier lighting plan.

## Independent evidence

The [TourbyTransit west-trail photograph](https://cdn.tourbytransit.com/vancouver/images/Canadian-Trail-at-Canada-Place.jpg), cached as `artifacts/local/canada-place-pedestrian-references/tour-trail.jpg`, looks northeast from the entrance and shows repeated pale rail-side poles with globe lights and narrow banners. The nearest globe/stem/bracket silhouette is sufficiently clear to model; the receding fixtures are not sufficient to classify every head as single or double. The old Canadian Trail arch dates this view before its replacement, so its banner/arch artwork is not a current specification.

[Brenco's March 14, 2023 project article](https://www.brenco.com/whats-happening/salish-sea-the-journey-within), [direct photo](https://www.brenco.com/images/whats-happening/Salish-Sea--the-Journey-Within-1678831506.jpg), cached as `brenco-2023-1.jpg`, looks southwest through the replacement entrance arch. Rail-side poles/banners remain visible toward the southern background. It corroborates the fixture family and waterside alignment, not the exact count or coordinates. Neither source establishes 2026 banner content. No photograph or copyrighted arch artwork is included at runtime.

## Authored placement

The actual source pier west edge is `pier[1]→pier[2]` in `canada-place-deck-data.json`, from local(-223.6980,62.3278) toward(47.0863,-84.6473). Placement follows this edge at distances45,65,85 and105m, inset0.45m toward the promenade. These give local centers approximately(-183.934,41.257),(-166.356,31.716),(-148.778,22.175),(-131.201,12.634). The four fixtures cover60m beside the hotel entrance frontage, ending well south of the constricted sail stay-anchor corridor. Four and20m spacing are bounded estimates supported by visible repetition, not photo-extracted survey values. The previous rough(-191,48) location was rejected because it nearly coincided with the existing route.

All fixtures use the clearly readable single-globe type with a narrow plain banner. Exact pole profile and dimensions are authored estimates documented by the model owner. `groundY=7.8` is source-local; the landmark's existing+.08 lift gives finished7.88. Yaw aligns model +X northeast along the rail and +Z inland. The pole/globe keep that orientation; only banner and brackets extend toward local -Z, seaward, so their broad face is visible to walkers approaching along the row.

## Collision and route evidence

The four180mm-radius finite pole volumes span worldY7.88–12.50; they are not infinite tree-trunk colliders. Runtime integration must gate them on successful fixture-model loading. `canadaPlacePromenadeFixtureAt` accepts an optional finite body height and returns false below the deck or above the fixture. The base model radius is160mm, leaving20mm conservative tolerance.

The dedicated test samples the existing route from local(-190,47) through(-155,28) to(-115,7) at≤0.2m intervals. Every sampled point admits a1.5m radius through the real CollisionWorld and supported-deck mask, preserving a continuous3m corridor. Against all four fixture centers, minimum extra margin beyond that corridor and180mm fixture radius is0.472m. Actual car center radius1.16 and nose/tail probes at±1.35m with radius0.9 also pass. Each fixture base is separately inside the actual pier and outside solid building masks. Near-rail fixture bases intentionally use physical pier containment rather than the additional650mm pedestrian rail setback; the usable route retains that setback.

Source coordinates retain Codriver CC-BY4.0 / © OpenStreetMap contributor provenance. Native appearance and final loaded-collider integration are root responsibilities. This row must not be extrapolated north into the tight stay-anchor route without new clearance checks.


## Seaward banner orientation and high overhang

The nearest TourbyTransit banner is visibly broad when looking along the promenade, and lies on the water side of its pole. This supports a banner plane approximately perpendicular to the row, projecting seaward, rather than a banner running along the rail. The model owner rotates only cloth and brackets; pole, globe, footing and row positions remain fixed. Brenco corroborates the rail-side grouping but is less useful for measuring banner orientation.

The authored banner spans local seaward offsets 0.10–0.95m from a pole inset 0.45m. Its outer edge therefore projects approximately 0.50m beyond the mapped pier rim. That is a high suspended overhang: cloth starts 2.15m above deck and its lower bracket extends slightly lower, to approximately 2.13m. It must not create a ground support polygon, widened public deck, or low obstacle outside the pier. This dimension is an estimate guided by the visible bracket/banner proportions, not a surveyed overwater projection.

Placement tests inspect the actual model vertices after each of the four yaw/translation transforms, checking the banner's perpendicular plane, seaward extent, height of every off-pier part, and clearance from the full 3m route corridor at every height. Off-pier banner coordinates remain outside both physical pier containment and the supported-deck mask. Runtime actor/camera collision uses the finite pole envelope only; it does not provide exact collision against the offset upper globe or high cloth. Those components remain outside the tested 3m travel corridor.
