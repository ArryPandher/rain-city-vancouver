# Howe station enclosure refinement

2026-11-15. This pass retains the source registration and uncertainty in
[Howe shared ground and station](howe-shared-ground-and-station.md).
The station remains a closed exterior object; its landing, source-traced roof
footprint and descending stairwell do not establish a playable underground route.

## Reference and diagnosis

The [2015 Howe entrance photograph](https://vanasitwas.wordpress.com/wp-content/uploads/2015/08/img_0368.jpg)
shows quieter intermediate framing between more substantial end arches, dark
pane edges, street/building reflections in the glazing, and a thin coping band
over pale base panels. The small image does not support exact section sizes,
rib counts, material measurements or present-day condition. It remains local
research evidence, not a distributed texture.

The preceding ordinary-gameplay view showed uniformly broad bright framing and
almost invisible glazing. Code inspection found that the station materials had
no local reflection binding: they inherited only the sky. The dielectric shader
already computes physical direct/indirect specular and Fresnel attenuation in
the scene's linear HDR pipeline; adding diffuse paint, emission or artificial
opacity would not correct the missing reflected street.

## Material and reflection changes

- End arches retain their 90 mm radial section; intermediate caps use 55 mm
  radial / 45 mm along-axis sections at the existing approximate 0.95 m spacing.
  Three 36×32 mm longitudinal bars replace the earlier duplicated spring-line
  members. These dimensions express the photograph's hierarchy, not a survey.
- Dark seals sit 4 mm outside the glazing and beneath the silver pressure caps.
  A 12 mm high, 8 mm deep coping recess is modeled in the base. Existing gable
  posts now meet the curved head. Roof glazing uses smooth ellipse normals
  across its 24 segments so reflected buildings do not break into flat bands.
- The silver framing uses a more restrained neutral conductor tint and rougher
  finish. A first near-conductor candidate became charcoal when it reflected the
  shaded street instead of the bright sky, and was rejected in native review.
  The revised silver finish uses a lighter neutral tint and more diffuse response.
  Separate dark, rough dielectric seals distinguish metal caps from pane edges.
  These are visual interpretations, not measured coating/albedo values.
- The existing CC0 mineral albedo/normal maps now have a matching roughness map
  and stronger, still shallow normal relief. Their source is Charlotte Baglioni's
  [Concrete Wall 009 / Poly Haven](https://polyhaven.com/a/concrete_wall_009),
  processed earlier for the Canada Place plinths. This is generic mineral
  texture, not a scan of the station. No new photographs or external assets
  are downloaded for this material pass.
- One 128-pixel static cube capture is placed inside the enclosure and shared
  by glass and metal. The existing capture system excludes those receiving
  surfaces and moving actors, then restores scene/light/renderer state. Three.js
  filters the map according to material roughness. Weather changes invalidate
  it, capture failure falls back to the current sky, and the low quality preset
  retains the existing reflection policy.
- The capture adds startup/weather-refresh work, not a per-frame scene capture.
  Its finite position and resolution cannot reproduce exact near-field parallax
  across an eleven-metre enclosure. It is not ray tracing. The glass remains a
  single front-facing dielectric sheet with visible modeled geometry behind it.
- This station opts into an effective two-interface slab response in that one
  sheet. For Fresnel reflectance `F` and one-way survival `A`, internally reflected
  paths give `R = F * (1 + (1-F)^2*A^2/(1-F^2*A^2))` and
  `T = (1-F)^2*A/(1-F^2*A^2)`. With no absorption and IOR 1.5 this yields about
  7.69% normal reflection; grazing reflection approaches 100%, not a blanket
  doubling. The chosen survival 0.97 is an approximate clear-glass interpretation.
  View-angle Schlick compensation of Three's rough specular BRDF remains an
  approximation, not an exact optical transport solution. PwC and Fairmont retain
  their prior single-interface shader. No diffuse paint, emission, opaque backing,
  second alpha surface or refraction pass is introduced.

## Validation

The pavilion totals **5,448 triangles, 13,100 vertices, seven material batches**:
1,006 triangles and one gasket batch above the previous version, within its
existing 7,000-triangle ceiling. TypeScript and the production build pass.
All **23 focused tests** pass, including geometry winding/envelope, clear glazing,
closed stairwell, world datum/ground contact, cap/seal/reveal depth, smooth roof
normals, metric UVs, and reflection state restoration/failure handling.
After the silver/slab calibration, another 17 focused tests pass. They include
execution of the injected slab arithmetic across absorption/angle cases,
checking bounded reflected-plus-transmitted unit radiance, normal/grazing limits,
and distinct shader cache keys. This CPU arithmetic check is not a GPU-compile
or overall scene-performance claim.

Native local production-build review checked frontal and oblique views, the
landing, walking, pistol firing (15→14), vehicle movement/braking/exit and
Performance→Balanced restoration. The initial forward drive encountered the
parked startup car; a separate reverse check reached 33 km/h before braking and
exiting. It is not evidence of a clear end-to-end Fairmont driving loop.
The final local diagnostic reports no reflection error or captured warnings/
errors. There are 29 configured captures; the cumulative count reached 37 after
nearby captures refreshed on quality restoration. Metal/glass remain shaded,
the stairwell remains visible, and glass reflections flow across the roof.

Actual local gameplay: [front view](../screenshots/howe-station-gameplay.webp)
and [street-side view](../screenshots/howe-station-side.webp).
The nearby repeating warehouse facade is still conspicuously wrong; the
[building-specific source audit](howe-customs-warehouse-audit.md) identifies the
next replacement. No claim of GTA 6/AAA parity or a performance improvement
follows from these material changes. Final public/CI evidence is recorded in
the project log after deployment.
