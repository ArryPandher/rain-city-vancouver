# Canada Place glass, framing and static submissions

2026-11-15. This checkpoint improves the central west concourse in ordinary daylight gameplay. It remains visibly below photographic or GTA VI/AAA realism. The existing chat coordinates three specialists for architecture, materials and performance; the four priority regions and browser-only goal remain unchanged.

## Result

The former diffuse, alpha-blended glass looked like painted roofing and weakened reflected light twice. Upper panes now use three curved tier meshes with ordered RGB attenuation and physical-reflection draws. Linear transmission is authored at (0.62, 0.88, 0.76), before Fresnel loss; reflection remains untinted. Six small draws replace one glass draw, with no additional scene capture. Opaque ends restore ordinary blending, and the existing harbour probe recognises material arrays.

Ten estimated curved structural frames and longitudinal ties extend the single-frame trial through the central glazed group. They sit behind existing ribs, terminate below opaque fascias, and add 2,400 triangles in one material batch. Their rhythm and dimensions are explicit estimates informed by SACO, the official west photograph, the museum daylight view and Rayner's section. A dimensional audit supports retaining the mapped horizontal roof footprint; the authored sail curvature remains approximate. The separate primary vertical supports are still missing.

Architecture and street-detail chunks with compatible shared opaque materials now use capability-gated multi-draw. Their original distance, shadow and per-pass frustum rules remain intact. Unsupported/custom materials retain original meshes. After packing, owned, never-rendered source meshes retain only bounds and visibility records; packed CPU geometry remains available for rendering and context restoration.

## Verification

All 323 tests pass, and the production build passes. Focused checks exercise exact geometry/attributes, opaque boundaries, inward web depth and contact, material-array optical ordering in installed Three, alpha preservation, multi-camera/shadow culling, unsupported fallback and owned-source buffer release.

Native checks used only the existing Codex browser tab. The final local build passed the driven approach, braking and exit, connected road-to-pier walking, front/oblique/both along-facade views, and pistol selection, aim input, firing and holstering. No captured warnings or errors. An earlier neutral optical candidate also completed a continuous 55.83 m southbound car run past the sail supports, stopped, then cycled onward; this is not a complete pier traversal or an exact-final-build route claim.

In nearly matched front views, four anonymous material groups preserve exactly 83,475 submitted triangles while dropping from 285 to nine beauty calls. Their counts remain unchanged after releasing redundant source buffers. Whole-scene counts vary with pose and moving actors, so no whole-frame geometry or FPS equivalence is asserted.

The final native memory profile covers 104 registered batches and 9,105 source records: 328,620,606 source bytes released, zero source-buffer bytes retained, 355,804,572 packed geometry bytes and 706,216 matrix/indirection bytes. Current tracked storage is 356,510,788 bytes, versus 685,131,394 before release. This measures CPU backing-buffer references in this batching scope, not process RAM, GPU allocation, textures, all game geometry or garbage-collection timing.

A fixed 20-second final local sample at 750×670, pixel ratio 1.35, Balanced/day yielded 39.50 mean fps, 33.8 ms p95, 50 ms p99 and 216.7 ms maximum. Three frames exceeded 50 ms, including one above 100 ms. It does not establish an FPS gain, a five-minute smoothness gate or 1080p performance.

## Visual assessment and next action

The full frames and ties read more clearly behind the glass; greener transmission is modest. No obvious gaps or tier-compositing defects were visible in the checked views. Broad reflection bands, repetitive pale arches and sparse deeper structure still dominate. The renderer remains an approximation: no refraction or multiple internal reflections, object-level tier sorting, and limited atmospheric treatment at distance.

Keep Canada Place first. Register the separate vertical support lines from the section and independent west photographs, then reconstruct one joined support before repeating it. Preserve the existing curved webs rather than thickening them to imitate columns. Compare walking-height parallax and material response against the real views, and attribute the remaining hitches and expensive background geometry. Retain Robson Square/Art Gallery, Granville theatre blocks and Stanley seawall as the next priority regions.

## Evidence and provenance

- [Glass source and optical limits](sources/canada-place-concourse-glass.md)
- [Hall geometry, reference registration and dimensional audit](sources/canada-place-hall-structure.md)
- [Static batching, exact native submissions and memory accounting](sources/static-chunk-batching.md)
- Local captures/profiles: `artifacts/local/canada-optics-{published-before,structure-baseline,candidate-front,rgb-front,final-front,final-oblique,final-along-north,final-along-south}.jpg`, `canada-optics-final-profile.json`, `canada-optics-final-frame-sample.json` and the corresponding build/test/browser logs.

Reference images are research only and are not shipped as textures. Existing Codriver/OpenStreetMap provenance and asset licences remain applicable. No excluded scan, purchase, new browser tab, external message, photo mode or playable interior is introduced.
