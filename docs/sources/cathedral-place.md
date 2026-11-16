# Cathedral Place — registered exterior candidate

2026-11-16 UTC. Exact mapped building `w114505109`, 925 West Georgia Street.
Local verification is complete; ordinary-camera native acceptance is pending.

## Why this building

The white lattice cuboid at the upper-left of `artifacts/local/gallery-public-walking-fede019.png` is the nearest mapped tower on the Gallery's northwest sightline. Its source footprint centre is approximately world `(2.424,-131.755)`. The nearby saved ordinary arrival camera, yaw2.35546/FOV62, projects its roof to the left of the Gallery and in front of Park Place. The walking frame is a few metres farther forward; this is a bounded registration, not an exact recovered camera solve.

The previous generic renderer used the entire four-point footprint for a15m podium, a seeded .842768 uniform tower shrink and a flat116.4m roof. That erased the building's most recognizable feature: a steep bluegreen crown over an asymmetric stepped stone/glass body.

## Primary references and bounded query

- Owner/manager: <https://www.925westgeorgia.com/> — address and23-storey office building at Hornby/West Georgia.
- Owner's leasing brochure: <https://www.925westgeorgia.com/wp-content/uploads/2025/10/ShonGroup_LeasingBrochure_Feb-2026.pdf>. PDF page1 is a full-height corner photograph; page7 contains the as-built19th-floor plan and an elevated window/terrace photograph. The supplied plan shows repeated structural bays and genuine stepped returns; it is not treated as a ground-floor boundary.
- Owner corner detail: <https://www.925westgeorgia.com/wp-content/uploads/2022/10/cathedralplace-buildingspecs-1-768x512.jpg> — pale stone, bluegreen projecting glazing and open decorative terrace rail. No source image is a runtime texture.
- City of Vancouver2009 building footprints: <https://opendata.vancouver.ca/explore/dataset/building-footprints-2009/>. Bounded request only: `/api/explore/v2.1/catalog/datasets/building-footprints-2009/records?where=bldgid%3D148343&limit=10`. Exactly five records returned, preserved in [cathedral-place-city-response.json](cathedral-place-city-response.json). Open Government Licence – Vancouver. Metadata definitions remain in `artifacts/local/cov-buildings-2009-metadata.json`.
- Existing map/tag records: `public/data/vancouver.json`, `public/data/vancouver-building-tags.json`. City match `bldgid148343` has IoU.744, so it must not replace or extend the current public ground footprint without registration.

The CCA's unbuilt Erickson “Cathedral Place” proposal is a different project and was excluded.

## Datum and massing, including uncertainty

City aggregate `MAXHT_M116.38` agrees with mapped `height116.4` to2cm. However the largest per-part `TOPELEV_M130.07 − BASEELEV_M26.55 = HGT_AGL103.52`, and the metadata calls that the highest element elevation. These fields cannot all be interpreted as the same measured apex. Neither103.52 nor geodetic130.07 is silently substituted for the current tower height.

The candidate therefore keeps **apex116.4m above the existing live grade** and changes the partition of that envelope. No historical City base26.86m is promoted into a new public plaza. The roof-part shapes and distinct lower roof heights provide bounded evidence for the asymmetric setbacks:

| Roof part | City above-grade height | Candidate use |
| --- | ---: | --- |
|160598|4.42|Low rear shoulder inside the mapped footprint; external portion omitted|
|160599|59.13|Lowest southwest shoulder|
|160600|70.16|Next southwest setback|
|166248|90.87|Principal stepped body|
|162094|103.52|Registered central crown footprint; height is not claimed as crown spring|

All polygons are clipped to the unchanged OSM four-point ring. Cumulative unions form nested tiers. The base still closes that full ring; every vertex, including hidden cavity closures, is contained by it. The City far rear extension outside the OSM polygon is excluded, preserving neighboring property and routes.

The initial `fd421f6` checkpoint retained the total height but used a single closed pyramid. The owner crop disproves that simplification: the upper crown is open lattice, and the two finials sit at separated ridge ends. The corrected crown has an elongated hip ridge on the same registered15.675×25.992m rectangle. Equal-pitch hip planning gives a10.318m ridge, with each end inset approximately7.837m from its corresponding short facade.

