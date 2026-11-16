# Robson rink exterior candidate — opt-in support contract

2026-11-16. Pure geometry and shared cut/guard data only; no World, collision, terrain, material, camera, or loader integration. Root must review this conservative exterior approximation before enabling it.

## Source registration and deliberate approximation

The [operator 2024 rental package](https://www.robsonsquare.com/app/uploads/sites/662/2024/06/Robson-Square_Facility-Rental_Info-Package-2024_v.2.pdf), pages1,3–4, shows the roof over a sunken rink, permanent concrete edges, adjacent lower plazas and separate upper street. It gives one rink137×44ft, low/high roof12/21.5ft above rink, and lower plaza about1ft below rink. These establish relative dimensions, not a surveyed street datum.

The cached georeferenced Esri aerial uses exact EPSG3857 bounds recorded in `artifacts/local/robson-realism-reference/esri-garden-export.json`. **Correction to the preliminary study:** the earlier north26m apparent contour included adjoining sunken plaza/stair space. It must not become a26m glass dome. The corrected blue glazed contour has centre gardenUV[−103.52847066,2.9859083], fitted outer radii[9.22164775,8.07420181]; its hand-picked pixel controls are in `artifacts/local/robson-domes-reference/north-glass-corrected.json`. South centre[−139.98545773,3.80643455], outer radii[8.85754233,7.72420371] fit the visible arc; the tree-obscured closure remains inferred. Fitted orientation is preserved per dome. These are approximate projected outlines, not surveyed beam centrelines.

[KWH construction photographs](https://www.kwhconstructors.com/our-projects/robson-street-dome) and the operator cover show the shallow glazed roofs above substantial permanent concrete and below/near adjacent upper circulation. Temporary scaffold decks in erection pictures are not rink datum. [CISC](https://www.cisc-icca.ca/projects/robson-square-domes/) confirms elliptical steel roofs over existing semicircular concrete supports and168mm primary tubular members. The candidate's parabolic triangulated roof is a bounded visual synthesis, not a reconstruction of exact fabrication coordinates. [Garibaldi](https://www.garibaldiglass.com/garibaldi-glass-caps-off-new-upgrade-to-robson-rink-in-time-for-2010-olympics/) supports clear glazed panels with specified frit areas; no photo texture or calibrated optical value is inferred.

Street-to-rink drop is still estimated4.0–5.2m. The candidate chooses midpoint4.6m below the comparison street datum0. Operator offsets then give low roof−0.9424m and crown+1.9532m. No full dome was raised to obtain artificial pedestrian clearance. Existing garden finish is0.08; rim cap is0.11 to prevent coplanar overlap. Those finish offsets are implementation choices.

The geometry uses an explicit **1.2m inward inset in each fitted radius**. Its north/south roof sizes are therefore approximately16.04×13.75m and15.32×13.05m. This is a conservative exterior candidate inside the observed larger support/glazing envelope, not a claim that these are the full real roof dimensions. The inset preserves the existing w263530527 endpoint/ribbon: its centre was only0.22m from the full-extent proposed guard, insufficient for the1.8m path. Both original outer radii and inset radii remain in source data. Restoring full extent needs a separately registered edge-route/support change; silently deleting that route is not permitted.

## Candidate behaviour

Two separate closed wells have glass/steel roofs, a closed floor, retaining walls, rim caps, and complete rails. Every low glass vertex projects inside its matching opening. The opening extends0.18m beyond the inset roof; the retaining cap is0.32m thick. Rails are1.04m high above the rim. These conservative closures make the exterior reviewable without inventing an entrance, an underground passage, or the surrounding lower plaza interior. They deliberately do not recreate the photographed open end stairs. No under-street access is authored.

The connecting real rink is documented by the operator but **not excavated or rendered in this candidate**. Robson Street w50098016 and the entire current upper crossing remain outside both cuts. The two small kiosk canopies w297300290/291 are unchanged.

API:

- `createRobsonRinkExteriorGeometry()` returns world-coordinate `{concrete, steel, glass, stats}`; all three are single material batches without groups. Concrete uses metric tangent-plane UVs via the existing helper. Glass is divided by actual geometry and ribs, not a painted grid. Caller owns disposal.
- `ROBSON_RINK_OPENINGS` gives the exact64-vertex interior cut polygons. These are shared by the concrete inner wall/floor and `robsonRinkOpeningAt`.
- `ROBSON_RINK_GUARDS` gives128 closed rail segments with bounded min/maxY. Install body/camera obstruction using real vertical spans. Rendering a rail alone is insufficient.
- `robsonRinkLowerSupport(x,z,referenceY)` returns floorY only within a cut and below the upper layer; it returns undefined for upper actors and everywhere outside. Root must deliberately choose how an opt-in guarded well participates in contact. It must never be an unconditional global ground override.

Geometry budget:18,796 triangles total,252 glass triangles,3 geometry batches. A coherent two-pass glass material adds one draw. No materials, captures, lights, downloads or textures are created by the module. Reuse licensed cast-concrete maps and a neutral steel finish; glass should remain clear/neutral with coherent attenuation/reflection, without the dark backing or intensified effective IOR of the Pan Pacific closed commercial glazing.

## Required root integration order

1. Keep integration opt-in for native review. Register guarded exclusions/support before showing the roof.
2. Subtract each accepted `ROBSON_RINK_OPENINGS` polygon from all covering layers: `World.terrain()` global grass floor−.09, cityBase−.035, covering area/terrain meshes, and custom Robson garden only where it actually overlaps. Removing only a road ribbon leaves invisible flat support visually covering the well.
3. Preserve all current roads; the focused test proves their centre and edge samples remain outside candidate openings and guards. No `roadRibbon` clipping should be necessary for this inset candidate. Robson Street stays an upper deck.
4. Install closed guards with matching body/camera height bounds, then opt-in floor support with referenceY. No access is implied by the lower floor.
5. Add the three world-space geometry batches with existing licensed materials. Verify normal walking, camera and down-ray support at the rim and crossing before enabling the feature.

Focused tests check all concrete edges occur exactly twice, visible front-facing floor ray parity, upper/lower support distinction, complete rail closure, roof containment and operator heights, finite geometry/material batch budget, and actual mapped route centre/edge samples every≤0.25m with0.38m body margin. The crossing w50098016 is explicitly included. Scoped TypeScript diagnostics passed with Node test types. No full build, browser capture, global tests or FPS claim from this lane.
