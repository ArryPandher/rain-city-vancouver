# Conservatory end-view structure and thin-sheet optics

2026-11-15. Reference: Dietmar Rabich's June 2022 west-entry photograph, with
local provenance in the existing Canada Place source notes. The cropped
southern end shows overlapping green transmitted structure behind pale painted
framing. The new dimensions remain authored reconstruction estimates.

## Correct the missing exit sheet

The previously accepted optical pair was FrontSide-only. In the end-on gameplay
view a ray entered the end pane, then left through the back of the curved pane.
That second pane was culled, so the view contained unfiltered blue sky behind
widely spaced ribs. This is an actual missing surface contribution, independent
of the chosen glass tint or the reflection-probe intensity.

The canopy-only pair now uses DoubleSide with forceSinglePass on BOTH ordered
materials. The extinction shader uses the absolute view-normal cosine; the
physical reflection shader uses Three's ordinary back-face normal correction.
Each physical sheet renders its multiply/add pair once from either direction.
Three's default two-render transparent DoubleSide path is deliberately disabled.
The entrance roof's coincident opposite-wound faces were removed, leaving one
14-triangle physical sheet. Its underside remains visible without applying
attenuation twice. End surfaces remain separate meshes for depth sorting.

An initial native comparison retained the earlier throughput(0.62,0.88,0.76)
and showed pale cyan/grey glazing with chalky transmitted members. A canopy-only
trial uses linear throughput(0.45,0.85,0.65), stronger red/blue extinction to
match the green transmitted structure in Rabich's end view. These are authored
optical estimates, not measured glass specifications. IOR1.5, roughness0.12 and
probe intensity0.8 remain unchanged. Hall and upper-hotel optics, capture placement, daylight and
exposure are unchanged. No refraction or hardware ray tracing is claimed.
The implementation is still an approximate sorted transparency treatment,
not a general solution to arbitrary intersecting transparent volumes.

## Give transmitted structure readable depth

Connected secondary frames alternate between the existing primary ribs.
Twenty-one interior planes use two upright depths, outward0.28 and1.25m.
Crossmembers at source heights10.6/12.4/14.2m and longitudinal ties connect
the members into the existing primary structure. The narrower90mm secondary
members remain distinct from the140mm primary posts. Nothing expands into
the public route, changes the accepted lower recess, or creates playable rooms.
The photo's diagonal assembly is not asserted to be a specific staircase or
reproduced as arbitrary bracing.

Pale frame paint uses non-metallic diffuse/specular behavior in place of the
previous sage metallic blend. A darker, near-neutral closed lining separates
the transmitted members; the glass supplies the green attenuation. These
material values are visual estimates, not sampled finish specifications.

The structure adds98 box members/1,176 triangles to the existing frame batch.
After removing14 duplicate roof triangles, the whole conservatory has13,056
unique triangles/14,464 submitted triangles across the unchanged7 meshes and
11 draw groups. No new runtime maps or probes are required.

## Verification scope

The sheet-crossing regression tests real generated geometry: an end-on ray
crosses an entering end pane and exiting curved back face; vertical roof rays
cross exactly one physical roof sheet from either side. Separate structural
rays verify uprights at both depths, transverse/longitudinal ties and retained
floor contact. Original source cut, public-route and entrance tests remain.
These CPU checks establish geometry/optical configuration, not visual quality
or sustained frame rate. Native appearance and renderer checks follow before
publication. The AAA realism goal remains unfinished.

## Native candidate review

Matched southern-end views at approximately(454.65,7.88,-567.87), camera
yaw2.070/pitch-0.0555/FOV62, show the added overlapping structure and the
previously missing far-sheet contribution. The initial pale transmission was
rejected in review; the(0.45,0.85,0.65) trial separates pale exterior frames
from greener transmitted members. The grazing city-facing view retains
untinted cloud reflection and readable frames. Independent review accepts
this bounded color/depth revision, while noting the broad flat closed lining
as a remaining architectural approximation.

Native inspection also identified an inherited coplanar overlap at the lower
southern return: the old stone end plinth extended to8.65m over the new lining
beginning at7.8m. Its southern top is now clipped to7.8m, keeping the foundation
below deck and exactly one opaque skin above it. A real-geometry regression
checks both elevations. Thirteen focused optical/source/structure tests pass.
Final published native inspection must confirm that the checker patch is gone;
the earlier candidate images still contain it and do not prove the correction.

Local connected walking, approach driving/braking, pistol fire/holstering,
summoning/reversing/braking and exiting beside the canopy pass. Captured
warnings/errors are empty after the separate experimental tree shader repair.
The tree optimization did not demonstrate a frame-time gain in controlled
comparison and is **not enabled in normal gameplay**; see
[the measured comparison](fallback-tree-batching.md).
