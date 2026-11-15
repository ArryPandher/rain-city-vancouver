# Canada Place public deck and entry aperture

2026-11-14. Bounded original integration of the fixed source landmark. This helper does not move the building, invent an eight-metre staircase, or implement approach roads/collision itself. Native acceptance belongs to the parent integration.

## Source and interpretation

The licensed [Codriver site rings](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/canada-place-site.js) and [geometry](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/geometry.js) supply PIER, HOTEL, five SAILS rings and TERMINAL. `canada-place-deck-data.json` preserves their exact local coordinates. The rounded hall reproduces the source's 48-sided ellipse, centre(72,-31), radii25×18m. These remain CC BY4.0; geographic placement © OpenStreetMap contributors. No reference photograph or new texture is distributed.

The [Vancouver Convention Centre Outdoor Plazas Operating Guidelines](https://www.vancouverconventioncentre.com/fullpdf/outdoor-plaza-guidelines), 15 April2025, AppendixB/page22, directly identifies the East Convention Level Plaza, lobby, hotel entrance, curb, kiosks and pedestrian forecourt. Inspected cached plan: `artifacts/local/canada-place-entry-research/east-plaza-page22.png`. [Flyover operator directions](https://www.experienceflyover.com/vancouver/plan-your-visit/location-parking/) distinguish the pedestrian front plaza/Canadian Trail from the parkade underneath; [Destination Vancouver](https://www.destinationvancouver.com/things-to-do/listings/the-canadian-trail-at-canada-place) locates the Trail on the west promenade. These establish public topology, not exact metre widths or a surveyed vertical datum.

The selected public mask is an **estimated conservative subset** of the front forecourt and west pier strip, clipped to actual PIER and excluded from closed masses. It is not a georeferenced tracing of the entire official plan. The west-strip eligibility depth is24m; the approach connector is a10m-wide integration rectangle x425–435,z−522..−544. Its end lies on an exposed source surface and its street end must be physically supplied by the approach renderer. The fixed model deck is world **7.88m** (source7.8 + group0.08), not a claim of surveyed elevation. Other exposed terraces and the north/east pier are deliberately not opened as public routes by this helper.

## APIs and collision contract

`src/world/canada-place-deck.ts` exports:

- `CANADA_PLACE_DECK_Y`, source world polygons `CANADA_PLACE_PIER`, `CANADA_PLACE_HOTEL`, `CANADA_PLACE_SAILS`, `CANADA_PLACE_TERMINAL`, `CANADA_PLACE_HALL`, and their `CANADA_PLACE_SOLID_MASSES` collection.
- `CANADA_PLACE_PUBLIC_MASKS`, `CANADA_PLACE_ENTRY_CONNECTOR`, and the validated `CANADA_PLACE_DECK_ROUTE`.
- `supportedDeck(x,z,r=0)`: eligible public deck with actor clearance. Always requires the centre inside source PIER and outside closed masses. A0.65m pier-edge inset plus actor radius protects unbacked edges; only a radius-clear circle within the backed entrance connector waives that edge inset. That circle can straddle the source rim because the approach supplies the other side.
- `solidAt(x,z,r=0)`: closed hotel/exhibition/terminal/hall footprint plus0.55m source-trim clearance. Lower pier solidity is handled by the caller's height gate, not this above-deck mask.
- `inCanadaPlacePier` and `inCanadaPlaceEntryConnector`: explicit footprint tests, not global water exemptions.
- `CANADA_PLACE_DECK_COLLIDER_IDS`: **w223635729 only**. Actual route sampling overlaps this mapped whole-pier building. A2m public-mask audit found no radius0.4 supported points in hotel/site relation r16532084; the chosen west-front connection avoids that relation. Keep it and all unrelated colliders intact.

Caller contract: bypass that one whole-pier collider only when `supportedDeck(x,z,r) && !solidAt(x,z,r)` AND the finite actor/reference height is at least deckY−0.5m, or during an explicitly intended Infinity surface query. This does not authorize movement through the lower pier or switching off water for a bounding box. Water exceptions belong only to actual supported deck or the separately rendered approach surface. Use deck finished height7.88 directly; do not add another pavement offset to it. Keep the source model and mast anchors fixed.

## Physical entry rail correction

The source asset indiscriminately places rails along long PIER edges, including across the official front-plaza entry connection. An actual GLB ray at(430.4,-530.9) hit steel at y8.9177 instead of the deck. Declaring that route walkable without changing the rail would be a visible geometry conflict.

`src/world/canada-place-entry-rail.ts` exports `openCanadaPlaceEntryRail(geometry)`, called only on the Canada Place steel primitive **after baking its local metre coordinates**, before or after the existing mast replacement. The companion data pins source position count6096, index count9144, source hash and three reviewed component ranges. Bounds/count guards fail closed on a changed source or repeated edit.

Only the long top rail component5592–5615 is shortened at world x425 by sliding its endpoint along the original source rail axis. Its original end-cap triangles close the new end. Only the two post components5616–5639 and5640–5663 are removed (24triangles). Remaining rail west of425 and all other source steel vertices/indices stay intact; only the shortened rail's normals are updated. The adjacent short source edge already has no rail. The correction therefore opens only the necessary portion of the10m connector, not the whole front edge. It adds no meshes, draw calls or materials. Parent owns the narrow loader hook.

## Analytical validation and limits

`tests/canada-place-deck.test.ts` pins the actual GLB SHA-256 `1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe`, decodes quantized attributes and transforms, and verifies567 source-support rays across eligible grid points and a continuous west-promenade route. The gate is(430,-541.04), then(424.70,-549.34),(435.70,-560.34),(454.70,-575.34), continuing along the west side to(686.70,-697.34). Every sampled centre has0.4m clearance and an upward-facing source deck hit within0.015m of7.88.

The entry is sampled every0.1m from(430,-523) to(430,-541), with16 footprint-circle samples per station: points inside PIER hit its physical deck; outside points remain within the explicit connector and require the approach-owned support. This is a conditional combined-support proof, not a claim that this helper rendered the outside surface. Tests also reproduce the original rail obstruction, verify the repaired aperture and cap, preserve the rail outside the entrance, compose with the ten-mast replacement, reject closed masses/private roofs/shoreline, and retain unrelated colliders.

Remaining limits: estimated public-mask/connector widths, approximate source terminal/hotel geometry, unsurveyed local datum, and the parent-owned raised street/plaza approach. Check native car arrival, exit, uninterrupted walking through the source rail opening to the west trail, return, edge safety, head clearance and facade contact before accepting the full scene. No photographic parity or completed public-access claim follows from these geometry tests alone.
