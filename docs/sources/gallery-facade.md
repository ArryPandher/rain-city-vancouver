# Gallery rear-wing facade refinement

2026-11-14. Original bounded exterior interpretation. No interiors, collision/landing changes, camera edits, new textures or claim of AAA parity. Native daylight verification is recorded below.

## Actual photograph and source geometry

The inspected photograph is Jason Vanderhill's **4 May 2006**, Robson/Howe third-floor view of the gallery's Robson Square-facing rear. [Commons provenance and public-domain declaration](https://commons.wikimedia.org/wiki/File:Vancouver_Art_Gallery_Robson_Square_from_third_floor.jpg), [original photograph](https://upload.wikimedia.org/wikipedia/commons/4/46/Vancouver_Art_Gallery_Robson_Square_from_third_floor.jpg). Retrieved over public HTTP and inspected locally at `/tmp/gallery-rear-reference.jpg`. Reference only; no image is shipped as a texture. Historical exhibition banners and current tenancy are not reconstructed.

Visible features motivating this pass: upper windows are shorter than the lower row; sash frames read dark, with a horizontal meeting rail; stone sills project from the wall; the base has deep horizontal courses; and the central engaged entrance has **four** shafts. The photograph is not a measured elevation. All new profile depths and opening heights remain authored estimates.

[Parks Canada, Former Vancouver Law Courts](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=85) documents the granite base and smoother upper stone, as already recorded in `landmark-surfaces.md`.

The existing [Codriver geometry](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/vancouver-art-gallery/geometry.js), [site coordinates](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/vancouver-art-gallery/vancouver-art-gallery-site.js), and [geometry kit](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/vancouver-art-gallery/vancouver-art-gallery-kit.js) are CC BY 4.0; geographic placement © OpenStreetMap contributors. Cached source files `/tmp/gallery-geometry.js`, `/tmp/gallery-site.js`, `/tmp/gallery-kit.js` were inspected. The source ALREADY has 0.28 m window recesses. This corrects the earlier visual review's implication that the windows were simply flat panes. Pale flat cross mullions and repeated row proportions diminished that existing depth.

## Exact bounded replacement

`src/world/gallery-facade.ts` replaces all nine bays across the two nearly collinear rear edges, local `(19.452,23.181)` through `(0.413,23.62)` to `(-8.872,23.82)`, rotated by the original baked angle. It removes reviewed source wall/reveal/glass/cross faces by triangle selection; it does not move any original vertices. It retains other edges and the rest of the building. Replacement spans both nearly collinear edges, avoiding inconsistent opening proportions across the visible central seam. Source-pinned vertex ranges from the existing rear-entry manifest explicitly exclude every translated stair, original column and pediment triangle from selection. Tests verify each such original triangle remains indexed, in addition to ray hits on both original column shafts.

- New closed glazing sits 0.38 m behind the original plane, with dark 55 mm perimeter sash frames and a 50 mm meeting rail. No pale vertical centre bar or invented interior is added.
- Nine upper openings change from y=9.05–12.2 to y=9.55–11.75. Lower/source foundation opening heights and bay centres remain unchanged.
- Sills project 0.16 m, with an additional drip lip and shallow jamb/head profiles. Foundation courses have 35 mm physical recesses and 24 mm horizontal joints, confined to replacement faces. Existing licensed mineral maps/materials are reused.
- Two missing engaged entrance shafts are added between the existing pair, at one-third/two-thirds spacing, using the same repaired entrance datum and height. Base, taper and capital meet physically. This does not reproduce detailed Ionic carving; it restores the four-shaft rhythm visible in the photograph. The pre-existing columns, cornice, pediment and stairs remain.

The loader preflights original position/index counts for all three affected primitives before changing anything. A changed/missing source skips both removal and the added assembly. Asset SHA-256 is verified in the tests against the existing rear-entry manifest. All source geometry outside the selection stays intact.

## Analytical evidence and acceptance

`tests/gallery-facade.test.ts` decodes the actual quantized GLB and runs the existing entry repair before this replacement. It verifies 644 removed triangles (foundation210, glass54, stone380; copper/trim0), identical original vertex positions, unchanged original column/opposite-facade ray hits, and twenty-one exterior rays reaching the new glass at 0.38 m recess. A formerly glazed upper sample now hits stone, establishing the shorter upper aperture. Exterior rays also hit the projecting sill, checking front-face orientation. Added positions/normals are finite and bounded. The existing rear-entry test still passes.

The added assembly is **5,128 triangles in four batched draws**, three reusing existing materials and one shared new sash material. Net triangle increase is 4,484. No extra lights, probes, texture fetches, animation or per-frame computation. `artifacts/local/gallery-facade-analytical.md` records before/after dimensions and reference/checkpoint paths. It is analytical evidence, not an after-render screenshot.

Parent must inspect ordinary daylight gameplay from the existing gallery checkpoint, move laterally past the nine replaced bays, and approach the repaired stairs. Reject seams, obstructed landing, detached columns, excess lightness, or disproportionate trim. The rest of the gallery remains simplified; one refined rear elevation does not make the whole facade photographically accurate. Reference date, estimated dimensions and missing sculpture remain limitations.

The first native six-bay review exposed the adjoining three-bay pale-cross seam; this revision extends only that adjoining edge. The parent verified stair ascent/descent and connected capitals in the prior candidate. The nine-bay revision still requires a rebuilt native visual check.

Final oblique-view correction: the first nine-bay native review showed bright perimeter slivers. Four aperture reveal quad orders inherited from the source kit faced into the masonry instead of into the opening. Reversing those four orders fixes jamb/head/sill front-face visibility; box-profile faces are unchanged. An oblique exterior ray regression failed before the correction and passes afterward for both edges, checking the physical hit point and aperture-facing normal on all four reveals. This adds no geometry, materials or draw calls. All 54 original glass triangles (27 openings) were removed as expected; this correction addresses missing reveal visibility, not duplicate panes. Reflections may still vary naturally, and final rebuilt native appearance remains the parent’s acceptance check.

## Final native verification

The final production build was loaded in the sole existing Codex tab. Normal
walking reached (-61.05, 0, 42.31), then moved laterally to (-53.75, 0, 49.55).
The front and oblique screenshots show the continuous sash treatment and closed
window reveals, with the prior bright edge gaps resolved. No captured runtime
warning/error. Earlier nine-bay stairs reached (-51.06, 3.01, 30.51) and returned
to ground; the final winding-only correction changes no stair/collision geometry.
Evidence: `gallery-reveals-final-local.jpg` and
`gallery-reveals-oblique-final-local.jpg` under `artifacts/local/`.

All **201 tests and production build pass** locally. A 20.0167-second sample of
the preceding six-bay candidate averaged **23.58 fps** at 750×670, DPR 1.35,
Balanced/day, mixing walking with standing. It is not a before/after comparison,
the final nine-bay benchmark, or the five-minute 1080p performance gate. The
gallery's overall massing, stone colour, carving and surrounding scene remain
approximate and visibly below the GTA VI reference.
