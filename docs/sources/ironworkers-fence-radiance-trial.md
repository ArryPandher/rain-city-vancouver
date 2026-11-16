# Ironworkers fence: projected radiance filter

2026-11-16. **Accepted for normal rendering after matched native review.**
World now calls `createRenderGroup(concrete, steel, {filterTrial: true})` by
default; the internal option name is retained for compatibility. Explicit
`?debug&fence=physical` restores the original 2 km physical-box tier and prior
extreme-distance fallback. `?debug&fence=filtered` remains default-equivalent.
Fence positions, 3 m height, authored 5×4 cm sections / 13 cm nominal pitch,
near materials, path/curbs/rails and all finite contacts are unchanged. The
sections below retain the diagnosis and trial history; the final native evidence
and default decision are recorded at the end.

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

The initial physical fallback draw ceiling was 24 and the initial whole-chunk
trial ceiling was 45 (superseded by the projected selection below); far lighting is evaluated twice
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


## Matched native acceptance and default decision (2026-11-16)

Root compared build 492 normal physical rendering with the same build's existing
`?debug&fence=filtered` mode, using the identical bridge car-arrival control.
Player coordinates match exactly; camera positions differ by only
1.1369e-13 m and FOV by 2.8422e-14 degrees. Both have yaw −3.1228782611,
pitch .19, mode 0, FOV 62 and South 180 daylight. The camera is approximately
[6815.8701,6.8012,−983.1532], player [6815.7073,2.9082,−991.8516].

Evidence in `artifacts/local/`:

- `ironworkers-fence-physical-arrival.png` and `ironworkers-fence-physical-profile.json`.
- `ironworkers-fence-filtered-arrival.png` and `ironworkers-fence-filtered-profile.json`.
- `ironworkers-fence-filtered-walkway.png` for nearby physical bars/posts and open gaps.

The large circular wave patterns visible in the physical arrival are absent in
the filtered arrival; root also observed the improvement while driving uphill.
The close walkway image retains individual three-dimensional bars and structural
rails/posts. Fine stripe alias remains at intermediate scale, so this is a
material improvement in readability, not a claim of perfectly stable sampling.
No new shader errors were captured. The apparently solid far band at strong
grazing angles is consistent with the actual repeated rectangular section's
projected overlap; it is not made artificially transparent.

The normal physical path's 2000 m switch means its extreme-distance shader is
not responsible for most ordinary bridge wave patterns. A read-only reconstruction
of the earlier 0c oblique camera found 61 visible physical bars, about 18.5–24.4 m
away, with pitches 3.0–6.1 physical pixels. None was retained by the 10 m protection.
The residual is near/mid high-frequency stripe sampling; no threshold or shader
change was made during acceptance. Camera reconstruction assumed the recorded
821×839 screenshot at DPR 1.35 and is not native draw attribution.

The matched arrival profiles report:

| Counter | Physical | Projected |
| --- | ---: | ---: |
| Whole frame calls |838|780|
| Whole frame triangles |2,230,964|1,776,262|
| Beauty triangles |962,449|593,517|
| Shadow triangles |1,268,484|1,182,714|
| Instrumented submission ms |37.2|45.5|

The projected material itself accounts for 42 beauty draws / 39,326 triangles.
Dynamic actors and other scene work differ between these frames. Whole-frame
counter differences are therefore **not isolated fence savings**, and the
instrumented submissions are not a sustained benchmark. No causal FPS gain is
claimed. The default decision is based on the matched visual improvement with
preserved source contacts and close geometry.

Root changed only the World render-mode gate. `filterTrial` is consumed solely
inside `createRenderGroup`; support and finite collision closures are constructed
from the original members beforehand. Both modes retain identical path geometry,
curbs, rail/post matrices and source picket members. Filtered pickets cast/receive
no shadows, while close physical bars and all structural rails/posts retain their
existing shadow flags. This is an explicit render-policy distinction, not removal
of physical contacts. The focused parity check now queries source top surfaces,
member centres, actor/camera contacts and above-fence clearance before/after both
render groups and after the actual Scene selection callback; values stay exact.
No existing test asserted the old debug-only World gate, so no brittle source-text
assertion was introduced. The physical fallback remains available for regressions.
