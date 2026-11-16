# E30 gameplay trial

2026-11-15/16. Accepted incremental hero-car upgrade for the Canada Place/Howe daylight scene. Public deployment verification is pending.

## Asset and integration

The Martin Trafas BMW M3 E30 is a CC BY 4.0 asset, obtained as the attributed
pedrosoandre/carros simplified derivative. See [provenance and preparation](e30-coupe.md).
The prepared 5,897,216-byte GLB retains all 52,728 triangles, 30 meshes and 15
materials. Estimated unique-image RGBA8 allocation with mipmaps is 36 MiB,
compared with 96 MiB for the downloaded derivative and 38.27 MiB for Car Concept.
These are calculated texture allocations, not measured VRAM or FPS.

An explicit hero request selects the coupe for startup and summoned cars.
Ambient moving and parked cars use the existing traffic asset. In coupe mode,
the larger Car Concept asset is not loaded; a failed coupe load falls back to it.
The coupe has no authored distant LOD and never switches to an unrelated car.

The adapter expands quantized coordinates before baking transforms. Metric scale
and +Z front are retained. Measured length is 4.36203 m; wheelbase 2.591114 m;
tire radius 0.311631 m. Source front steering is removed using actual axle frames.
Tires/rims/discs roll; calipers and nested logos only steer. Body centering is
baked into vertices so suspension animation cannot erase it. A full rolling and
steering envelope supplies the per-model contact footprint, while ambient cars
retain their larger existing footprint.

## Material findings

The first same-position native candidate exposed two defects. The paint ORM has
uniform white metalness and roughness channels, making its effective source
metalness 1 and roughness 0.5. Recolouring that conductor dark teal produced a
dark, excessively metallic appearance. The revised material uses dielectric
paint (metalness 0, roughness 0.4) beneath clearcoat (roughness 0.12), retaining
the source maps and colour control.

The rear emission map is grayscale. With transmission removed and the source
lens opacity still 0.25, most white reflector emission remained unfiltered.
The revised reflector uses a red emission mask, and the textured lens uses
opacity 0.75 and roughness 0.2. This remains one combined rear-light material,
not independently modelled indicators and reverse lamps. Thin alpha glazing
avoids a second city-wide transmission render. Windows retain the source tint.
Paint and windows receive the existing local street reflections by material
role; source names and wheel materials remain intact.

## Validation so far

- Actual decoded-asset tests cover metric vertices, wheel transforms, full
  steering/roll envelope, map preservation, clone independence and local-reflection
  binding without extra cube captures.
- Mixed-footprint tests cover translation/rotation, vertical separation,
  recovery, broad-phase extent and unchanged legacy contact defaults.
- Initial native driving changed wheel roll to 19.435 rad; braking stopped at
  speed 0; both front carriers matched steering 0.52923 rad. Exit returned to
  ordinary on-foot gameplay beside the coupe, with no recorded browser warnings.
- The first integrated suite passed 689 tests. Later material/surface changes
  require their final verification before release.

Local evidence is retained under `artifacts/local/e30-*`. The initial matched
chase and side views are a comparison, not an acceptance of the metallic paint.
GTA 6 remains a visual reference; neither this car nor the scene is claimed to
meet AAA fidelity. Broader architecture/material detail, animation and sustained
smoothness remain unfinished.

## Corrected native acceptance

The corrected side/chase views retain the same X/Z and heading as the first
comparison. Car Y changes from8.250426 to8.337528 because the road contact now
uses the actual rendered road triangles; pitch/roll follow those same surfaces.
The independent visual review accepts the calmer painted finish, rim detail,
production proportions and red rear lamps as an incremental upgrade. Black
cabin glass, an empty rear plate area and some broad reflection waviness remain.

Forward driving, reverse, braking to speed0, walking exit, pistol15→14 and
reentry passed in the existing Codex tab without recorded warnings/errors. The
new car is selected by default; `?car=concept` retains a comparison/fallback path.

A car-only final-road triangle index resolves the earlier finish/support mismatch
without changing rendered geometry or pedestrian collision. The actual full map
retains769,712 triangles and139,003 cells:27,709,632 XYZ bytes plus5,822,952
cell-index bytes, or33,532,584 typed bytes (31.98MiB), excluding JavaScript Map
and array-object overhead. The smaller850,804-byte test fixture is local only.
This is an additional CPU-memory cost, not a texture-memory saving. Future
local streaming/bounding can reduce it, but this checkpoint preserves finished
road contact across the map with no transition discontinuities.

Focused tests compare618 mapped road ray hits, layered bridges, custom Howe
finish, Canada pier support, disposed geometry independence and off-road fallback.
Existing pedestrian sweep capsules remain conservative; the fitted rectangular
footprint applies to vehicle/vehicle contacts and wall correction. No wheel
suspension/independent tire deformation, real-time ray tracing, interior/driver
rig or sustained FPS improvement is claimed.
