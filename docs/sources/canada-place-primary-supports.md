# Canada Place primary concourse support preview

2026-11-15. This is one complete, bounded structural reconstruction behind the central west glazing, not a surveyed column schedule or playable interior.

## Independent evidence and registration

The Rayner west section shows a substantial vertical support behind the uppermost curved tier. It runs from concourse floor to the upper-promenade roof structure, with a wider lower pedestal and an upper collar. In `artifacts/local/canada-place-pedestrian-references/rayner-section-west-crop.png`, the floor is approximately image y 985 and roof underside y 247; the wider lower section changes near y 630 and the collar near y 465. Relative to the authored source floor/roof heights, these imply a pedestal top around sourceY 12.55 and a collar around 14.75. Raster lineweight and uncertainty over finish versus structural lines preclude survey precision.

The column is inward of the highest curved tier's top/inner lip, not at the projecting lower glazing. The authored profile places that lip at outward 7.686m. A center at outward 7.15m, stem 0.50m square and pedestal 0.80m square follows the section relationship while remaining behind the envelope. Square section,20mm corner bevels, shoulder bevels, collar 0.78m and roof bearing 0.72m are mechanical/finish estimates; the section does not establish every plan corner or connection detail.

[SACO west views](https://saco.com/wp-content/uploads/2016/09/SACO-Canada-Place.pdf) and the [official west photograph from 2011](https://www.flickr.com/photos/canadaplace/5973727240/) register the central group between the opaque round-opening bays beneath PLACE. They show deeper upright structure behind curved framing, but overlapping mullions, exterior posts and lighting prevent securely assigning a unique column station or repeating count. The chosen station 53.3275 is therefore an explicitly estimated placement aligned to the existing central structural frame beneath PLACE. It is not claimed to be a photo-measured primary-column location. No automatic repetition has been added.

Rayner source: Michael Rayner, _Urban Waterfront Renewal_, [published report](https://www.architects.nsw.gov.au/download/BHTS/Rayner%2C%20Michael_BHTS_Urban%20Waterfront%20Renewal_low%20res.pdf). Existing source-coordinate registration derives from Codriver's Canada Place asset, CC-BY 4.0, geographic placement © OpenStreetMap contributors. Reference photos remain research-only and are not runtime textures.

## Geometry and integration

`addCanadaPlacePrimarySupports(parent)` adds exactly one source-local mesh using the same landmark transform as the hall facade. Optional `{stations, material}` allows a deliberate subsequent preview, not an inferred primary grid. `CANADA_PLACE_PRIMARY_SUPPORT` exports all dimensions; `canadaPlacePrimarySupportPoint` gives the source-local station/outward point.

One continuous closed mesh joins the lower pedestal,0.50m stem, upper collar and roof bearing. There are no overlapping internal box caps or detached stacked components. It ends at the current closed floor Y 7.825 and roof Y 17.625. The existing upper-frame underside overlaps the bearing by approximately 6.23mm at the preview station; this is attached contact, not a gap. The lower pedestal reaches 12.55; collar spans 14.65–14.85; roof bearing starts 17.48. The support stays inside the opaque-lined volume and does not alter the public footprint, route, glazing, roof, collisions, probes or materials elsewhere.

Cost: 208 triangles, one opaque material batch, muted nonemissive mineral finish and physical metric UVs. This preview does not brighten the glazing or manufacture visibility with emission. The single-support native oblique preview showed the stem and wider pedestal through the glazing without an observed floating join or new clipping.

## Verification and limits

Three targeted tests verify closed manifold edges, finite nondegenerate geometry/normals, actual section widths via rays, exact bounds, no automatic repeated schedule, and invalid-station rejection. The test decodes the actual source-pinned GLB and scans the proposed column volume in perpendicular horizontal directions from sourceY 8.1 through 17.5: no original surfaces duplicate the support. It then assembles the current facade and checks actual floor/roof lining hits and exterior-first-hit coverage in front of the proposed support. The roof-edge overlap is bounded to 10mm. TypeScript passed during implementation. Geometry storage is 15,072 bytes. The preview center is source-local(-48.1773,7.825,-19.1209), world(596.5211,7.905,-641.4611) after the existing +0.08m landmark lift.

The module completes one reasonable section-supported structural type while retaining uncertainty about longitudinal registration, precise section dimensions, and finish. A complete group requires a corroborated primary station rhythm; the existing ten curved frames are not evidence for ten primary columns. Do not simply thicken the 200mm curved ribs to substitute for this separate support system.

## Opt-in five-support candidate

After the single joined support was visible in the native oblique view without an observed floating join or new clipping, the next candidate is five columns at stations 39.1068, 46.2172, 53.3275, 60.4378 and 67.5482m. `CANADA_PLACE_CENTRAL_PRIMARY_STATIONS` exports this schedule; the helper default still creates only the original single preview. Root owns loader activation and native acceptance of the repeated candidate.

The 7.1103m spacing uses every second existing central curved-frame plane, preserving the accepted middle support. This keeps the primary structure substantially sparser than the glazing framing. Enlarged SACO and official west views show roughly four-to-five dominant deeper upright/frame alignments among fine mullions, but reflections, overlapping arches and foreground posts prevent a reliable exact column count. Five is therefore an explicit bounded reconstruction choice, not an extracted or surveyed structural schedule. The end offsets within the central 33–70m group are approximately 6.11m and 2.45m; symmetry is not assumed. Section dimensions, inward plane and materials remain unchanged.

The full candidate costs 1,040 triangles in one opaque batch. The existing actual-GLB volume and current-facade floor/roof/exterior-first-hit test now covers every proposed station, using each station's local axes. The isolated-preview API and invalid-station checks remain in place. The integrated five-support candidate was inspected in normal front and oblique walking views. The separate deeper uprights and wider pedestals read through the glazing; no obvious floating join or new clipping was observed. The spacing and dimensions remain estimates.
