# Tree shadow receiver candidate

2026-11-15. A scoped DetailedTrees API is ready; main render integration and native acceptance
remain the parent’s responsibility. Production behavior changes only when called.

The authoritative `artifacts/local/robson-public-profile.json` records 24 medium
street-tree leaf shadow draws, each 81,602 triangles (1,958,448 total), versus
two beauty draws / 163,204 triangles. `streetTreeLOD` is near=0, medium=24.
These are not stale near meshes: DetailedTrees keeps the selected medium level
for both passes, and 22 additional trees intersect the sun's broad camera but
not the gameplay camera. Off-camera casters can legitimately shade the view.

`TreeShadowReceivers` offers conservative directional receiver culling, not
lower-fidelity leaves. It tests a tree-part world bounding sphere swept along
the direction away from the sun against all six gameplay-frustum half-spaces.
The common nonnegative ray interval is necessary for any sphere point to cast
onto a receiver in that frustum. Rejection therefore proves irrelevance within
the represented bound; acceptance can overestimate. A 1 mm guard and invalid
input fallback preserve casting. No ground-only receiver assumption is made:
building/character/canopy receivers anywhere in the frustum are retained.

A local actual World.vegetation fixture, saved Robson camera position/FOV and
look direction, and the committed daylight vector selected 24 medium candidates
with two beauty candidates. Conservative whole-tree spheres retained 14 and
excluded 10, including retention of 12 off-camera casters. Potential leaf
submission avoidance is 816,020 triangles for this cold-selection reproduction.
This is not an exact replay of the runtime's hysteresis/previous camera history;
source distances differ by several metres. The ignored reproduction script is
`artifacts/local/measure-robson-tree-shadow.ts`. This is CPU geometry evidence,
not GPU timing or an FPS promise. Tighter actual per-part sphere decisions may
differ from this broad whole-tree estimate.

## Integration contract

Only use the controller on dedicated DetailedTrees slot meshes, whose normal
policy is castShadow=true. Do not apply it to unrelated meshes with authored
shadow exclusions. Call update(slotMeshes, gameplayCamera, sun) before shadow
traversal and after camera/tree world matrices are current. If it returns true,
invalidate the static shadow cache. Do not change flags inside onBeforeShadow:
that callback is too late to remove the scheduled draw.

Before reflection/cube captures, call update(slotMeshes) with no view to restore
all original casters, invalidate/re-render the capture shadow map as appropriate,
then reapply the gameplay view policy and invalidate again. A gameplay-only
shadow map must not be reused as if it covered every reflection direction.
Views that change without enough player movement to reselect tree slots still
need this policy reevaluated. Light/weather changes likewise require reevaluation.
The candidate has no geometry copies, maps, allocation proportional to tree
vertices, or visibility/material/LOD changes. Existing off-camera source-buffer
release is untouched. Controller scratch storage is five small Three objects.

Three focused tests cover off-camera incoming versus outgoing shadows,
conservative sphere-point ray samples, transformed instances, stable repeated
updates, exact buffer identity and full-caster capture reset. These checks do
not constitute native acceptance. Root must verify gameplay movement, canopy
and character shadows, weather/reflection refresh, and matched native counts
before adopting the integration.

## Scoped runtime API

`DetailedTrees.withShadowReceivers(camera, sun, changed => render())` is the
preferred integration. Call after `reflections.update()`, wrapping the final
`shadowCache.render` / composer draw. The method updates camera, light, target
and active slot world matrices, retaining existing conservative per-instance
bounding spheres. Only visible selected levels participate; geometry buffers
are neither rebuilt nor copied. Each call re-evaluates the receiver view, even
if gameplay is paused and the 3 m detail-selection update has not run.

The helper records exact prior casting flags, excludes intentional non-casters
from policy changes, and restores every flag in `finally`, including when the
draw throws. The callback's `changed` flag permits the caller to request shadow
refresh. Restoring flags does not itself refresh the GPU shadow map: the caller
must still honour the existing reflection shadow refresh and camera/light/world
revision invalidation contracts. This scoped approach supersedes manually
resetting casts before and after captures. The draw must be synchronous.

A fourth focused regression covers throwing draws, preserved prior false flags
and camera-only changes without actor updates. No probe, world or main source
is modified by this helper/API addition.

The scoped callback's `changed` value compares mesh IDs and desired casting
flags (including visible-slot membership) with the last successful scoped draw,
not with temporarily restored flags. Identical paused frames therefore stay
clean. A thrown draw clears that success baseline and restores original flags,
so retry is dirty. Tests cover first draw, identical repeat, camera rotation,
slot disappearance/reappearance, and failure both before and after a successful
draw. The retained map contains only the previous selected slot IDs/booleans,
not tree geometry or buffer references.

`DetailedTrees.shadowReceiverState` exposes the last successful scoped counts:
`tested` eligible caster meshes, `retained`, `rejected`, and separate
`intentionalNoncasters`. It is undefined before the first success, then a frozen
snapshot. Failure leaves the previous successful diagnostic snapshot intact
while marking the policy retry dirty. These are actual selected-part counts,
not whole-tree counts or estimated triangle savings. Existing render-profile
submission attribution remains necessary to establish the triangles avoided.

Filtered-shadow safety: each tested world sphere is additionally expanded by
`2 * max(1, radius) * hypot(spanX/mapWidth, spanY/mapHeight) + abs(normalBias)
+ abs(bias) * (far-near)`. The two texel-diagonal allowance per filter radius
conservatively covers PCF taps; normal/depth offsets are added in world units.
For a 160 m square span, 4096² map, radius 3.5, normal bias 0.025 and depth bias
-0.00004 with 399.9 m depth span, the margin is about 0.428 m. This deliberately
overestimates rather than clipping a soft shadow at the screen edge. Nonfinite
or invalid extents/map sizes/filter radii retain the caster. A focused boundary
regression proves a geometric miss becomes retained with filter padding.
The earlier cold 24→14 estimate predates this added margin and is not a final
native count prediction; use the runtime policy counts for acceptance.


## Integrated native checkpoint

The final render now uses the scoped API after reflection capture. Seven focused helper tests pass, including exception restoration, paused-view changes, selected-slot membership and conservative PCF/depth-bias padding. The complete local release suite passes 457 tests.

At the near-matched ordinary Robson view, the final profile records 72 eligible mesh parts, 42 retained and 30 rejected. Medium leaf shadow draws fall from 24 / 1,958,448 triangles in the prior release to 14 / 1,142,428 triangles. Near/medium selection remains 0/24. Native camera rotation, walking and car use retain visible tree and foreground shadows; 25 reflection captures complete without a recorded error. Saved stills do not prove every possible transition is pop-free.

The final quiet 20-second scene sample averages 20.55 fps, compared with 23.34 fps in the earlier release sample. Different dynamic load and laptop conditions prevent attributing that difference to one change. This adoption reduces measured leaf-shadow submissions; it does not establish an overall frame-rate gain. See `docs/ROBSON-GARDEN-HOTEL.md` for the full limitations and evidence paths.
