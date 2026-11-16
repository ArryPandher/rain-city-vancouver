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
