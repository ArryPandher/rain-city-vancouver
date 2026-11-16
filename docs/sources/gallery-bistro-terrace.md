# Gallery Robson bistro terrace

Registered 2026-11-16 UTC. This is a photo-informed exterior reconstruction, not
surveyed restaurant seating or an accessible interior.

## Evidence and bounded fit

The Gallery's official 2023 photograph shows a broad raised bistro terrace,
white outdoor parasols, tables/chairs and a continuous planted edge beside the
Robson stair. Source:
https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg
Cached `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg`;
terrace crop `artifacts/local/gallery-stair-framing-source-crop.png`.
The 2022 Rabich rear photograph corroborates the terrace and white parasols:
https://commons.wikimedia.org/wiki/File:Vancouver_(BC,_Canada),_Art_Gallery_--_2022_--_1923.jpg
Neither photograph becomes a runtime texture.

The cached north-up Esri aerial (`esri-garden-context.jpg` and its export JSON)
shows the terrace on this side of the central portico. Its imagery date and
roof parallax remain uncertain. The registration overlay is retained locally as
`gallery-bistro-aerial-overlay.jpg`; orange marks the initial larger candidate,
cyan the current stair and yellow the mapped routes. **The orange candidate was
reduced to v28.3 before implementation** to preserve the transverse footway.

The original decoded foundation's rear cap edge fixes the back: u3.95..19.0,
v23.54..23.19, at local y3.199517 (existing stair/top is y3.2). The prior1.8m right
strip was a stair cheek, not a whole restaurant terrace. It cannot credibly
hold cafe parasols; no scaled-down miniature furniture was installed.
The new platform is a closed union of that cheek with the roughly15×5m terrace.
Its front is v28.3; the narrow cheek still continues to v30.93 beside the upper
flight. The platform is built from world y0 to3.28 with physical top, bottom,
front, sides and foundation contact. There is no floating slab, hidden room,
source-cap overlay or duplicate internal cheek wall.

Three3m square white parasols at u8.2,12.5,16.8 / v25.85 use estimated2.35m eaves
and3.03m peaks above the terrace. Four restrained outdoor seats and a0.98m table
sit under each. Exact count, furniture style and locations are illustrative
estimates based on the visible source hierarchy, not claimed measured positions.
The planting is bounded by physical0.64m planters and a low clipped hedge. The
planting guards the outer edges; the source gallery closes the back. Building
entry remains closed. This does not promise an interior restaurant route.

## Circulation and contact

Mapped w263530524 is a1.8m-wide footway centred at v30.01..30.55; w263530526 is a
2m-wide stair route meeting it at u16.66,v30.22. The new broad platform's v28.3
front stays over0.75m behind the actual ribbon edge in the nearby checked run.
The existing cheek corner remains at u5.75,v30.93. Tests exclude its already
occupied envelope when checking the clear transverse run (u≥6.2). No road data,
ribbon heights, public terrain, central24-riser stairs or map arrival changed.

The existing Gallery-gated contact provider delegates to shared bistro data.
Platform support requires the actor already near terrace height; a ground actor
cannot snap upward3.28m. Wall, planter, furniture and sloped canopy contact are
finite in height. Existing right-edge cheek rail is shortened to its exposed
portion; no rail cuts across the newly widened terrace. Source roof, facade and
retained floor cuts remain as before this pass.

## Rendering and validation

Two new shared opaque materials (off-white canvas, green planting) join the
existing stone/metal batches. No per-chair or per-parasol draws. Complete Gallery
facade addition is14,170 triangles in7 draws including the separately committed
stair material. All canopy skins have a closed underside and upward-facing roof;
platform and every furniture solid have paired consistently oriented edges.
Focused tests inspect actual full-city support and route clearance, finite camera
contact, supported furniture, exact retained geometry guards and ordinary stair
ascent preservation. Native visual acceptance remains root's next step.
