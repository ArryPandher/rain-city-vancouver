# Howe shared ground and station source registration

2026-11-15. Source and integration contract for the Canada Place/Howe arrival,
Fairmont, PwC, Granville Square Howe wing and the separate Howe station pavilion.
This document consolidates the elevation and orthophoto research, implemented
shared-ground contract and validation for this pass.

## Common elevation convention

Use one local conversion for the shared **finished walking surface**:

```text
finishedY = publishedElevationH - 7.52
baselineY = finishedY - 0.15
```

The fixed Canada Place deck is **finished y7.88**, hence baseline **y7.73**.
This registers the Framework's existing Canada Place/Howe **H15.4 m** to the
authored deck. It is a chosen local registration, not proof that the model's
original y=0 represented a geodetic datum. Road/asphalt, curb, pavement and
threshold offsets must be applied to the appropriate baseline; do not add
another 0.15 m to a value already identified as finishedY.

| Location | Published or fitted H | Finished y | Baseline y | Evidence class |
| --- | ---: | ---: | ---: | --- |
| Canada Place/Howe | 15.4 | **7.88 fixed** | 7.73 | Existing Framework label; chosen model anchor |
| Howe/Cordova | 16.0 | 8.48 | 8.33 | Inferred junction, approximately ±0.5 m |
| Station entry landing | 15.6 | **8.08 inferred** | 7.93 | Controlled neighbourhood/photo fit, approximately ±0.5 m |
| Granville/Cordova | 12.3 | 4.78 | 4.63 | Existing Framework label; different junction |
| Howe/Hastings | 19.5 | 11.98 | 11.83 | Smooth fit between nearby contours, approximately ±0.75 m |

The source does not distinguish street/curb finishes to centimetre accuracy.
Allow roughly 0.15 m for the selected finish convention in addition to the
larger source uncertainty. Station H15.6 is the adopted fit described here; it
is **not** an assertion that the Framework's proposed 15.6 m roads were built
at this station.

## Elevation evidence

### Existing planning levels

The City's **Central Waterfront Hub Framework**, printed/PDF page 17, Figure 18,
was re-rendered and visually checked. The black existing **15.4** label belongs
to Canada Place/Howe. The black **12.3** label belongs to Granville/Cordova, not
Howe/Cordova. The accompanying elevation discussion uses metres. Red A/B/C/D
locations and their proposed 15.6 m/13 m levels are feasibility parameters,
not surveyed existing station controls. The text also identifies existing
Granville Square parkade P1 at 14.9 m, distinct from its upper plaza.

