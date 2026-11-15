# Canada Place pedestrian paving

## Reference and scope

The west Canadian Trail photograph on [TourbyTransit](https://www.tourbytransit.com/vancouver/things-to-do/canadaplace), [direct image](https://cdn.tourbytransit.com/vancouver/images/Canadian-Trail-at-Canada-Place.jpg), was inspected locally at `artifacts/local/canada-place-pedestrian-references/tour-trail.jpg`. It shows muted medium/dark grey mineral paving, narrow orthogonal joints, and contrasting transverse bands. The entrance arch dates this reference broadly after 2012 and before 2021; it is architectural evidence, **not confirmation of the 2026 finish**. The photograph is reference only, never a distributed game texture.

A newer [Brenco fabricator article, March 14, 2023](https://www.brenco.com/whats-happening/salish-sea-the-journey-within), [direct photograph](https://www.brenco.com/images/whats-happening/Salish-Sea--the-Journey-Within-1678831506.jpg), was also inspected. It shows the west trail looking southwest: rectangular grey slab fields, fine joints and lighter aggregate transverse strips. The wet surface is not used to infer dry-day gloss or darkness. This corroborates the older layout while motivating rectangular slabs and lighter bands; exact current dimensions remain unknown.

North Point renewal evidence concerns another part of the pier. Its distinctive multi-colour pattern is deliberately not used for this west-trail treatment. The new material interprets the broad grey paving class with estimated 1.5 × 0.75 m slab joints, 8 mm joint width, 2 mm normal-shading relief and restrained transverse bands at estimated 6 m spacing. None of these dimensions is surveyed. The source top remains continuous; joints do not displace the walking plane or produce a raised overlay. Existing source perimeter edges retain their geometry.

## Geometry provenance and safety

The supplied Codriver CC-BY-4.0 source remains credited in [canada-place.json](canada-place.json). `public/models/vancouver/canada-place.glb` SHA-256 is `1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe`. The concrete primitive has 8,368 positions and 11,154 indices. Exactly 31 reviewed upward pier-top triangles at local y≈7.8 are separated into a dedicated material mesh; the loader's +0.08 m origin retains the existing approximately 7.88 m finished plane.

`extractCanadaPlacePaving` requires the material name, source counts, millimetre geometry/index fingerprint and reviewed triangle orientation. A changed asset fails closed. Only selected index entries are removed from the original primitive; its position array, remaining index order, walls and other materials are unchanged. The added top copies original positions exactly. Total triangle count is unchanged; one additional mesh/material draw call covers the whole pier top.

`canadaPlacePavingMaterial` clones the configured mineral material but now uses dedicated Canada Place paving maps. The earlier inherited façade map had deliberately compressed grain (decoded linear standard deviation 0.0085) and its roughness multiplication produced a median around 0.48 despite a 0.9 scalar. The dedicated original-source treatment restores mineral variation while matching mean floor reflectance. It does not edit any façade map or global light/exposure.

Reproduce with `node scripts/prepare-canada-place-paving.mjs`. The script pins the original Poly Haven **Granite Tile** CC0 1K JPG diffuse/OpenGL-normal/roughness URLs, byte counts and MD5 hashes. Those three files total 1,943,714 bytes (1.85 MiB) per uncached generation; verified raw files are cached in `/tmp/rain-city-canada-paving-source/`. An initial crop review plus regeneration incurred additional development downloads; the stated budget describes the three unique source inputs, not a network traffic measurement. The original source has five tiles across; the new 180 × 180 crop at (12,12) excludes the first tile's seams. It is mirrored with normal R/G signs corrected and resized to 512 px. Unlike the old compressed façade map, original grain supplies the albedo modulation directly. It is bounded around the prior mean, with no inverted amplification of old 8-bit quantization.

The new three WebP maps total **170,112 bytes**. Decoded mean linear albedo changes from 0.8239 to 0.8253, while grain standard deviation changes from 0.0085 to 0.0973. The authored material tint and all paving geometry remain unchanged. Normal strength is 0.45. Dedicated linear roughness averages 0.8005; the scalar is 1 and a shader clamp guarantees the final texture-driven factor remains 0.75–0.85 despite image compression excursions. These are dry material-response estimates, not inferred wet-photo gloss.

The source URLs, Charlotte Baglioni / Poly Haven credit, CC0 license, preparation changes and byte counts are recorded in `public/textures/canada-place-paving/SOURCES.json`. The factory loads/caches one shared set using the existing BASE URL; its one-argument loader API is unchanged. No additional geometry, draw calls, probes or global material changes are introduced. The photograph remains a reference, not a game texture.

## Verification

Actual quantized GLB integration tests pin the file hash, check all original positions and all non-paving indices exactly, reject changed/repeated extraction, and cast 324 existing public-route support rays. All hit the new paving at the unchanged original elevation with upward normals. Material tests verify dedicated map assignment, non-displacing shader construction, compressed-map statistics, mean reflectance stability, restored grain and roughness bounds. TypeScript checks pass. CPU tests do not certify WebGL appearance: native daylight review by the parent task remains required.

Joint relief uses an analytic metre-space slope with first-order screen-position derivatives. The colour seam retains fwidth filtering; the normal perturbation never differentiates that filtered seam, avoiding undefined higher-order GLSL derivatives. The shader cache key is canada-place-paving-v2.

## Dry west-trail strip composition (2026-11-15)

Reviewed cached `tour-trail.jpg` from [TourbyTransit](https://cdn.tourbytransit.com/vancouver/images/Canadian-Trail-at-Canada-Place.jpg) against the current public oblique screenshot. The dry reference shows medium-grey rectangular paving fields, cross-path lighter aggregate bands, and a darker longitudinal building-side strip separated by a narrow lighter divider. [Brenco's March 2023 image](https://www.brenco.com/images/whats-happening/Salish-Sea--the-Journey-Within-1678831506.jpg) corroborates the strip arrangement, but its wet darkness/gloss is not used as a dry material target. Neither photograph establishes surveyed dimensions or calibrated reflectance.

The material now interprets this composition along the actual source west pier edge, from local (-223.6980, 62.3278) toward (47.0863, -84.6473). It uses the existing source metre UVs, so subsequent world baking/batching cannot shift the pattern origin. The new treatment is bounded to the approximately 308 m west edge and its first 10–10.5 m inward; the front/end transitions fade gently. It does not extend a guessed concourse wall axis.

Estimated dimensions: existing 1.5 × 0.75 m slabs and 8 mm joints; 160 mm cross bands every 6 m; a 240 mm longitudinal divider approximately 6.5 m inward from the source rail edge. Dry linear tint multipliers are 0.91 for the main field, 0.73 for the building-side strip and 1.18 for aggregate bands, with restrained ±3% slab variation. These moderate ratios are modelling choices informed by the dry image, not measured photo albedos. Crossing bands use a union rather than multiplication, avoiding an artificial bright patch where they meet. Pixel filtering suppresses narrow seams and bands at distance.

Existing licensed mineral maps, metric texture scale, roughness clamp (0.75–0.85), normal strength, anchor-contact calculation, deck geometry/heights and collisions are unchanged. No new draw, capture, displacement, wet effect, emission or directional shadow is added. Tests retain actual GLB support rays and chamfer-contact checks, bound the material composition at band junctions, and verify actual extracted source UV registration after rotated/translated world baking and spatial batching. Native daylight close/along comparison remains necessary before judging visual improvement.


## Bounded daylight material trial (2026-11-15)

Native review found the first strip composition still too pale and mottled. This checkpoint trials linear multipliers of **0.68 field, 0.53 service strip and 1.08 aggregate**, superseding the earlier 0.91/0.73/1.18 values above. These are dry-source-informed art adjustments, not calibrated photograph albedos or a claim about the exact current paving finish.

After the diffuse map is sampled, its grain contrast is reduced to **65% around decoded linear mean 0.8253**. The shader captures the pre-map diffuse product and mixes the mapped result toward that product multiplied by the mean. Thus material tint and any prior vertex colour remain multiplicative, including black; the change does not wash the tint toward a fixed grey. Layout tint is applied afterward. The affine operation preserves the measured map mean to the precision of the rounded pivot and reduces its standard deviation from approximately 0.0973 to 0.0632 before material/layout tint. No map files, metric UVs, normal strength, roughness, geometry, contact calculation, captures or draw counts change. Cache key: `canada-place-paving-v5-dry-grain-trial`.

All nine focused paving tests pass, including 331 actual source support rays, transformed/batched UV registration, shader integration ordering, and actual decoded-map mean/contrast checks under several diffuse products. CPU checks establish the intended operation, not its appearance. Parent native daylight review is the acceptance step; no build or browser reload was performed for this change.

### Aggregate-course joint topology (2026-11-15)

The accepted dry colours, map response, metre registration and original source
triangles are unchanged. Slab-grid joints and per-slab colour variation now stop
at transverse aggregate courses and the longitudinal divider. Previously every
6m course inherited a slab seam down its centre. TourbyTransit and Brenco show
distinct construction courses; exact joint widths are not surveyed. An estimated
8mm smooth termination avoids a hard normal discontinuity without inventing a
new dark perimeter band. Aggregate texture grain itself remains continuous.

Colour exclusion uses four metre-space samples from first pixel derivatives.
Normal relief uses the analytic product-rule gradient of the 2mm slab recess and
course exclusion, including the layout fade; it never differentiates fwidth or
other derivative results. Existing distance filtering suppresses unresolved
normal detail. This changes fragment arithmetic only: zero added geometry,
textures, draws, displacement or collision. Anchor contact is unchanged.
Native moving-view acceptance remains the parent task's check.

### Existing globe-pole contact

The four authored promenade fixtures now supply their source-local centres and actual0.16m visible base radius to the paving material. A short estimated0.08m falloff attenuates indirect diffuse/specular light by at most22%; direct sun, albedo, source geometry and the existing five stay-anchor contacts are untouched. No rail-foot contact expansion is included. The renderer enables this only when the same source-compatibility gate adds the four fixtures; default/fallback materials shade nothing at absent fixtures.

Actual GLTFLoader/baked-source tests resolve the extracted deck at local7.7989358902m and the modeled pole feet at7.8m. The1.064mm difference is source quantization, not a centimetre-scale placement failure; geometry is unchanged. The0.18m collision envelope is deliberately larger than the visible0.16m foot and is not used as the contact boundary. Three integration/source tests cover capability gating,20 actual deck rays around the four feet, the compact falloff and indirect-only shader placement.
