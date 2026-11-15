# Canada Place visible glazing depth

Curved upper glass now reveals shallow architectural depth and finer pale framing instead of reading only as a continuous opaque sheet. Photographic city facades also use native multi-draw where supported, retaining their original geometry and per-cell visibility. These are verified improvements toward the browser-only GTA VI/AAA target; photographic parity remains unachieved.

## Glazing and source fidelity

The exterior curved coordinates, analytic normals, ground doors, guard contacts, anchors, collision footprints and playable route are preserved. Four rail bands subdivide each quarter-round. Closed backing sits 400 mm inward, with pale 100 mm rebates and muted 300 mm returns. The dimension and backing layout are authored approximations guided by the museum photograph and Rayner section, not surveyed interior construction. Source-face replacement remains restricted to the reviewed 10 concrete, 100 glass and 480 trim triangles.

Transparent upper glass retains IOR 1.5, zero metalness, roughness 0.21 and the existing harbour reflection. View-dependent alpha reveals the backing without a new full-scene transmission capture. Ground doors retain their separate material, and closed end caps remain opaque with local reflections. There are no new textures or playable interiors.

An initial native view exposed overly thick pale reveals. The final narrower rebate is independently accepted as a visible improvement, with recess depth retained. Uniform dark backing is still the largest glazing mismatch: the real photograph shows more varied structure. More reflection would not fix that. Final returned facade geometry is 61,084 triangles in eight batches, including 9,560 backing/reveal triangles; the existing upper guard remains separate. See [geometry provenance](sources/canada-place-glazing-depth.md) and [material limits](sources/canada-place-concourse-glass.md).

## Photographic-facade multi-draw

When the actual renderer supports WEBGL_multi_draw, five photographic material groups become BatchedMeshes. Each original 270 m chunk retains its geometry, UVs, vertex colors, transform, per-instance frustum test and existing distance/shadow policy. Detached source meshes remain policy records in World.chunks. Per-pass callbacks apply beauty/reflection visibility separately from shadow eligibility. Unsupported capability leaves the original Mesh path intact.

A nearly matched native city view (approximately 0.013 m / 0.00034 rad difference) reduces the five photographic materials from 196 beauty calls to five, with exactly 10,370 submitted triangles before and after. Native Granville inspection observes all five materials in both beauty and shadow passes: five beauty calls / 3,074 triangles and five shadow calls / 466 triangles. That proves active native shadow submissions in this view, not universal pixel equivalence across every light or browser. Focused tests exercise multiple main/reflection/shadow cameras, distance restoration and profiler callback handling.

The diagnostic now includes untruncated material attribution: batching had moved these groups below both top-list cutoffs. Global frame totals still vary with traffic and pedestrians. Final city sample at 750×670, pixel ratio 1.35, Balanced/day averaged 24.79 fps versus baseline 25.18 fps. Final p95 was 50.1 ms, maximum 399.6 ms, with 51 frames over 50 ms and one over 100 ms. No FPS gain is claimed. The sustained five-minute/1080p target remains unmet.

## Validation and next work

The production build and 296 tests pass. Actual source GLB rays behind normal and oblique panes meet closed backing; rebate coverage/color and shared-wall deduplication are checked. Existing route, roof/guard and source-paving tests continue to pass. Native checks cover startup, Canada Place approach driving/exit, connected road-to-pier walking, pistol aim/fire/holster, material/geometry comparison, and Granville walking, nearby facade/shadow visibility, car summon/driving/braking/exit. The final local script is index-9zJGXVxK.js; captured warnings/errors are empty.

Evidence is retained under `artifacts/local/canada-depth-*`, including before, first-candidate and calibrated native views, full material profiles, 20-second samples and final gameplay records. The public release is verified independently in the release/CI/bundle/browser artifacts.

Continue source-grounded backing variation and exterior junction/material quality before expanding the hero regions. CANADA PLACE raised lettering is supported by the museum photo, but exact station registration is unresolved. A separate next performance candidate groups exact wheel geometry by shared material while preserving rolling and steering transforms, fixed calipers and grounded tyre radius; it is not implemented here. Canada Place, Robson Square/Art Gallery, Granville and Stanley seawall remain the full priority scope.
