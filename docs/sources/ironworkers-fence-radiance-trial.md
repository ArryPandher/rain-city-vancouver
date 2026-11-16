# Ironworkers fence: one diagnostic radiance-filter trial

2026-11-16. Optional `createRenderGroup(concrete,steel,{filterTrial:true})` trial;
the parent integrates it only under `debug && fence=filtered`. No default change:
the ordinary 2km physical-box tier and prior extreme-distance fallback remain.
Fence position, 3m height, 5×4cm sections,13cm nominal pitch, near materials,
path/curb/rails and all finite contact members are unchanged.

## What the retained native images show

`bridge-route-crest-native.png` and `bridge-workshop-oblique-native.png` show
low-frequency wave bands across repeated physical bars. Existing 4×MSAA is already
active; adding another global antialiasing pass is outside this task.
`bridge-filtered-normal-native.png` and `bridge-filtered-normal-oblique-native.png`
show the previous filtered sheet's broad white/blue seam, rather than a faithful
pixel average of its real steel faces. This trial addresses the diagnosed filter,
not the source fence dimensions or the amount of yard the real fence obscures.

The earlier periodic occupancy integral is correct for local parallel rays, but
its shading is not:

1. It shades one normalized area-averaged normal. Averaging normals before a
   nonlinear metallic BRDF does not average the two real face radiances. It can
   create a specular reflection direction neither face has. Even diffuse response
   can be inflated by normalization; GGX accentuates this mismatch.
2. Once projected sections overlap, it still weights the side as depth×slope.
   Neighbouring nearer pickets hide part of that area. With the existing section,
   full projected closure starts at |slope|2, or63.4° from fence normal. Visible
   front fraction then stays width/pitch≈0.3846, while visible side fraction is
   capped at0.6154. The old side-normal weight instead reaches0.8 at slope5 and
   0.9412 at slope20. Real grazing closure must not be replaced by an artificially
   open constant-opacity fence, but its surface lighting must be correct.
3. Alpha-to-coverage on a4-sample target has only coarse coverage levels. In
   particular a frontal area fraction0.3846 cannot be represented exactly by four
   binary samples. Smooth angular changes can become broad coverage steps.

These are proven code/model discrepancies. Their individual screen contribution
cannot be isolated from screenshots alone; no claim is made that one accounts for
every bright pixel in the rejected native trial.

## The bounded alternative

For each actual repeated member cell, the shader filters **first-hit front and
side intervals separately**. With w=bar width,d=depth,p=actual pitch and signed
view slope s:

- front duty = w/p;
- visible side duty = min(d×|s|/p,1−w/p);
- front phase shifts by −s×d/(2p);
- side interval starts after the front interval on the view-facing side.

Each periodic interval is integrated over its own screen-derivative footprint.
The sum is bounded by1 and becomes exactly1 when bars genuinely close the view.
An independent4096-ray test through101 real Three.Box3 bars compared54 combinations
of positive/negative/grazing slope, phase and pixel width. Maximum per-face
coverage error was0.000503. Evidence is retained in
`artifacts/local/ironworkers-first-hit-audit.json` and its `.mts` harness.

The material evaluates the installed Three standard **direct diffuse, direct
specular, environment diffuse and environment specular** pipeline twice, once per
real face normal. It combines those lit values by normalized first-hit coverage.
It never creates an averaged face normal or changes steel colour/roughness/metalness.
The result is blended once with continuous coverage alpha. Alpha-to-coverage and
alpha test are off; depth testing remains on and depth writing is off. No opaque
white panel, extra shadow sheet, new texture or camera collision is introduced.

Continuous alpha requires transparent ordering. Instances are not independently
sorted, so each distant chunk now has separate meshes for the two fence sides.
Each mesh has its actual computed bounding sphere, which the installed Three
WebGLRenderer uses for projected-depth sorting. Near boxes remain in the original
single instanced batch. The same64m chunks switch at48m with the existing4%
hysteresis only in the trial. There is no double-render crossfade. Far proxies
cast/receive no shadows, matching the prior filtered-tier contract.

## Costs and limits

Default draw ceiling remains24. Trial ceiling is45; far lighting is evaluated twice
and transparent surfaces cannot provide early opaque occlusion for the background.
No frame-rate improvement is claimed. Opaque nearby bars, vehicles and rails still
provide normal depth occlusion. Sorting is bounded per fence-side chunk, not exact
per-pixel order for every conceivable camera/curved overlap. The projection remains
a local parallel-ray approximation using the existing distributed pitch. It does
not reconstruct cap radiance or arbitrary close macro photography. Normal near
fence geometry remains physical.

Only plain MeshStandardMaterial steel without normal/bump/displacement maps is
supported by the trial, avoiding unsupported reorientation of mapped detail.
This is a single testable option. If the native result still gives white/blue walls,
ordering defects or an unacceptable frame cost, keep it diagnostic or reject it;
do not conceal failures with brightness, pitch, fence-height or global-AA changes.

## Validation and parent acceptance

