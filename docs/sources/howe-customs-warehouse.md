# Customs Examining Warehouse: modeled street exterior

2026-11-15. Replaces the unrelated tiled Gastown photograph on **326 Howe
Street**, OSM `w1363485360`, within Sinclair Centre. The
[initial identification audit](howe-customs-warehouse-audit.md) distinguishes
this red-brick warehouse from the adjoining pale-stone Federal Building,
former Post Office and Winch Building.

## References and registration

The actual [Bobanny street photograph from 20 April 2007](https://commons.wikimedia.org/wiki/File:OldPostOffice.jpg)
shows five broad bays on each street face, paired rectangular windows in the
two lower brick bands and a single upper segmental-arch band. The photograph
also supports rusticated granite ashlar, shallow brick pilasters, sandstone
spring capitals/keystones, recessed green-grey window frames, a dark projecting
cornice with dentils, and curved ornamental roof caps. Its tenant signs and
awnings are dated evidence. The photograph is retained as research only and is
not used as a texture or distributed with the game.

The mapped four-corner footprint is unchanged: Howe is edge 0, 31.82 m long;
Cordova is edge 1, 37.83 m long. Adjacent buildings and the closed collision
outline are retained. The shared ground datum at its centroid is approximately
8.7003 m; sampled exterior ground ranges from 7.827 to 9.661 m. The masonry
continues below the lowest sampled ground while horizontal floor bands remain
level. The generic concrete foundation is omitted for this building because
the custom stone base owns its street contact.

## Roof measurements and interpretation

[Two City 2009 roof records](customs-warehouse-city-roofs.json) match building
group **150266**. The outer element 163477 has highest elevation 40.98 m and
median slope 37 degrees; the inset element 161612 has highest elevation
47.85 m and median slope 38 degrees. Their shared base elevation is 15.95 m,
length 37.73 m and width 32.15 m. The inferred shared neighborhood conversion
`City elevation - 7.52` places the two roof maxima at 33.46 and 40.33 m in
world coordinates. The converted building base differs from the current
shared-ground centroid by about 0.27 m.

**Highest roof elevation is not cornice height.** The City data describes
generalized historical LiDAR elements, not a current measured exterior. The
first candidate incorrectly used the high maximum as a solid central hip.
Native review exposed the oversized wedge. A fresh
[City 2022 aerial](https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/)
shows a pale green sloped perimeter around a substantial flat gravel centre,
with three small skylights. The high 47.85 m point might represent equipment,
a mast or an older/generalized configuration; its cause is not established.
It is retained as source evidence, not forced onto a continuous roof surface.

The revised roof uses the source perimeter partition and an approximately
18.5 by 12.6 m flat-centre plan traced from that aerial. The inferred cornice
is 23 m above the building datum; the narrow roof junction is 24.7597 m and
the flat centre approximately 29.3 m. The latter is a slope-guided hypothesis,
not an aerial height measurement. Plan registration allows approximately
0.5–1 m uncertainty. The stone cap is about 7.5 m above the datum; three
photo-fitted brick window bands sit above it. Exact eaves, roof slopes and
decorative caps remain estimates. These choices
replace the previous nine-level/28.8 m generic extrusion without claiming
survey accuracy.

## Geometry, materials and rendering

Both street faces have real window apertures, approximately 42 cm deep
reveals, paired lower windows, curved upper glass, arch mouldings and keystones.
The granite base uses staggered beveled blocks with shallow irregular face
geometry; the cornice has a continuous
mitered corner and individual dentils. Six curved parapet caps, standing roof
seams, three small rooflights and low equipment follow visible source features.
Other faces and the pitched roof close
the volume. No playable interior or invented coffee-shop branding is added.

Eight materials reuse existing licensed PBR image sources:

- Rob Tuytel's [Red Brick](https://polyhaven.com/a/red_brick), CC0.
- Charlotte Baglioni's [Granite Tile](https://polyhaven.com/a/granite_tile), CC0,
  using the previously prepared joint-free mineral crop.
- Rob Tuytel's [Green Metal Rust](https://polyhaven.com/a/green_metal_rust), CC0,
  using the previously neutralized patina maps.

Original attribution and processing remain in
`public/textures/landmarks/SOURCES.json`. These are generic material scans,
not scans of the warehouse. Texture samplers are cloned so this building does
not change other landmarks' texture scales. Brick modules are approximately
225 by 75 mm; the masonry geometry supplies metre UV coordinates.

Recessed windows use a closed coated-glass proxy. One 128-pixel static street
capture supplies the surrounding view, with the existing refresh/fallback
and renderer-state restoration behavior. It adds capture work at startup and
on relevant lighting changes, not every frame. This is approximate reflected
context, not ray tracing, exact multi-view parallax or modeled interior rooms.

## Validation

The revised candidate totals **34,070 triangles, 67,006 vertices and eight material
batches**. All 14 final focused geometry, shared-ground integration and reflection
tests pass, as does TypeScript and the production build. Ray checks cover the
actual paired and arched openings, their recesses and glass backings, roof and
cornice closure, shared-ground contact, and the unchanged closed collision
footprint. Upper mullions reach the curved heads; brick courses continue
horizontally around vertical jambs. Source normals, metric UVs and material
sampler isolation were checked separately.

Native local review compared the station approach, the street corner and close
stone/window views against the source photographs. It rejected the first solid
roof hip and overly bright stone treatment. The revised model has a broader
flat roof centre, separate pale-green roof/dark cornice materials, shallow
irregular ashlar relief and more legible glazing. The raw street cube was
inspected and contains the surrounding street and sky.

Actual inputs verified startup, vehicle exit, walking to the warehouse, pistol
fire (15 to 14 rounds), driving through the Cordova junction to 63 km/h, braking
to zero and exit. The car accumulated 105.61 m of travel, including coasting
between observations. Thirty reflection captures completed with no reflection
error; captured warnings/errors were empty. This was not a full Fairmont
driveway loop or a controlled performance benchmark.

Actual gameplay: [station approach](../screenshots/howe-warehouse-approach.webp)
and [warehouse corner](../screenshots/howe-warehouse-corner.webp). Final public
release and CI evidence are recorded in the project log after deployment. The full GTA 6/AAA scene target remains unachieved;
this replacement addresses one conspicuous architectural error in the main
Canada Place/Howe gameplay view.
