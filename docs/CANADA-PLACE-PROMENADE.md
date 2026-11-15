# Canada Place promenade refinement

Subsequent architectural work is recorded in [Canada Place entrance and concourse](CANADA-PLACE-CONCOURSE.md). The results below describe the earlier 5d8476d checkpoint.

This checkpoint concentrates detail along the already connected public Canadian Trail. It improves a small playable region; it does not establish photographic fidelity or GTA VI parity. Canada Place remains the first scene to finish before moving the same standard to Robson Square/Art Gallery, Granville's theatre blocks and a Stanley Park seawall stretch.

## Changes

- Separate the source pier's 31 upward triangles into a dedicated grey mineral paving material. Rectangular joints, slight slab variation and lighter transverse bands are informed by inspected west-trail photographs; their dimensions are estimates. Positions and walking height remain identical. Shared licensed mineral maps, filtered joints and shading-only relief add no displaced or overlapping surface.
- Replace the five selected west SAILS podium faces with recessed opaque-backed glass, complete aperture reveals, fine green-grey frames and sill/head profiles. The lower band is brought closer to the public floor; the upper band keeps the source's narrower 15–16.7 m extent after independent review rejected an unsupported equal-row interpretation. Glass reflects the existing sky environment. The blank spandrel and broader terminal form still need reconstruction against matched views.
- Refine the existing 308 m west railing with a 100 mm diameter handrail, grounded post bases, layered rails and open framed wire panels. Only the 12 original top-bar triangles are removed. Existing post positions, gate opening and route clearance remain. Fine infill does not cast aliased wire shadows; original posts still cast structural shadows.
- Reduce excessive sun-shadow offsets. The former bias alone shifted approximately 0.325 m through the 649 m light-depth range, before a 0.14 m normal offset. Native side views exposed detached foot shadows. Bias is now -0.00004 with normal bias 0.025; sun intensity, direction, map size and filtering are unchanged. Gallery/Robson street and facade views were also checked for obvious new shadow artifacts.

The geometry uses three shared facade batches plus one paving and one railing batch. The facade adds 4,266 triangles while removing 590; railing adds 29,880 while removing 12; paving preserves triangle count. No new downloaded runtime assets, interior simulation, reflection probes or per-frame geometry work.

## Sources and limits

See [paving](sources/canada-place-paving.md), [west facade](sources/canada-place-west-facade.md), and [railing](sources/canada-place-west-railing.md) for exact provenance and source guards. Actual viewed references include TourbyTransit's archival Canadian Trail photograph, Brenco's west-arch photograph posted March 2023, and Dietmar Rabich's dated June 2022 entrance photograph. The wet Brenco view does not determine dry-day gloss. Reference images remain local research files, not distributed textures.

Official Rockstar Leonida Keys 02 remains a material, lighting and constructed-detail benchmark, not Vancouver architectural evidence. This is not a fully matched camera reconstruction: several important relationships, including the sloping entrance conservatory/canopy, are still absent. The official 2025 plaza plan establishes round benches/flags but lacks enough independently matched world anchors for trustworthy placement; those were not scattered speculatively.

## Verification

All **243 tests and the production build pass**. New actual-GLB tests pin the source hash, verify selected/retained index sequences and original vertices, cast through every facade opening and reveal, retain 324 paving-route support rays, and verify railing bases, gate exclusion and route clearance. Source changes fail closed. The build retains its existing large-bundle warning.

Final local native review used the sole Codex tab: drove from Howe, braked/turned/exited, walked through the existing gate to (530.542, 7.88, -616.626), inspected near and oblique glass/paving/railing while moving, fired pistol/carbine/shotgun (14/29/7 remaining in their magazines), and cycled/dismounted on the deck. Captured browser warnings/errors were empty. No hidden-state teleport or photo-mode camera was used.

The final local 20-second stationary sample averaged **55.21 fps**, median 16.7 ms, p95 33.3 ms, p99 33.4 ms, max 35.3 ms, zero frames over 50 ms. Viewport 750×670, pixel ratio 1.35, Balanced, daylight. Camera mode 0, yaw 2.06749, pitch 0.12, FOV 62. Profile: 502 draws / 1,587,475 triangles. The earlier public sample averaged 48.61 fps at a nearby pose and pitch 0.102; simulation and camera differ slightly, so this is not a controlled performance-improvement claim. Neither short sample meets the broader five-minute/1080p verification requirement. Downtown approach spot readings were still around 21–26 fps.

Local evidence: `artifacts/local/canada-promenade-{tests,build}.log`, `canada-promenade-{bundle,local-profile,local-sample}.json`, `canada-paving-before.jpg`, `canada-promenade-final-local.jpg`, `canada-promenade-close-local.jpg`, shadow before/after/gallery captures, and `canada-facade-independent-review.md`.

## Next visual work

Keep the focus on Canada Place until its connected scene is convincing: match the west entrance/terminal architecture to photographs, reconstruct its distinctive canopy and solid/glazed proportions, improve near-field mineral/weathering/contact hierarchy, and establish defensible furnishing/wayfinding placement. Character animation, water, broader building massing and sustained frame times remain substantial gaps. Only then apply the same close-range standard to the other three chosen regions.