13 focused tests across `ironworkers-picket-radiance`, `ironworkers-picket-coverage`
and `ironworkers-path-boundary` passed; full TypeScript passed. They verify physical
box-ray coverage, separate complete lighting blocks, continuous-alpha state,
unchanged source material, unchanged near/physical matrices and floor geometry,
separate side sort centres, retained default2km distance and bounded45-draw trial.
These are CPU/structure tests, **not a native GPU shader-compilation result**.

Parent hook: pass `{filterTrial: params.has('debug') && params.get('fence') === 'filtered'}`
as the existing `pathBoundary.createRenderGroup` third argument. No World/main,
browser, build, distribution output or source download was changed by this agent.
Native acceptance should compare the same crest and oblique views, a perpendicular
view with real gaps, and slow movement across the representation boundary. Check
shader errors, background visibility and frame cost before any default promotion.

## Projected-selection and sampling revision (after rejected 9a motion capture)

`artifacts/local/bridge-fence-two-face-motion.png` still shows strong near/right waves. Correct first-hit radiance alone did not address unresolved physical bars: a64m chunk selected from its road-centre origin at48m can retain bars roughly80m away. The old single-box integration also retains periodic modulation after a pattern becomes subpixel. The following revision supersedes the48m whole-chunk trial and its45-draw ceiling above. **Default remains the original24-draw physical path.**

The experimental path retains64m spatial/sort domains but splits each side into complementary physical and filtered instance sets. Actual bar pitch is projected through the current camera projection and each bar's real along vector into the **current renderer viewport in pixels**. Enter filtered below3px per pitch; return physical at3.5px. A conservative sphere enclosing the complete bar protects every surface within10m of the camera. No physical section, spacing, source centre, height, path or finite collision member changes. A bar appears in exactly one set, so there is no double coverage or crossfade opacity adjustment. Protected extremely grazing bars within10m can still alias; retaining close physical geometry is an explicit bound, not a promise of perfect antialiasing at every macro angle.

`ironworkers-picket-selection.ts` installs a callback on the actual parent **Scene**, discovered through group/ancestor attachment events. It does not rely on Group.onBeforeRender. The installed Three182 renderer calls Scene.onBeforeRender after matrix updates and before projectObject, instance-buffer uploads and shadow rendering. The callback chains the existing scene handler and reads `renderer.getCurrentViewport` for that render invocation, including cube-probe targets. Multiple fence registrations coexist; removal/disposal unregisters only that fence and restores the prior scene callback when the last registration is removed. Tests cover a detached intermediate root as well as immediate scene attachment.

Each side has fixed-capacity instance buffers and immutable original matrix copies. A conservative perspective projection bound bypasses per-bar transforms for definitely filtered chunks; definitely behind-camera distant cells are also filtered. Mixed chunks use reusable scratch vectors/matrices and typed arrays, then compact the exact original matrices into complementary sets. Buffers are marked for upload only when membership changes. Original complete-domain bounding spheres remain valid for every subset and preserve correct culling on near return; they are not undersized stale bounds or disabled frustum culling. Each far side retains its separate spatial sort centre. Ordinary camera hysteresis is retained per camera; cube captures reuse one reset scratch history instead of retaining a history for every probe face.

The shader now uses the common maximum front/side derivative footprint and smoothly attenuates periodic modulation toward its exact first-hit **area mean** from .25 to .75 periods per pixel. Both faces use the same weight. This preserves mean front fraction w/p and mean visible side fraction min(d|s|/p,1−w/p); it does not lower their sum to force scenery through an occluding fence. From .75period/pixel onward, phase cannot generate a slow wave. Full physical overlap remains exactly opaque. At this source section, a view beyond about63.4° from fence normal legitimately loses the gaps; the far fence can therefore still read as a continuous surface. Its brightness is still the existing two-face steel BRDF, not a new colour or exposure workaround.

Capacity ceiling is now87 submissions:21 cells ×2 sides ×2 possible representations +3 fixed path/curb/rail batches. Only mixed side domains need both representations. The tested station640 ordinary driving pose selects632 physical and19,830 filtered bars in4 mixed side domains, at most49 nonzero submissions before ordinary frustum culling. The full20462-member matrix staging copies use2,619,136 bytes; selection/capture flags plus one ordinary camera's history use81,848 bytes. Additional retained non-cube cameras use one byte per member each. No allocation occurs per bar per frame. These are CPU staging allocations; no GPU memory reduction is claimed.

The bounded local check in `artifacts/local/fence-projected-selection/timing.json` measured only the Node selector callback over40 moving-camera samples after5 warmups: median0.852ms, p95 2.499ms, maximum3.143ms on this run. It excludes rendering/GPU cost and is not a native frame-rate claim. Shader radiance still evaluates both faces and uses transparent compositing.

Eleven focused checks now pass across coverage, radiance and projected selection. They retain physical box-ray correctness and all default matrices/budgets; prove area-mean preservation and zero subpixel phase modulation; conserve every real member across both sets; exercise current viewport resizing, the10m protection, hysteresis/return, and stationary frames without buffer uploads; and verify actual Scene callback lifecycle. Scoped strict TypeScript passes. Native shader compilation and slow lateral/forward movement remain parent acceptance work. Compare both the previously captured motion pose and a perpendicular/open-gap view before considering any default promotion.
