# West facade registration and separated identity lettering

## Independent evidence

- [SACO Canada Place lighting project](https://saco.com/wp-content/uploads/2016/09/SACO-Canada-Place.pdf), public supplier PDF: full five-sail views on pages1,3,4. Cached `saco-overview.png`, `saco-extra-3.png`, `saco-extra-4.png` and the PDF in `artifacts/local/canada-place-pedestrian-references/`. The `/2016/09/` URL is publication context, not proof of capture date.
- [Official Canada Place Flickr photograph5973727240](https://www.flickr.com/photos/canadaplace/5973727240/), independently captioned as west-side Sails of Light. Cached `official-west-night-2011.jpg`; image URL https://live.staticflickr.com/6012/5973727240_d9ed52f3f3_b.jpg . It independently confirms the same opaque bays and separate words.
- Juan Tanus, BC Museums Association *Roundup*, Fall2012 p21 ([publication](https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf)). The enlarged `museum-lettering-review.png` resolves CANADA; it does not establish a single contiguous CANADA PLACE word. Earlier feasibility-only northern combined-word suggestions are superseded.
- [MCM Architects](https://www.mcmparchitects.com/projects/canada-place/) Handford photographs, URLs uploaded2025/09, capture dates unverified. Cached originals and `mcm-contact-review.png`/`mcm-contact-review2.png`. These corroborate mast and promenade context; images08/10 show the other upper/east-facing promenade and are not used to invent west glazing details.

All photographs are reference-only. No photograph, font or third-party letter mesh is added to runtime assets. The excluded scan was not used.

## Registration versus estimates

In the supplier and official west views, the rounded northern hall is left, the southern hotel/city side is right. Thus source west mast order is bays4,3,2,1,0 from image left to right. Internal opaque round-opening bays occur near source masts3 and1; CANADA occupies the northern fascia beyond the former, PLACE the central fascia between the two. This is a strong topological registration, not photogrammetric measurement. Perspective, outward offsets and occlusion prevent exact survey-like boundaries.

Authored approximate solid intervals are stations19–33 and70–83m. The wall plane is the existing middle-curve/upper-fascia outward datum9.9243m (profile17), multiplied by the existing local scale. This keeps the wall recessed behind the projecting lower canopy. It is not an unsupported flat slab at14.4m. Walls extend local7.8–17.65m with closed backs, roofs and lateral returns. Ground doors/glass stop at these bays; the ground collision outline recesses to match, retaining only its existing120mm frame allowance. Actual facade triangles split at mapped station bends so the ground plane does not bow outside that outline.

Round apertures are estimated3.4m diameter at localY14.3, with280mm-deep closed dark infill and a pale central divider. Independent image measurements are approximately50/142 and41/102 of wall height; the second base is partially rail-occluded. These support a substantial opening rather than the initial undersized2.1m sketch, but not precise real dimensions. No unverified service-door pattern or playable interior is introduced.

Upper fascia intervals are0–19,43–65 and87–103.10m, interrupted by the two solid bays. Between these zones the three glazing tiers remain. Guard/coping follows each actual step and closes its transverse connections. The existing outer public route and anchor coordinates are unchanged. The new solid wall stays roughly1.9m inward of the stay chords at roof level before conservative cable-radius allowance; full-mesh intersection testing is the final geometry check.

## Original lettering

`addCanadaPlaceLettering(parent)` appends a single batch under the unchanged source group offset+.08Y. It mounts PLACE centred at station54m, width7.4m, and CANADA centred94.5m, width8.4m. Letters span localY15.58–17.32, have100mm extrusion with8mm edge bevels, and small physical stand-offs. Each glyph follows the actual changing fascia plane; it is not one floating flat word. These sizes and exact stations are explicit estimates within the independently identified fascia zones. Outlines are original hand-authored sans-serif polygons, not a bundled/traced font. The separate helper is integrated by the parent loader.

Final integrated costs including closed-volume lining, interior closures and boundary ribs: facade 45,366 triangles in 10 meshes (9 material instances because solid walls reuse the existing wall material); guard 5,076 triangles; lettering 1,516 triangles, one material/draw. Removing incorrect glazing and doors reduces triangle cost despite the added architectural identity. Static batching and visibility determine the actual native submissions.

Focused validation covers unchanged source selection/paving, opaque walls and closed round infill, both-sided transition returns, no glass/door remnants in the bays, walkable former door-plane recesses, guard support, preserved lettering mounting/face orientation and height clearance. Root owns full car-capsule route testing and native appearance acceptance. Material/lighting cues from nighttime images are not treated as daylight albedo or permanent emission evidence.

Letter order follows the public west view: higher/northern stations are screen-left, so each word reads toward decreasing/southern stations. Glyph mapping preserves outward front-face winding; the mounting test casts from the public side onto the first P stroke. All glyph outlines are original and font-independent.

Final integration passed all 308 tests and the production build, including the finite body/hardware intersection checks and complete route/capsule tests. Native review verified the separate lettering, round opening, glass-side edge ribs, walking through the new recess to the visible wall and back, and the repaired third-person camera. Exact photographic/AAA parity is not established.

The glass-side perimeter at stations 19, 33, 70 and 83 now has a continuous curved end rib joining the longitudinal rail ends to the opaque return. It uses the existing exterior-end member width of 100 mm, an estimated detail supported by the pale framed boundaries in the source photos. Its profile comes from the non-solid side; no rib is placed inside either solid bay and the ground footprint is unchanged. Boundary tests cast mid-segment rays along each applicable curve to distinguish the new perimeter member from nearby horizontal rails.
