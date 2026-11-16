# Granville Square south entrance canopies

2026-11-16. Bounded exterior candidate for **w128409618**. Adds the three photographed glazed entrance canopy modules on the south D→A elevation. The tower shell, base, plaza, adjacent parkade and existing probe location remain unchanged.

## Source and placement

The [Cadillac Fairview owner aerial](https://assets.cadillacfairview.com/transform/f5d7a51c-9cdf-44b1-9d3f-aac40189536a/200-Granville-Aerial), cached at `artifacts/local/granville-tower-reference/owner-aerial.jpg`, shows three glass canopy modules along the first three south base bays, dark supporting members, and a pale solid “200” surround on the fourth bay. The short south face is identified by its eight office bays and four base bays; the neighboring PwC tower is west, and the longer east face overlooks the harbour. The four-bay base registration is already documented in `granville-square-tower.md`.

Research crop `artifacts/local/granville-tower-reference/entry-canopy-review.png` extracts original pixels x755–929/y1150–1294 and enlarges them 4× for inspection. Enlargement adds no measured detail. Roof modules, repeated dark ribs and vertical supports are visible; exact metal profiles, individual fixings and pane thickness are not. The photo is research only and does not ship as a texture.

The retained south facade runs D[549.048599,−438.630000]→A[575.548599,−426.130000], approximately29.30 m. Three of its four base bays imply a canopy group around21–22 m wide. The candidate places each module inside its actual7.325 m base bay with0.35 m end setbacks: clear module width about6.625 m, group extent about21.275 m. The shallow outward projection is fitted at2.65 m, inside an approximate2–3.5 m photo-supported range. Those projection bounds express perspective uncertainty, not surveyed dimensions.

Relative to the unchanged tower construction datum, roof height is3.62 m at the wall and3.40 m at the front, a modest drainage slope. A roughly3.3–4.2 m envelope is consistent with a canopy over the lower glazed opening and below the mezzanine. The chosen roof attaches above the accepted3.132 m lower front-opening head, within the existing solid middle band. No historical-plaza datum correction is silently applied. The previously documented approximately4.23 m historical plaza/live-ground mismatch remains unresolved.

The source establishes repeated framing but not a dimensioned shop drawing. Five subdivisions per module, 65–100 mm beams, 110 mm front posts and25 mm nominal glass contact thickness are explicitly authored structural estimates. Six thin front posts land25 mm into the actual sampled ground. Roof glass is rendered as one optical DoubleSide sheet, with real metal beneath it; no duplicate underside attenuates the image twice. Top contact is exactly the rendered sheet plane.

## Fourth-bay boundary

The actual map-footprint check found the fourth-bay surround would overlap separately owned parkade **w116527978**, beginning near[569.0486,−429.6300]. This is a real source/runtime interface conflict. Accordingly, **no “200” surround or lettering is implemented**, and no neighboring facade, roof, ground or collision is cut. Root approved retaining only the three clear canopy modules. The future surround needs explicit registration of the parkade/plaza interface, not a relocated sign or hidden overlap.

## Rendering and contact

`createGranvilleSquareEntranceSite(groundHeight)` supplies the same roof planes and post extents to geometry and collision. `createGranvilleSquareEntranceGeometry(site)` returns two world-coordinate geometry roles: `frame` and `glass`. Tower-owned integration merges the frame geometry into the existing muted bronze material. The one new glass material reuses the existing dielectric sheet pipeline (survival0.88, IOR1.5, roughness0.10), shares the current southeast128px capture, and uses `forceSinglePass` with `DoubleSide`. No new image asset, light, texture download, capture or refraction render is added. Physical members cast and receive existing shadows; the optical sheet does not cast an opaque slab shadow.

The exact tower-ID-gated CollisionWorld hook installs only finite post/roof contact and roof landing support. It does not modify baseline or public walking height. Ordinary unspecified height queries stay at ground; only an actor already near the roof can obtain roof support. Camera spheres respect the pane and finite underside, and clear air above remains available. Ground-level travel beneath and outside each module is preserved. At these clearances the existing ordinary jump (initial5 m/s, gravity17 m/s², maximum rise about0.735 m) plus the1.8 m collision body remains below the canopy. There is no new opening into the tower or underground access.

## Verification and native acceptance route

Six focused tests plus scoped strict TypeScript pass. Tests execute the actual architecture hook and real CollisionWorld against converted map/tag records; image/canvas loading alone is stubbed. They verify:

-147 interior roof rays match rendered support within30 micrometres; ground support stays unchanged, jumped/roof-height bodies and camera spheres respect finite contact, and standing actors remain above the sheet.

- All six posts meet the sampled floor; projected triangles do not overlap the separate parkade, Howe wing or PwC source footprints.
- Actual under-canopy and outer walking-strip probes remain unblocked and retain identical old walking/default heights. The provider is absent without the tower ID.
- Existing neighboring Howe-wing and unrelated-building geometry remains byte-identical. The tower body is unchanged; the entrance adds **402 triangles**, yielding **45,540 triangles in seven material batches**, with the same single probe.

Root should start from the existing ordinary **Howe tower-near** view at[570,6.25,−452], lower the normal look direction toward the base and turn toward the three southern bays. Walk toward the middle module around[559.52,ground,−435.07], travel laterally beneath the modules, and test the front posts and upward camera movement. The wide tower view remains a secondary context comparison because the low Howe wing obscures part of the base there. Compare the silhouette, thin translucent roof, dark ribs, attached height and open walkway against the owner crop, rather than treating a distant tower-only shot as canopy acceptance.

No browser, build, deployment or sustained-performance claim is included in this candidate. Native appearance and the normal walking route require coordinator review before release.
