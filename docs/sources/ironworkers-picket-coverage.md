# Ironworkers distant picket coverage candidate

## Problem and bounded scope

`artifacts/local/ironworkers-fence-native-path.png` shows broad wave bands in the repeated pickets at a grazing walking view. The previous distant LOD replaced each physical box with an opaque bar-width plane. This reduced triangles but did not filter the subpixel spacing. Changing metal color or roughness would not remove that spatial aliasing.

This candidate changes only the existing distant picket representation in `createRenderGroup`. Near boxes, the180m LOD threshold/hysteresis, actual member matrices, posts, rails, curb, floor and every collider remain unchanged. Geometry/debug callers using non-standard materials retain the previous simple-plane fallback; the actual World pipeline supplies MeshStandardMaterial and receives filtered cells. No global renderer change is made.

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

The native acceptance pass should compare the same along-path view, one perpendicular across-fence view, and slow lateral movement. Confirm distant wave bands reduce, frontal open view remains, real near silhouettes persist and no wall-like pop occurs at the unchanged transition. Existing nearer aliasing can remain because the180m switch was deliberately preserved in this first bounded candidate; changing the near/mid representation is a separate decision. Root owns native build and review. No browser/full build run by the implementation agent.
