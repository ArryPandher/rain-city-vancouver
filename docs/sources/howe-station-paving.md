# Howe station forecourt paving

**Native acceptance is pending.** This pass replaces generic concrete inside
the observed patterned forecourt with a source-fitted pale grid and warm infill.
It changes surface appearance without changing the existing walking elevation.
The source dimensions are estimates, not a paving survey or confirmation of
present-day condition.

## Source and fit

The primary reference is the [City 2022 orthophoto service](https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer),
photographed June 6–July 1, 2022. The cached original is
`artifacts/local/howe-station-reference/city-2022-howestreet-ortho.jpg`;
`downloads.json` retains the exact tile URLs and `crop-georeference.json` the
pixel registration. The historical street photograph from the
[2015 Howe Street entry article](https://vanasitwas.wordpress.com/2015/08/09/waterfront-station-howe-street-entry/)
is cached as `artifacts/local/granville-howe-reference.jpg`. It supports the
warm infill/pale-band relationship but is too oblique and low resolution for
an independent metric fit. Both images remain research references, not runtime
textures. Aerial shade, trees and roof occlusion are not painted into the material.

The exposed field has broad pale bands framing warmer, darker infill. A
two-axis periodic fit to the original mosaic finds a **14.75-pixel repeat**
at an image cross-axis angle of approximately **41–42°**. This agrees with the
street/pavilion orientation. Smaller diagonal-looking infill marks are not
sufficient evidence for a particular herringbone or brick laying pattern.

The fit subtracts a 5-pixel Gaussian blur to reduce broad illumination, then
maximizes the product of two perpendicular periodic components. The sample is
the exposed street-side strip, with trees and shadows retained. A 10–60-pixel
period check did not identify a stronger double-size fundamental. These checks
support the grid scale; they do not establish survey precision. The projected
resolution **0.149291 m/pixel** converts to about **0.0973784 ground m/pixel**
at this latitude, rather than being used directly. The resulting game-coordinate
repeats are **1.4318 m** and **1.4306 m**.

The compact source record is [howe-station-paving-fit.json](howe-station-paving-fit.json).
Local reproducibility artifacts are `paving-fit.py`, `paving-fit.json` and
`paving-fit-overlay.jpg` under `artifacts/local/howe-station-reference/`.
The overlay compares equally brightened source and predicted bands; it is not
a calibrated albedo image.

| Parameter | Runtime interpretation | Uncertainty |
| --- | --- | --- |
| Square repeat | 1.43 m | approximately ±0.10 m |
| Broad pale band | 0.40 m | plausible 0.30–0.55 m |
| Band-intersection origin | x478.71652, z−432.33508 | approximately ±0.2–0.3 m |
| Axes | normalized pavilion down/right axes | small angular fit/registration error |
| Visible polygon | 331.884 m² | edge positions approximately ±0.5–1 m |

The folded longitudinal brightness band has an apparent width around **0.57 m**,
including blur and phase smearing. The authored 0.40 m width is therefore a
bounded interpretation, not a measured slab width. A fitted longitudinal band
centre lies about 0.49 m inward from the visible street edge. The rear polygon
edges are visibility limits under roofs/trees, so this pass adds **no perimeter
border** there. The separate **730.935 m²** `HOWE_FORECOURT` support envelope is
an inferred closure and does not receive this pattern wholesale.

## Geometry and material contract

`HOWE_STATION_PAVING` in `howe-station-site.ts` owns the metric registration.
`splitHoweStationPaving` partitions only existing finished pavement triangles
inside the seven-vertex observed polygon. New boundary vertices interpolate
their original triangle's height and normal. Existing building/stair/landing
cutouts and the lower +0.065 m structural layer remain; the +0.15 m finish is
not added again. `buildCanadaPlaceApproach` disposes the original geometry only
after obtaining both replacement outputs and adds the patterned field as one
merged material chunk. The unused perimeter-course material is disposed.

The actual-map splitter fixture reports **331.18596 m²** of patterned surface
after existing cuts, **980 field triangles**, and **365 additional triangles**
from boundary partitioning. These are geometry counts, not GPU timing or an
FPS claim. The difference from the traced area is retained rather than filled
with invented pavement.

The material reuses the existing joint-free
[Granite Tile](https://polyhaven.com/a/granite_tile) crop by Charlotte Baglioni /
Poly Haven, **CC0**, documented in
`public/textures/canada-place-paving/SOURCES.json`. No new image assets are
introduced. This mineral grain does not establish that the real infill is
granite. Its samplers are cloned so the 0.72 m grain repeat cannot change other
paving materials.

The initial infill/band tints are `#8c756d` and `#b5afa2`, multiplied by the
existing mineral map. These are art estimates, not calibrated photo colors.
The opaque, nonmetallic material clamps roughness to **0.76–0.90**. Broad bands
use box-filtered periodic coverage; 6 mm seam color and 1.5 mm normal-shading
relief are restrained construction assumptions. The shader does not displace
vertices, add wet reflections/emission, or alter the normal lighting/shadow
pipeline. It preserves one unique field material rather than overriding static
batch eligibility.

## Verification and pending acceptance

Focused geometry checks cover total-area/layer conservation, original-plane
heights and normals, stair/landing exclusions and continuous metric UVs. Material
checks cover sampler isolation, actual stripe arithmetic at multiple pixel
footprints, installed Three.js shader anchors, normal lighting paths and absence
of vertex displacement. JavaScript arithmetic checks do not certify GPU
precision or visible quality. The approach integration permits the original
bounded batches plus one patterned field.

Native daylight acceptance must still compare ordinary third-person views from
the Howe corner, along the street-side forecourt and at the station landing.
Check color in sun/shadow, scale beside the pavilion/car, restrained seams while
moving, and joins/cutouts at grazing angles. Preserve normal FOV and gameplay;
this source fit does not establish AAA realism or a measured performance gain.
