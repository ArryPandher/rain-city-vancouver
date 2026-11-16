# Granville Square office glazing and capture alignment

2026-11-16. Candidate for mapped tower **w128409618** only. Native comparison remains the acceptance step. This does not change the separate Howe wing, public plaza datum or recently accepted tower base proportions.

## Evidence and diagnosis

The baseline `artifacts/local/granville-base-corrected-native.png` shows nearly uniform dark office panes despite substantial real splayed reveals. The [Cadillac Fairview aerial](https://assets.cadillacfairview.com/transform/f5d7a51c-9cdf-44b1-9d3f-aac40189536a/200-Granville-Aerial), cached as `artifacts/local/granville-tower-reference/owner-aerial.jpg` and `aerial-tower-crop.png`, also shows mostly dark paired office windows. It supports restrained reflection and interior variation, not a uniformly bright blue curtain wall. The [owner Suite 310 plan](https://assets.cadillacfairview.com/asset/8f6916b5-d3c2-4a07-9574-d124a2dd5ab0/310-200-Granville-Floor-Plan.pdf) confirms occupied rooms behind the recessed perimeter. Small pale rectangles in the aerial cannot confidently identify a current, complete blind schedule; no random or inferred blind pattern is added.

Two specific implementation issues explain why material albedo alone is the wrong fix:

- Office glass was opaque dark diffuse material. Its existing lining and closed rear surface, 0.38 m behind the pane, could not contribute to the visible result.
- The valid 128px probe labelled “south exterior” was at [526,52,-410], west of the tower. The saved wide native profile reports it valid with no reflection error. Valid capture does not imply correct position: directions reflected toward the southern/eastern exterior from their actual windows can cross the tower when traced from that western probe. With the real capture geometry and receiver exclusions, 33 of 80 sampled reflected street-view directions hit the tower itself at the old position.

These references are research only. No photograph or new texture is included in runtime, and no measured optical specification is claimed.

## Bounded implementation

`createGranvilleSquareOfficeGlass()` uses the existing single-pass `createExteriorLobbyGlass` sheet over the unchanged real cavity. The physical BRDF supplies reflection; the custom blend attenuates the already-rendered backing, without an opaque diffuse paint layer or a screen-refraction render. Effective coating IOR remains **1.8** (normal-incidence F0 about **0.08163**), roughness remains **0.13**, and the old factory environment intensity **0.8** remains unchanged. The existing probe still applies day/night intensity **0.85**. Thus reflection strength is not simply boosted to whiten the panes.

One-pass survival **0.78** is an authored absorption approximation, not measured glass transmission. At normal incidence the resulting backing throughput is about **0.7163**; it tends to zero at grazing while reflection tends to one. The sheet has no diffuse paint, metalness, emission or screen transmission. It does not cast a solid-pane shadow over the backing. The physical concrete and frame geometry still cast their ordinary shadows. The base/lobby material and every other tower material are unchanged.

The single existing probe moves to **[583.2957196401542,52,-429.10969850343093]**, the intersection of planes 6 m outward from the south D–A and east A–B elevations. This is derived from the retained mapped ring. It lies outside every building footprint in the live base map; the closest footprint is the neighboring low parkade, about 0.777 m away in plan, while the tower corner is 8.300 m away. The existing 52 m capture height is retained. No additional probe or resolution increase is introduced; the label now correctly says southeast.

One cube remains a spatial approximation for a tall tower. It prioritizes the two street-facing elevations and does not claim exact low-floor parallax, facade-wide visibility or surveyed interior contents. Reflections of legitimate neighboring buildings must remain. This pass does not repaint reflections or add lights to force visible variation.

## Verification

Seventeen focused tests pass across the new glazing tests, existing exterior sheet tests, tower geometry tests and actual architecture dispatch tests. They verify:

- Actual injected blend arithmetic conserves bounded reflected plus transmitted energy across 101 angles, preserves coating F0, exposes backing and adds no extra refraction pass.
- The probe is exactly 6 m outside both priority face planes and outside every live base-map building footprint.
- Eighty reflected rays from two ordinary street-side observer positions and four office heights intersect the actual closed tower capture geometry: **33 old-position self-hits versus zero new-position self-hits**. This isolates self-occlusion, not the entire neighboring scene or GPU output.
- The same samples retain the pane-to-backing distance of 0.38 m. Existing tests cover all 1,080 office panes and 40 louver apertures, base closure, roof, graded footers and source limits.
- The tower remains **45,138 triangles in six material batches**. The actual architecture hook still registers one probe and leaves the completed Howe wing and unrelated generic building geometry byte-identical.

No geometry, storey, recess, base proportion, public route, collision or global lighting file changes. The office batch moves from opaque to the existing transparent sheet path; unchanged draw count is not a claim of identical GPU cost. No browser, production build, deployment or FPS assertion is part of this scoped verification. Root will review matched native near/wide images before acceptance.
