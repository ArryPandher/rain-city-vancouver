# Canada Place west ground stay anchors

The ground stays are separate assemblies from the original roof-only rigging. Their module does not move or remove source GLB geometry. In the integrated loader, a successful source-facade preflight replaces the obsolete west roof sockets and chords with these ground stays. East roof stays and every mast shaft are preserved; if preflight fails, the replacement is not applied.

## Evidence and limits

The exact five mast x/z locations and local mast-head height 46.17 m come from the existing Codriver source registration (`canada-place-rigging-map.json`, CC-BY-4.0; geographic placement © OpenStreetMap contributors). Ground longitudinal stations follow these model masts; this is not a new survey of real anchors.

The angled protective concrete bodies, rounded/chamfered shoulders and paired exposed dark sockets/connectors follow Juan Tanus's photograph in BC Museums Association *Roundup*, Fall 2012, [p. 21](https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf). Cached reference: `artifacts/local/canada-place-pedestrian-references/museum-west-photo.png`. The historical west section (`rayner-section-west-crop.png`, from the cached Rayner waterfront thesis) independently distinguishes these ground anchorages from roof stays. Historical photographs establish form, not current exact dimensions, finish or operating condition. No source photograph is redistributed as an in-game texture.

Body dimensions, transverse positions, paired cable spacing, socket and connector sizes are explicitly authored estimates. Do not borrow east-side tie-back dimensions or claim these west dimensions are measured. The model uses local deck 7.8 m and the unchanged landmark group offset +0.08 m, giving world finished deck 7.88 m.

## API and validation

`canada-place-ground-stays-data.ts` is renderer-independent and exports exact polygonal footprints, source/world lower and upper barrier elevations, and paired cable endpoints. `addCanadaPlaceGroundStays(parent, concreteMaterial?)` appends three shared material batches to the existing source-local landmark group. Optional concrete material is cloned; parent can calibrate mineral response. Metric UVs and all source/local positions are retained.

Current geometry has 13,470 triangles across 3 batches: 270 concrete, 12,880 hardware and 320 cable. Seven targeted tests cover actual decoded source-GLB deck support under every plinth corner, source mast contact, cable/connector-radius clearance against the current curved facade from both directions, outward-facing closed shoulders, exact footprint containment and finite normals. Parent route/collision integration and native appearance acceptance are separate checks.

The first 17.5 m offset, 2.8 m deep study footprint was rejected: although source-deck supported, it left almost no waterside passage. Do not treat deck support alone as public-route validation. Final route and car clearances must use the matched visible footprint plus the existing pier/rail clearance, never a water or collision exemption.

Final candidate: 1.9 m longitudinal width × 2.4 m radial depth × 2.45 m height; centre 14.70 m outward for middle three bays, 14.40 m for terminal bays. The body sits partly beneath the lowest glazed awning, outside the independently source-supported recessed ground door plane. Its outer edge remains 15.90 m centrally and 15.60 m at the ends, reserving the existing waterside route. The old flush ground glass assumption was inconsistent with the section and would have required an unnecessarily narrow body. These dimensions remain estimates, with native acceptance separate.

The final body moves 250 mm inward without shrinking. Socket/cable locations stay fixed (15.10 m outward centrally), and the rounded upper shoulder shifts relative to the body to retain physical socket contact. This adds waterside driving margin while respecting recessed doors. Finite-radius mesh-edge intersection checks cover the full body/hardware against the actual updated facade and soffit, not only cable centerlines.

## Dedicated plinth material

Three dedicated 512 px CC0 mineral maps total **90,894 bytes**. They are generated from a joint- and tie-hole-free crop of the existing Poly Haven `concrete_wall_009` source, credited to Charlotte Baglioni / Poly Haven. Restrained normal detail and ground-exposure shading give the protective concrete bodies texture without copying large wall joints or holes onto them. The crop is a generic mineral treatment, not a scan of the Vancouver anchors. Source URLs, hashes and preparation details are recorded in `public/textures/canada-place-plinth/SOURCES.json`; no new source downloads were required.

The final native-review refinement adds bevelled trunnion caps, raised pin faces and smoothly turned barrel ends. These mechanical details are authored approximations within the previously validated radii and endpoints, not measured fastener reconstruction. Dark graphite paint retains the reference contrast while showing more daylight curvature.
