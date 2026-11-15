# Canada Place upper edge and material pass

The upper west-promenade edge now has an attached pale guard and coping, while the curved concourse glass uses a dielectric material instead of the previous high-metalness approximation. These are improvements toward the real Vancouver reference, not a claim of photographic or GTA VI/AAA parity.

## Visible changes

The guard follows the existing central curve and projecting end-fascia roof edges, with transverse connections at the two inset transitions and returns into both end walls. Its 1.08 m height, 140 mm posts and maximum 1.9 m bays are explicit estimates from the museum photograph and Rayner section. The coping meets the actual generated roof. One additional material batch contains 4,308 triangles; ground geometry, doors, anchors and closed upper access remain unchanged. See the [guard source note](sources/canada-place-upper-guard.md).

Upper glazing now uses nonmetallic specular reflection, IOR 1.5, roughness 0.21 and a muted green body color. It retains the existing 0.8-intensity harbour probe without another capture or transmission pass. The normal-incidence reflectance is approximately 4%, rather than the previous heavily tinted metal blend. See the [glass source note](sources/canada-place-concourse-glass.md).

Independent review of the ordinary gameplay images recommends keeping the less metallic material, but identifies a major remaining limitation: the curves still read as opaque painted panels. Source-supported panel divisions and visible structural depth behind the glazing are the next material/architecture task. Increasing metallic reflection would reintroduce the chrome appearance. The current approximation does not simulate transmission through real glass or an upper interior.

## Building submission cost

Three curtain-wall materials differed only by palette tint. Their linear color is now multiplied into the existing facade vertex color, allowing one neutral shared material. The geometry, UVs, existing vertex shading, weather emission and 270 m spatial-cell size are preserved. This is not a broad merge of unrelated materials or an increase in cell size.

A deterministic mapped fixture of 165 towers reduces 126 material batches to 71, retaining the same 2,754 triangles and 71 occupied cells. Native matched-pose profiles show the curtain material at 85 beauty calls / 1,738 triangles before and 47 calls / 1,892 triangles after. Merged material bounds can include additional triangles within the same cell, and the view differs slightly; this is not a claim that the exact submitted triangle set is unchanged.

Quiet 20-second city-facing samples at 750×670, pixel ratio 1.35, Balanced/day measured 24.50 fps before and 26.18 fps after. After p95 was 50.1 ms, maximum 51.7 ms, with 34 frames over 50 ms and none over 100 ms. The total sampled frames were 2,772 calls / 5,053,400 triangles before and 2,559 / 4,838,948 after. Traffic and pedestrian state differ, so the total timing difference is not an isolated speed-up measurement. The sustained five-minute/1080p target remains unmet.

Native diagnostics confirm `WEBGL_multi_draw` support in the Codex browser. A future opt-in batching pass can group existing photographic-facade chunks while retaining per-chunk visibility and shadow behavior. That optimization and the separate wheel-submission opportunity are not implemented here.

## Verification and gameplay follow-up

All 289 tests and the production build pass. Source-level checks cover actual roof contact along every coping segment, guard/end topology, material behavior, mapped tint/batching equivalence and the repaired vehicle placement. Native review verifies startup, approach driving/exit, connected road-to-pier walking, the upper edge and material response from near/oblique views, and pistol fire/holster, with no captured warnings/errors.

The native summoned-car check exposed a separate existing placement weakness: a three-metre clear departure can end at the next anchor. The observed stopped position was (573.47, 7.88, -639.60), heading -1.076. The nose capsule is blocked even though centre and tail are clear. Placement now tries all existing candidates with a twelve-metre fully checked departure first, retaining the three-metre fallback when no longer line is available at an ordinary street corner. The real-position regression shifts the projected origin sideways by 0.75 m and independently samples all three car capsules every 0.1 m along the twelve-metre departure. Geometry, collision clearance and physics are unchanged.

The final native retest returned to the same area at (579.26, 7.88, -643.64). The car spawned at (578.03, 7.88, -642.91), drove through the former obstruction to (526.97, 7.88, -615.39), then braked and exited normally. That is about 58 m of actual driving along the promenade. Pistol fire/holster also passed afterward. The loaded local script was `index-jbk_dNsY.js`; captured warnings/errors were empty. This verifies the reproduced placement issue, not every possible future traffic or corner configuration.

The specialist ownership and review process is documented in [Realism workflow](REALISM-WORKFLOW.md). A discovered scan was excluded after its explicit NoAI restriction was checked; no scan mesh was obtained, shipped or used for reconstruction. Independent architectural photographs need careful roof-versus-ground identification before another anchor revision. Photographs remain research references, not runtime textures.