- [Official Framework](https://guidelines.vancouver.ca/policy-plan-central-waterfront-hub-framework.pdf)
- [Smaller copy actually rendered, page 17](https://vancouverwaterfront.org/wp-content/uploads/2015/05/cov-hub-plan-low-resolution.pdf)
- [June 2009 endorsement record](https://council.vancouver.ca/20090707/documents/penv20090611min.pdf)

The [2006 City report](https://vancouver.ca/ctyclerk/cclerk/20060418/documents/p1.pdf),
Appendix A page 1/PDF page 5, describes Granville Square's front door/plaza about
18 ft above adjacent Cordova. That supports a multilevel site; it does not place
the Howe station landing at the upper plaza elevation. Historical levels in
feet in the [2005 structural report](https://bids.vancouver.ca/bidopp/RFP/documents/Appendix6-GranvilleExtensionREPORT.pdf)
have no verified project-datum conversion here and are not used as controls.

### Independent City contours

The [City 1 m contour dataset](https://opendata.vancouver.ca/explore/dataset/elevation-contour-lines-1-metre-contours/)
states that it was digitized from **2002 orthophoto acquisition data**, has not
been updated and must be considered approximate rather than surveyed. Its
elevation field has unit metres. Its metadata does not declare a vertical datum;
the separate 2022 LiDAR dataset's CGVD28 declaration is not proof of this
dataset's datum. Contains information licensed under the
[Open Government Licence–Vancouver](https://opendata.vancouver.ca/pages/licence/).

The bounded request returned 37 records. Reproduce it against
`https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/elevation-contour-lines-1-metre-contours/records`
with `limit=100` and the following `where` parameter, URL-encoded for HTTP:

```text
intersects(geom, geom'POLYGON((-123.11662539865371 49.284854532296,-123.11049602069818 49.284854532296,-123.11049602069818 49.288925456848204,-123.11662539865371 49.288925456848204,-123.11662539865371 49.284854532296))')
```

Coordinates follow `src/world/data.ts`, not raw Web Mercator:

```text
x = (longitude + 123.12) * cos(49.2935 degrees) * 111320
z = (49.283 - latitude) * 110540
```

Crossings below are intersections of old contour segments with the current
mapped road centrelines in `public/data/vancouver-roads.json`. Their decimal
precision records a calculation, not survey accuracy. The local research file
`artifacts/local/howe-elevation-controls.json` retains 18 source controls,
4 separately inferred controls, exact contour and road segments, nearest-point
evidence and raw crossings on 24 roads.

| Source control | World x,z | H, metres |
| --- | --- | ---: |
| Howe just south of Cordova | 439.926, −395.694 | 16 |
| Howe beside PwC | 481.410, −447.094 | 16 |
| Cordova west, about 42 m along road | 416.043, −431.408 | 16 |
| Cordova west, about 127 m | 346.309, −479.703 | 17 |
| Cordova west, about 159 m | 318.841, −496.252 | 15 |
| Cordova west, about 175 m | 305.039, −504.269 | 14 |
| Cordova east | 480.131, −357.633 | 15 |
| Cordova east | 496.629, −341.210 | 14 |
| Granville/Cordova, Framework instead of contour | 518.700, −328.000 | 12.3 |
| Cordova east, about 160 m | 558.673, −288.871 | 14 |
| Howe toward Hastings | 411.298, −366.225 | 17 |
| Howe toward Hastings | 403.322, −358.187 | 18 |
| Howe toward Hastings | 390.667, −345.437 | 19 |

The nearest 16 m contour is 5.649 m from mapped Howe/Cordova
(443.72382,−400.02215). At the station entry (479.74852,−428.51936), a 15 m contour
is 6.552 m away at (485.537,−425.450), and a 16 m contour is 18.410 m away at
(484.290,−446.360). These support the adopted junction/landing range, not an
exact threshold survey or station stair drop.

Fit a constrained smooth road profile rather than visiting every contour
intersection. At Granville/Cordova, the closest old contour is 13 m, about
4.87 m away; its difference from the Framework's 12.3 m is within the kind of
source/registration uncertainty that this candidate must retain.

Reject packed contours as upper-road grade near the Burrard viaduct
(x269–276,z−518 to −524), east of Canada/Howe (x522,z−490), and beside northern
PwC (x514,z−456). Several metre contours occupy only centimetres or a few metres
in plan there. They describe retaining edges, other levels or historical
surface differences; indiscriminate nearest-contour interpolation would create
impossible drivable slopes.

## Pavilion and terrace horizontal controls

The candidate trace is recorded in
`artifacts/local/howe-station-reference/howe-station-source-candidate.json`.
It was fitted from the [City 2022 orthophotos](https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/),
captured June 6–July 1, 2022 at 7.5 cm source resolution, under the Open Government
Licence–Vancouver. The verified public service is:

`https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer`

The local manifest records nine context tiles at level 20, rows 358825–358827,
columns 165693–165695, and four detail tiles at level 21, rows 717653–717654,
columns 331387–331388. Request pattern: `/tile/{level}/{row}/{column}`.
The 13 source images total **121,683 bytes**. Level 20 resolution is
0.14929107082380833 **projected** m/px, approximately **0.0973784 ground m/px**
at the entrance after applying cos(latitude). Using projected metres as ground
metres would produce a materially oversized pavilion.

The [historical street photograph and 2015 article](https://vanasitwas.wordpress.com/2015/08/09/waterfront-station-howe-street-entry/)
cross-check the curved glazing, framing and pale plinth. Its locally cached
reference is `artifacts/local/granville-howe-reference.jpg`; the
[original image](https://vanasitwas.wordpress.com/wp-content/uploads/2015/08/img_0368.jpg)
is research evidence, not a runtime texture or an asserted redistributable asset.

| Pavilion trace/fit | Value |
| --- | --- |
| Roof front centre | (481.02957, −430.88932) |
| Roof rear centre | (473.45938, −422.40419) |
| Axis down toward the mapped tunnel | (−0.66573, +0.74619) |
| Positive cross-axis | (+0.74619, +0.66573) |
| Fitted roof length × width | **11.371 × 4.653 m** |
| Picked roof area | 52.871 m² |
| Roof-edge picking allowance | Approximately 0.2 m |
| Overall horizontal registration allowance | Approximately 0.5–1.0 m |

The four observed roof corners, in game x,z, are:

```text
(479.22831, -432.36394), (482.83084, -429.41469),
(475.23631, -420.90540), (471.68246, -423.90299)
```

This is a **roof** trace. Ground-contact footprint is unresolved. Low-roof relief
displacement and OSM point placement cannot be separated from these sources.
No absolute or relative roof/ground height is obtained from this aerial; roof
section and structural details remain controlled interpretations of the street
photograph. Do not treat the rectangular fit as a surveyed wall base.

OpenStreetMap supplies the independent route registration, © OpenStreetMap
contributors, [ODbL](https://www.openstreetmap.org/copyright):

- Entrance node **3633792226**: (479.74852,−428.51936), tagged level 0,
  wheelchair=no. It lies 2.621 m along the fitted roof axis from the front and
  0.622 m along its positive cross-axis; that difference does not justify moving
  the aerial trace to force the entrance point onto its centreline.
- Approach **w358462237**: (487.76369,−433.02940) →
  (484.85964,−433.86950) → entrance. Preserve its connection to sidewalk
  **w338228126**.
- Descending stairs **w379737506**: entrance → (470.76776,−418.26125),
  plan length 13.634 m, axis (−0.65871,+0.75240). Tags include incline=down,
  tunnel=yes, layer=−1, handrail=yes, ramp=no. The mapped lower run extends
  about 4.8 m beyond the visible roof rear; its underground tag does not justify
  extending the above-ground glass pavilion to cover the whole run.

The [official TransLink entrance map](https://www.translink.ca/-/media/translink/documents/schedules-and-maps/skytrain-accessible-entrance-maps/waterfront_station_elevator_map.pdf)
supports the Howe Expo-line entrance and below-street connections. It is a
schematic without a dimensioned pavilion footprint or landing elevation.

About **331.884 m²** of adjoining paving is visible in the aerial. Its rear
edges are visibility limits at roofs/trees, not surveyed walls or changes in
height. A **730.935 m² proposed support envelope** closes from the traced street
edge to mapped wing/PwC boundaries, with roughly 1–3 m rear occlusion allowance:

```text
(466.66812, -421.43723), (478.35201, -432.65403),
(506.00389, -461.95297), (516.04860, -456.63000),
(497.54860, -437.13000), (494.04860, -429.63000),
(495.54860, -427.63000), (489.54860, -421.13000),
(484.54860, -422.13000), (479.04860, -411.13000)
```

The first three vertices follow a visible street-edge fit; the remaining
vertices use mapped building boundaries. This envelope is an **inferred closure**,
not an observed single-level terrace. Clip buildings and preserve the stair
opening. A change in paving appearance alone does not prove a change in height.

## Integration constraints and unresolved alignment

At the baseline audit, Howe climbed from baseline 0 at Cordova to 7.73 at Canada
Place while nearby buildings retained independent base conventions. Missing
support outside that road ribbon returned zero, burying the wing's lower row in
ordinary approach views. Zero there was legacy/missing terrain, not measured
street grade. Correct the shared section, rather than accepting a tall exposed
plinth or lifting a single facade to disguise an unsupported forecourt.

The candidate contract is to join the named roads, mapped walkway/approach,
station landing, terrace and building aprons into a coherent bounded field.
Move focus building bases with it; retain horizontal building floors, current
authored relative heights and the wing's **4.28 m** roof split initially. Preserve
through movement and physically close the stair/retaining/underside geometry.
A complete playable underground station is outside this exterior reconstruction.
Blend to legacy terrain only beyond the ordinary scene, not at the near
Howe/Cordova junction as an abrupt elevated island.

**Absolute roofs remain unresolved.** Wing/PwC normalization subtracts 19.32 m
from City elevations; moving their bases by around 8 m does not establish exact
City roof alignment. The [City footprint metadata](https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/building-footprints-2009)
defines BASEELEV_M as the element's lowest geodetic elevation, not its public
entrance. Fairmont's existing 15.65 m local normalization is compatible context,
not an independent lobby survey. Relative floor/roof schedules require a later
source/photo comparison; they must not independently redefine the shared street.

**The ocean remains an artistic datum limit.** `docs/sources/canada-place.json`
describes local flat-map pier/shore y=0, with no sea level or terrain baked in.
The existing ocean is drawn at **y0.065**. Under H−7.52, a geodetic zero would be
y−7.52, so these are not a single globally geodetic world. Keep that limitation
explicit without expanding this pass into an ocean reconstruction.

Source images, aerial crops, annotations and brightened research details are
**not runtime textures**. The candidate uses dimensions, mapped topology and
authored geometry/materials; the photograph's pixels are not a rendered facade.

## Implementation

The neighborhood uses one sampled construction surface. Source controls are in
`src/world/howe-ground-controls.json`; their decimals preserve registration, not
survey accuracy. A triangulated fit becomes a four-metre grid bounded by
x240–800,z−640 to −120. The station uses a one-metre detail patch. Small
half/quarter-metre patches preserve existing ground and the VCC approach's
shoulder corners without increasing the whole city's resolution. Meshes and
actors use the same triangle diagonals. Outside transitions are authored.

The VCC deck/approach and Jack Poole surface retain their original collision
and meshes, with explicit cutouts and matched joins. Canada Place remains at
finished y7.88. Howe/Cordova is approximately finished y8.48 instead of the
previous zero-ground endpoint. The actual street and forecourt follow the
shared field, including a source-guided y8.08 station landing.

The inferred forecourt envelope joins visible paving to existing walls. Both
paving and terrain exclude the complete landing and stair opening; generic
pedestrian ribbons also cut around it. The pavilion owns its finished landing,
avoiding coplanar flicker caught during the close native review. The pavilion has curved glass panels, closed silver ribs,
handrails, blue transit blades and visible descending stairs. Its front and
side glazing enclose a closed, unplayable volume. Length/width/axis follow the
aerial fit. Roof rise, spring height and 3.4m stair drop remain photo-fit estimates.
No source image was added as a runtime texture and no new reflection capture
was introduced. The pavilion is 4,442 triangles in six material batches.
The added shared ground is 73,915 triangles across 23 meshes, 3,526,402 geometry
bytes; compact height grids, including all local refinements, total 180,126 bytes.

Building centroid bases now use the same field. Narrow closed foundation strips
meet lower exterior ground; the open Fairmont/PwC recesses are excluded. Arcade
floor profiles may be negative relative to the centroid datum, so old zero
clamps and an occluding Fairmont foundation cap were corrected. Waterfront
Centre, Terminal City and its club now preserve their caller's base offset;
their existing reflection probes move with the same datum. Relative authored
floor/roof dimensions are retained, not independently geodetically aligned.

## Validation

The eleven focused shared-ground checks pass: source conversion, fixed deck,
western tie, physical outer boundaries, nested-grid containment and seams,
station landing/cutout, forecourt support, preserved VCC contact and exposed
boundary joins, building/road agreement and rendered triangle/physics contact.
The physical boundary tolerance remains 2cm, rather than accepting the metre-
scale discontinuities found and corrected during integration. Fairmont floor
rays and all 18 surrounding-building datum checks pass.

Initial native review in the existing Codex browser tab verified the visible
full lower Granville frontage, level car/foot contact, connected station approach
and curved pavilion. The full local regression run completed 566 tests: 562 passed and four old-datum/
spawn fixtures failed. Those fixtures were updated to the new source-guided
contact/clearance contract; their three files then passed all 20 tests. The final
production build passes. After the native landing-overlap correction, all 22
landing/path/walking/pavilion checks pass. The combined test suite now contains
567 tests; CI outcomes are attached to the published commit in GitHub Actions.

Native combined-build checks reached 60km/h, braked to zero, reversed along Howe,
exited at approximately (491.28,8.15,−462.46), walked to the station landing at
(482.37,8.08,−430.36), and fired the pistol (15→14). The enclosure stayed closed
to gameplay. These are actual browser interactions, not only simulation tests.
No frame-rate gain is claimed. The complete Fairmont driveway loop remains a
separate outstanding gameplay check.

The GTA6/AAA visual target remains unachieved. Generic nearby facade repetition,
uniform glazing, crowd/character animation, exact absolute roofs and sustained
smoothness still require work. This is a source-grounded exterior geometry and
contact pass, not a claim of photorealism or ray-traced lighting.

The final rebuilt native close-up verified the landing without flicker, walked
back onto the roadside at (479.39,8.16,−436.90), and fired again (15→14).
Captured browser warnings/errors were empty. The actual gameplay capture is
`docs/screenshots/howe-station-gameplay.webp`; it uses the ordinary third-person
camera and daylight. It is not a photo-mode render or a generated scene image.