The source trace uses the owner cover rendered at1400px tall, cropped at `(245,0)` with345×300px and enlarged3× for inspection. Approximate crop controls are: near ridge end `(493,42)`, far ridge end `(698,253)`, far finial tip `(689,95)`, near eave hip `(499,447)`, and near solid/lattice transition `(496,170)`. The front finial tip is cropped: its height is not measurable in that image. The diagonal line between ridge ends and the displaced far finial support an elongated hip rather than a single apex with two arbitrary poles. At the near hip, the solid portion occupies approximately68% of the apparent eave-to-ridge span; the authored transition uses69%.

**Corrected fitted elevations above existing grade:** retained stone cap99m; open lower perimeter99–100.2m; lower bluegreen panels100.2–108.549m; open lattice108.549–112.3m; two tapered finials112.3–116.4m. These are source-grounded estimates, with roughly±3m uncertainty in the body/crown partition and±1m in the finial length. The12.1m roof rise over a7.837m half-span implies approximately57.1° on both axes of the equal-pitch hip. This is not the old pyramid's65°/52°, and is **not derived from City median42°**. The City aggregate height and existing game envelope constrain the maximum; the owner photograph governs this provisional partition.

The lower perimeter is physically open between two narrow rails and posts. The upper lattice consists of three crossing diagonal courses with75mm square members, approximately650mm spacing measured at the lattice's lower edge. This avoids compressing the entire eave seam count into the small hip-end opening. All member dimensions are visual estimates, not a structural survey. No roof plane, glass sheet, opaque backing or alpha mask spans the upper lattice. Thin lower panels are closed solids with45mm thickness; hips and ridge are steel members. The cap below remains closed and no rooftop public route is introduced.

## Architecture and materials

The body has one5.6m ground-storey zone and22 upper vertical intervals to90.87m, matching the owner's23-storey description as an interpretation, not a recovered slab schedule. Higher central transitions belong to the crown. Short fragments at tier cuts are opaque, not implausibly narrow extra windows.

Physical stone piers surround recessed divided panes. Long facade ends use projecting bluegreen curtain corners relative to the recessed stone plane. These remain inside the mapped envelope. Pane depths are.56m for stone bays and.08m for projecting glazed ends; opaque backing is.98m inboard. Continuous metric UVs prevent triangle-by-triangle mineral texture resets. Roof seams are raised geometry ending at the genuinely open upper lattice. Shoulder caps are the exact polygon difference from the next tier, so there are no coplanar wall-strip caps laid over them.

Five shared geometry/material roles: stone, metal frame, backing, roof and optical glass. Current factory: **36,795 triangles,1,363 glazed cells, five batches**. One existing-style128px local reflection capture is registered outside the Gallery-facing corner. There are no per-window materials, lamps, interiors, characters, photographic facade textures or new large texture assets. Stone reuses the existing licensed CC0 plinth color/normal/roughness maps; source samplers are cloned rather than mutated. Existing runtime attribution remains unchanged.

## Integration and checks

Owned hook: `cathedralPlace(...)` immediately before the existing architecture dispatch in `src/world/architecture.ts`. It returns false for every otherID or a materially changed source footprint. The generic fallback is suppressed only after successful registration. Batcher's existing grade offset is preserved. No source road, terrain, collision, Gallery, World or main changes.

Seven focused tests cover:

- Exact actual-source ring, five-record identity, aggregate height evidence, clipped tier reconstruction and nesting.
- Every physical vertex inside the retained footprint, unchanged grade/apex, finite outward/upward roof facets and clear nearby approach rays.
- All1,363 panes backed by an opaque inward surface; sampled exposed roof caps occur once.
- Exact-ID wrapper, invalid-source fallback, five shared batches, unchanged caller samplers and grade offset.
- Actual10.318m ridge, two finials at the retained maximum, closed lower panel thickness, and ray-tested air gaps through the upper lattice and lower perimeter.
- Actual `architecture()` with the full converted City fixture: one Cathedral assembly, no generic shell, byte-identical adjacent Park Place/unrelated geometry, and identical existing ground/body-contact queries.

A one-off comparison against the `fd421f6` factory proved identical position/normal/UV hashes for all stone, backing, glazing and sub99m frame geometry. Only the crown changed.

Strict scoped TypeScript passes. No browser, production build or push was run by this owner. Root's first combined snapshot contains the superseded closed crown; the corrected ridge/lattice requires a new build and native acceptance.
