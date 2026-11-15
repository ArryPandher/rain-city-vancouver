# Canada Place inward hall frame study

2026-11-15. Source-corresponding estimated construction, not a surveyed interior. Helper is prepared separately from the loader so a single frame can be assessed before repetition.

## Registration and scope

SACO's west views place the central glazed group between the two opaque round-opening bays, below the separate PLACE fascia. The independent official west-side night photograph and Rayner section corroborate a framed envelope enclosing deeper volume. The sources establish transverse curved members and connecting longitudinal members, but not their exact count or section. No unresolved diagonal bracing, hotel grid, furniture or night emission is reproduced.

References: [SACO](https://saco.com/wp-content/uploads/2016/09/SACO-Canada-Place.pdf), [official west photograph](https://www.flickr.com/photos/canadaplace/5973727240/), [Rayner section](https://www.architects.nsw.gov.au/download/BHTS/Rayner%2C%20Michael_BHTS_Urban%20Waterfront%20Renewal_low%20res.pdf), [Juan Tanus daylight photograph, Roundup Fall 2012 p21](https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf). Cached crops and registration details are in `artifacts/local/canada-hall-structure-next.md`. No source photograph ships at runtime.

`addCanadaPlaceHallStructure(parent, {frameStations: [CANADA_PLACE_HALL_PREVIEW_STATION], ties: false})` builds one frame at station53.3275. The default candidate repeats at ten alternate regular exterior rib planes between stations33 and70, with narrow longitudinal ties at existing tier transitions. The 1.7776m exterior pitch is the existing authored pane rhythm, not an independently measured structural grid. Added data stations for material transitions and plan bends do not create extra frames.

The 75mm face, 90–290mm inward depth, 45mm ties and alternate-rib repetition are explicit estimates. Two tiers continue beneath the opaque upper fascia; three occur elsewhere. The closed volume, glass, outer envelope, ground doors, route, collision and probes remain untouched. One muted nonemissive material batch: single preview148 triangles /10,360 geometry bytes; full candidate2,400 triangles /168,000 geometry bytes. Targeted tests check inward web rays, selected station rhythm, finite geometry, tier termination and tie contact. Native daylight/lateral-motion acceptance remains the root's responsibility.

## Dimensional sanity check before repetition

The source west facade is103.0998m, but this is not the total roof or pier length. Five source west edges are4.8874,24.3604,24.7361,24.4235,24.6924m. The first bay is a splayed wedge beside the hotel: its opposite edge is55.6611m and its projected area is1,574.14m². The independent georeferenced aerial (`aerial-rings-review.jpg`) visibly shows that wedge widening southeast of the hotel north tip; all five source rings follow the real roof plan. It does not justify inventing a sixth bay or stretching the short west edge.

Across all five polygons, projection along the west-edge axis spans153.1049m and the perpendicular span is53.5080m; maximum corner-to-corner distance is160.8125m. Their total horizontal area is6,753.01m². Source pier x bounds span495.72m, including northern berthing projections; its long straight public west edge is308.10m. These different extents explain the apparent103m/whole-pier discrepancy. No horizontal rescale is supported.

Root retrieved [Birdair](https://www.birdair.com/birdair-portfolio/canada-place/) reporting91,210ft² (8,473.69m²) membrane and [RAC](https://www.rac-int.com/projects-case-studies/canada-place/) reporting mast work150ft (45.72m) above water, compatible with the authored masthead46.17m. Membrane area is a surface measure, not the projected footprint.

A separate limitation remains: reproducing the original cached `canada-facade/geometry.js` near-mesh formula at26×32 subdivisions gives11,959.40m² for the upper fabric layer alone (excluding underside and thickness), about41.1% above Birdair's stated area. Thus the authored sag/rise shape should not be treated as dimensionally verified even though the mapped horizontal footprint and mast height have independent support. This comparison flags possible excessive surface curvature; it does not determine a corrected profile, an exact scale factor, or whether the reported membrane scope is identical. Any future fabric correction needs a registered roof section rather than a global shrink.

## Web-depth review and remaining structural gap

The 2026-11-15 single-frame RGB front view (`artifacts/local/canada-optics-rgb-front.jpg`) shows modest frame thickening without an apparent exposed tip. It does not establish acceptance of the repeated layout. Root has queued the full ten-frame/tie candidate; its native acceptance remains pending.

Visual review of the original embedded SACO image at 1923×1142 and the Rayner west-section crop does not justify a substantially deeper curved web. The paired curve lines in the scanned section appear roughly 5–10% of a tier rise. Against the authored 2.3m rise, that is approximately 0.12–0.23m: an interpretive proportion, not a measured construction dimension. Line weight, raster blur and uncertainty over which lines represent frame versus glazing prevent more precision. The present 0.20m web lies within this rough range and is 5.6% of the estimated 3.555m primary repetition spacing. Retain it for the repeated native test rather than increasing thickness to force visibility.

Rayner also shows a distinct, more substantial vertical support line behind the stepped envelope. SACO's darker bands combine curved ribs, mullions, backlit overlap and deeper members; apparent photographic band width cannot isolate radial web depth. The current helper does not reconstruct those separate primary vertical supports. Registering their plane, longitudinal rhythm and connections is the next geometry task; enlarging every curved rib would conflate different structural elements. Neither exact column dimensions nor a complete column schedule are established by the present references.


## Integrated native review

The full ten-frame/tie group was integrated after the isolated frame and optical comparisons. Final local front, oblique and both along-building walking views showed continuous curves without obvious exposed tips or penetrations. The repeated inward webs are more legible, but the missing separate vertical supports still limit source resemblance. The complete checkpoint has 323 passing tests and a production build; see [native evidence and remaining work](../CANADA-PLACE-OPTICS.md). This acceptance does not convert estimated sections or spacing into measured geometry.
