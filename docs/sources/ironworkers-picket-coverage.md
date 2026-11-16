# Ironworkers distant picket coverage candidate

**Current acceptance decision:** The 48 m shortcut was rejected in native driving and oblique walking: its planar shading creates visible bands at the representation boundary. Ordinary bridge gameplay now retains the actual rectangular bars, with the plane only an extreme-distance 2,000 m fallback. This trades additional bar triangles/shadows for continuous physical geometry; it is not a performance improvement or a claim to remove all subpixel aliasing. The historical trial below is retained as evidence, not the current distance setting.


## Problem and bounded scope

`artifacts/local/ironworkers-fence-native-path.png` shows broad wave bands in the repeated pickets at a grazing walking view. The previous distant LOD replaced each physical box with an opaque bar-width plane. This reduced triangles but did not filter the subpixel spacing. Changing metal color or roughness would not remove that spatial aliasing.

This candidate changes only the existing distant picket representation in `createRenderGroup`. Near boxes, actual member matrices, posts, rails, curb, floor and every collider remain unchanged. The initial180m switch is superseded by the measured48m/4% hysteresis trial below. Geometry/debug callers using non-standard materials retain the previous simple-plane fallback; the actual World pipeline supplies MeshStandardMaterial and receives filtered cells. No global renderer change is made.

## Coverage and correct grazing behavior

Source-section estimates remain5cm along-fence width,4cm fence-normal depth and nominal13cm pitch. The actual pitch used by both geometry and material is `LENGTH / ceil(LENGTH / nominalPitch)`, matching the integer physical picket distribution.

Each distant plane now spans one full pitch, with UV.x0..1 across the cell. The visible bar remains centered inside that cell. The shader integrates a periodic centered bar over the screen pixel footprint from `fwidth(cell)`, rather than thresholding a single sample. Its primitive is `F(s)=floor(s)*duty+min(fract(s),duty)` and coverage is the difference of F at the footprint edges divided by footprint width. This preserves average coverage for negative phases and footprints wider than one pitch.

The projected duty is angle-aware:

`clamp((barWidth + barDepth * abs(viewAlong / viewNormal)) / actualPitch, 0, 1)`.

This is the local parallel-ray projection of a rectangular physical bar. Frontal distant coverage approaches roughly38.5%, preserving approximately61.5% open view. At strongly grazing angles, real4cm-deep bars can legitimately close the projected gaps. Applying a fixed38.5% opacity at every angle would invent visibility through those bars. The far plane still approximates the lighting of the visible bar faces; it does not reproduce their individual specular side faces.

## MSAA/state contract

The existing main composer beauty target is4×MSAA. The cloned steel material uses alpha-to-coverage with ordinary opaque depth testing/writing and no alphaTest. It is not transparent/alpha blended, avoiding coverage being applied twice or transparent-sort overlaps between opposite fences. The steel color, roughness, metalness and environment response are unchanged. Three's `OPAQUE` define is disabled by alphaToCoverage, so the computed fragment alpha is retained.

Four coverage samples quantize the analytic fractional coverage. This is a candidate whose residual bands/shimmer require native slow-motion review, not a guarantee of continuous per-pixel alpha. Do not use this material on a single-sample target, where alpha-to-coverage cannot represent gaps. No opaque panel replacement or global AA change is proposed.

Far planes keep one instance per actual picket and the existing21LOD chunks/24maximum draws. No texture, material per picket or new draw batch is added. The larger coverage cells increase far-plane fragment area; no FPS benefit is claimed.

## Verification and next native review

Four focused tests validate projected duty against Three ray intersections through actual rectangular bars; filtered coverage against dense independent samples; preserved average coverage and material response; and real render-group integration with unchanged member matrices, near geometry, centres, LOD distance and budget. The five existing path-boundary tests also pass, preserving lane clearance, physical top parity, approach endpoints, finite camera contact and real gap behavior. Scoped strict TypeScript checking passes.

The native acceptance pass should compare the same along-path view, one perpendicular across-fence view, and slow lateral movement. Confirm distant wave bands reduce, frontal open view remains, real near silhouettes persist and no wall-like pop occurs at the unchanged transition. Some aliasing can remain on the retained close physical bars; the current48m switch specifically addresses the previously unfiltered near/mid distance. Root owns native build and review. No browser/full build run by the implementation agent.


## Native-driven mid-distance trial

The initial native far filter looked coherent but left strong wave bands within the180m physical tier. A CPU comparison at the saved ordinary drive camera found3,642 of4,924near pickets had projected pitch below one CSS pixel. Keeping64m chunks but switching at48m reduced that sampled near set to984pickets, none below one CSS pixel, with the same21chunks/24maximum beauty draws.32m chunks would raise the ceiling to45draws;16m chunks to87, with no benefit at that particular camera. These are layout/projection counts, not GPU timings.

The old10% hysteresis could delay return to physical bars until a bar was only8.05m from a normal walking camera. The new4% hysteresis makes the outward threshold48m and return threshold46.08m. A fine full-span0.5m station sweep on both sides produced5,320samples per camera mode. Minimum distance from camera to any far physical bar was10.56m walking,16.25m car lane and12.70m shoulder car. These are normal-camera source samples, not a guarantee for arbitrary photo/camera offsets. Evidence: `artifacts/local/ironworkers-mid-lod-proposal.json` and `ironworkers-mid-lod-phase-fine.json` with their .mts harnesses.

This is a hard representation switch over a1.92m hysteresis band, **not a crossfade**. No double-render overlap or additional draw was introduced. Native slow movement must inspect the transition for bar-shading/coverage pop. Since the far proxy is excluded from shadows, picket shadow extent also follows this shorter physical tier; structural rails remain casters.

Five coverage/LOD tests plus the path-shadow test pass; strict scoped TypeScript passes. The new regression uses actual LOD update/hysteresis across walking/car chunk phases and checks10m close-bar protection. The existing LOD-center shadow sampling now reports3casters/97,224triangles before light culling at its sampled centers, not a universal maximum; the denser phase sweep can retain1,970near pickets. No performance gain is claimed.

## Rejected native trial and physical fallback

Native screenshots `bridge-fence-48m-native.png`, `bridge-filtered-normal-native.png` and `bridge-filtered-normal-oblique-native.png` exposed the seam. Projected-area blended normals corrected the fixed-plane orientation but still do not equal the average rectangular-face BRDF. That approximation remains only in the remote fallback. All real member matrices, collision, materials, chunk sizes and draw ceilings remain unchanged. The actual LOD test now verifies physical bars across ordinary walking/car stations on both sides. Native review of this physical fallback is required before publication.

## Separate debug-only follow-up

The ordinary2km physical tier remains unchanged. A new optional first-hit
face-radiance trial diagnoses the rejected averaged-normal proxy and uses
continuous coverage with separately sorted side chunks. It is available only when
the caller explicitly passes `filterTrial:true`; the parent gates that option with
`debug && fence=filtered`. [Exact derivation, costs and native acceptance limits](ironworkers-fence-radiance-trial.md).
