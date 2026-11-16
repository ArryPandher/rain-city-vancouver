# Ironworkers eastern paired repair shed

2026-11-16. One additional source-gap correction: **OSM w23776220**, the broad
repair shed immediately west of the previously modeled narrow workshop w23776223.
The old generic flat block becomes two longitudinal pitched halls with a central
valley, western roof-light bands and the eastern lean-to portion contained by its
original stepped plan. No boats, mooring basins, cranes or yard furniture are added.

## Registration and interpretation

The cached [DNV2024 orthophoto](https://geoweb.dnv.org/arcgis/rest/services/Basemap_Ortho2024/MapServer)
shows both roof ridges, the valley, pale transverse roof-light strips on the western
hall and the stepped eastern boundary. The georegistered overlay
`artifacts/local/ironworkers-reference/dnv-yard-registration.png` identifies this
exact footprint in red. `dnv-east-workshops-2024.jpg` resolves the roofs at higher
scale. The [Graham bridge-improvements photograph](https://www.grahambuilds.com/ironworkers-memorial-bridge-improvements/)
looks north along the eastern bridge edge and shows the same paired end faces
beside the open yard. These retained photographs are visual research only; no new
remote download or redistributed photo texture is part of this change. DNV2024's
blank individual image licence is not treated as permission to ship its pixels.

Exact ordered source ring, in world x/z metres:

`[6825.1,-1902.9, 6855,-1902.3, 6855,-1932.6, 6858.7,-1932.6, 6857.5,-1964.2, 6822.6,-1963.5]`

It spans approximately 35×61m, including the original eastern step. It comes from
`public/data/vancouver-east.json`, SHA256
`1977b623c82edabe032b5524e3f951d7ef466a94bae4b0f436cccd0a94a7f295`.
[OpenStreetMap way23776220](https://www.openstreetmap.org/way/23776220):
**© OpenStreetMap contributors, ODbL1.0**. Authored model and materials are original.
No business operator is identified from the appearance alone.

The roof's ridge/valley arrangement and roof-light placement are observed, while
**6.4m main eaves,9.5m ridges, roughly15m hall widths, roof-light widths/spacing,
lean-to slope and end-door proportions are photo estimates**, not survey values.
Source height/level tags are absent; the prior12.8m flat height was generic.
The source's mildly skewed walls remain exact rather than forcing a rectangle.
Roof-light panels replace their roof cells and are opaque weathered translucent-
material approximations; there is no duplicate overlaid roof plane or open hole.
End doors are closed shallow panels, retaining the private solid footprint.

## Contact and gameplay visibility

The footprint remains entirely on the existing mapped dry yard. Roof cells are
clipped against the actual six-vertex source ring, including its concave step;
outer wall edges descend to the same zero-local-height base. The caller's existing
ground offset is applied exactly once. The original all-height building collision
remains unchanged. No new support, water cut, retaining wall or coastline edit is
introduced. The source ring itself limits the exterior, with only end-panel
projection below0.1m. Neighbouring workshop and all other generic buildings retain
their separate source dispatch.

From the earlier crest[6797.68,−1704.90], the shed is around233m away and11.9° east
of north. However the parent's normal native drive at[6806.54,38.56,−1670.69]
confirmed that the physical3m bridge fence screens most of the yard and low roofs,
even with a modest east glance. **Expected driving-camera impact is limited.**
This pass corrects a registered local building, not the larger panorama scale,
road-surface repetition or fence aliasing. Native acceptance is still pending.

## Guard and validation

The exact ID must be unique and retain its ordered footprint, kind and absent
height/level tags before the generic shell is replaced. Failed validation leaves
the generic fallback active. The replacement emits once and coexists with the
adjacent workshop dispatch without altering source arrays or caller batch offset.

**692 triangles in5 material batches**, no texture/image requests. Closed main
shell/roof/roof-light topology has exactly two uses of every welded edge. Tests
cast front-sided rays over more than1,100 positions inside the entire footprint
and from outside all six wall faces, including the re-entrant step. They also
check base closure, positive exterior volume, bounded source contact and atomic
fallback for absent/duplicate/edited source.

`npx tsx --test tests/ironworkers-repair-shed.test.ts tests/ironworkers-yard.test.ts`:
6 passed. The shed's3 focused tests also passed after adding per-face outward-ray
checks. Full TypeScript passed. No full build, browser, distribution output or
publication was performed in this subtask. The parent owns integrated native
review and project logging.
