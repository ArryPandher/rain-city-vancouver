# Canada Place pedestrian paving

## Reference and scope

The west Canadian Trail photograph on [TourbyTransit](https://www.tourbytransit.com/vancouver/things-to-do/canadaplace), [direct image](https://cdn.tourbytransit.com/vancouver/images/Canadian-Trail-at-Canada-Place.jpg), was inspected locally at `artifacts/local/canada-place-pedestrian-references/tour-trail.jpg`. It shows muted medium/dark grey mineral paving, narrow orthogonal joints, and contrasting transverse bands. The entrance arch dates this reference broadly after 2012 and before 2021; it is architectural evidence, **not confirmation of the 2026 finish**. The photograph is reference only, never a distributed game texture.

A newer [Brenco fabricator article, March 14, 2023](https://www.brenco.com/whats-happening/salish-sea-the-journey-within), [direct photograph](https://www.brenco.com/images/whats-happening/Salish-Sea--the-Journey-Within-1678831506.jpg), was also inspected. It shows the west trail looking southwest: rectangular grey slab fields, fine joints and lighter aggregate transverse strips. The wet surface is not used to infer dry-day gloss or darkness. This corroborates the older layout while motivating rectangular slabs and lighter bands; exact current dimensions remain unknown.

North Point renewal evidence concerns another part of the pier. Its distinctive multi-colour pattern is deliberately not used for this west-trail treatment. The new material interprets the broad grey paving class with estimated 1.5 × 0.75 m slab joints, 8 mm joint width, 2 mm normal-shading relief and restrained transverse bands at estimated 6 m spacing. None of these dimensions is surveyed. The source top remains continuous; joints do not displace the walking plane or produce a raised overlay. Existing source perimeter edges retain their geometry.

## Geometry provenance and safety

The supplied Codriver CC-BY-4.0 source remains credited in [canada-place.json](canada-place.json). `public/models/vancouver/canada-place.glb` SHA-256 is `1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe`. The concrete primitive has 8,368 positions and 11,154 indices. Exactly 31 reviewed upward pier-top triangles at local y≈7.8 are separated into a dedicated material mesh; the loader's +0.08 m origin retains the existing approximately 7.88 m finished plane.

`extractCanadaPlacePaving` requires the material name, source counts, millimetre geometry/index fingerprint and reviewed triangle orientation. A changed asset fails closed. Only selected index entries are removed from the original primitive; its position array, remaining index order, walls and other materials are unchanged. The added top copies original positions exactly. Total triangle count is unchanged; one additional mesh/material draw call covers the whole pier top.

`canadaPlacePavingMaterial` clones the already configured mineral material and shares its colour, normal and roughness maps. These are the existing Poly Haven **Granite Tile** CC0 face crops by Charlotte Baglioni, detailed in `public/textures/landmarks/SOURCES.json` and [landmark-surfaces.md](landmark-surfaces.md). No new maps, downloads or image assets are introduced. Their neutral grain supplies small mineral variation; authored joints and slight slab-level variation supply the readable near-field structure. The paving shader replaces the generic vertical facade-joint treatment, leaving source wall materials untouched.

## Verification

Actual quantized GLB integration tests pin the file hash, check all original positions and all non-paving indices exactly, reject changed/repeated extraction, and cast 324 existing public-route support rays. All hit the new paving at the unchanged original elevation with upward normals. Material tests verify map sharing and non-displacing shader construction. TypeScript checks pass. CPU tests do not certify WebGL appearance: native daylight review by the parent task remains required.
