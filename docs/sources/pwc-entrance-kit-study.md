# PwC Place entrance: existing asset compatibility study

## Result

The existing residential kit is unsuitable for 250 Howe's commercial entrance. Do not add its doors/windows to the PwC building's `DetailedArchitecture.samples`. This is a geometry/type mismatch, not a material calibration issue.

The actual GLB was decoded and its three parts projected from the front in `artifacts/local/pwc-entrance-kit-review.png`. Both doors have four raised timber panels, letter slots and domestic lever/escutcheon hardware. The taller door includes a small four-light transom and heavy decorative head. The window is a sash with a decorative apron and projecting head. Scaling these to storefront dimensions would preserve those incorrect details and distort the hardware.

The official CF 250 Howe suite sheet (`cf-pwc-page-1.jpg`, original PDF in `artifacts/local/canada-approach-buildings-reference/`) establishes a modern glazed commercial ground level beneath the curtain wall. Its small exterior inset does not resolve entrance leaf count or threshold details. Exact placement awaits the independently registered entrance photograph and facade contract; no door location is inferred from the suite floor plan.

## Asset provenance and measured cost

- Source: [Poly Haven Modular Urban Apartments Facade](https://polyhaven.com/a/modular_urban_apartments_facade), James Ray Cock.
- Licence recorded by extraction: CC0-1.0, [public-domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
- Extraction: `scripts/fetch-architectural-details.mjs`; provenance: `docs/sources/architectural-details.json`; runtime asset: `public/models/architectural-details.glb`.
- `door_centered_small_01`: 1.480 × 2.810 × 0.440 m; 1,360 triangles, two material primitives.
- `door_centered_small_02`: 1.120 × 2.260 × 0.230 m; 790 triangles, one material primitive.
- `window_centered_small_01`: 1.120 × 2.300 × 0.390 m; 847 triangles, two material primitives.
- Entire asset: 2,997 triangles, five primitive draws before instancing; 146,558 bytes of decoded accessor buffers. Three 1024² WebP maps, 225,366 compressed image bytes; typical RGBA8 decoded GPU storage with mipmaps is approximately 16 MiB. Compressed GLB is approximately 368 KiB. Loader/bake clones, instance buffers and driver overhead are additional.

`src/world/detailed-architecture.ts` pools the three types separately, scales X/Y while preserving original Z depth, forces glass opaque, and selects details within 105 m. It has no facade-opening/closed-recess contract. A commercial entrance placed through this system could sit over an intact wall even if its width/height looked plausible.

## Better asset-backed implementation route

Use the source-registered PwC entrance as one complete bounded storefront asset, not an assortment of residential trim: commercial perimeter frame, thin sheet glazing, connected transom/door frames only where confirmed, recessed closed backing, physical threshold and attached soffit/side returns. Reuse the PwC assembly's already licensed mineral/metal texture assets and existing reflection pipeline; keep original authored geometry and source-photo dimensions explicitly estimated. Do not claim the photograph grants rights to any third-party model.

Before authoring, the facade owner must provide the true opening endpoints, inward/outward basis, floor datum, head height and replacement rule. Remove the corresponding original facade plane; do not overlay an entrance over a solid shell. The bounded model should expose its solid footprint and vertical clearance separately, keep the public sidewalk outside the opening clear, and remain closed/non-playable inside. Aim for three shared material batches (glass, metal, mineral/dark lining where shared), with a few thousand triangles rather than a downloaded building kit. Actual cost and rays must be reported on the final asset, not assumed from this budget.

An API-only catalogue cross-check at Poly Haven returned HTTP 403 in this session; no replacement model, purchase or whole-kit download was attempted. No runtime asset or geometry was changed by this study.
