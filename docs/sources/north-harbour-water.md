# Normal local NorthPoint harbour water

The normal-mode owner enables the accepted **current-camera planar reflection + bounded normal-driven ripple + authored directional gravity normals** near Canada Place NorthPoint. It does not import the rejected static cube/PMREM, HDR-water replacement or half-daylight-fill experiment. Those remain independent debug comparisons on the development branch.

Root's frozen573 native comparison showed aligned North Shore reflection during camera panning, ripples breaking up the rigid mirror, and the directional-wave combination producing more coherent broad motion than the original normal field. The recorded first capture cost48draws/89,629triangles and34.5msCPUwall. A later motion review recorded79captures, last7.8msCPUwall,31draws/86,199triangles with no warnings. These are observed sample submission costs, not GPU timings, frame-rate guarantees or validation of this new production cadence.

## Bounded lifecycle

Only daytime, balanced/high quality, outside the intro, and a camera above the ocean within170m of `[686.698,-697.34]` qualify. Reflection weight is full to90m and smoothly zero at170m. Directional normals are restricted to actual ocean-height fragments, worldy=.065, and blend with exactly that camera/reflection weight. Other water heights and locations keep their original normal/material behavior. Once the camera leaves eligibility, quality becomes low, daytime ends, the intro opens or teardown runs, owned layers and target are disposed and the original water returns. Re-entry prepares a fresh local capture. There is no new scene asset, geometric water displacement or collision change.

The512²RGBA16F planar target costs2MiBcolour plus approximately.75–1MiBdepth, budgeted at1MiB. No cube, PMREM or extra normal texture is needed. The detached plane/reflector material and all owned shader layers are freed on exit, pagehide or water-material disposal. A capture failure also releases them and suppresses per-frame retry; explicit invalidation or a later eligibility re-entry can retry.

Ordinary moving refresh is limited to once per125ms (**at most8Hz**). Idle reuses the target. Initial/lighting invalidation is allowed immediately when the ordinary reflection scheduler permits, rather than waiting out that interval. Invalidated lighting remains hidden until recaptured. Between ordinary moving refreshes, the existing texture and its own capture projection matrix stay together; the live camera never overwrites the cached texture's matrix. This avoids a mismatched-matrix bug but does not make the stale view identical to a newly rendered perspective: translation and fast pans can still expose approximation/coverage limits. Native8Hz motion review remains required.

Capture retains the existing original static-root visibility, suppresses water and non-root scene children, and does not refresh shadows twice. Separately attached detailed trees are omitted, while root fallback foliage remains. Existing material/light/exposure/fog settings are preserved. Wave-driven UV offsets use the authored gain.15 and smooth8target-texel bound, with frame-edge/below-plane fallback to the undistorted planar sample. These are bounded approximations, not measured Vancouver wave parameters or ray tracing.

## Debug coexistence and public integration

The development branch retains its independent planar, ripple, wave and HDR comparison controls. Enabling a comparison first suspends the production owner, preventing duplicate shader layers/resource ownership. When comparisons are off, normal eligible behavior resumes. Re-entry immediately publishes each new owner's uniform objects to Three's persistent ShaderMaterial uniform map after successful layer registration. Cached programs therefore see the new target without requiring onBeforeCompile to run again. All-water debug and ocean-only production waves use distinct stable variant keys; repeated entry does not create a unique key or shader program per owner. A renderer-cache-faithful12-cycle regression reproduced the stale zero-weight/null-target failure before this fix.

The debug-only **Local harbour water (normal mode)** checkbox can disable the production owner for an original-water baseline. `lighting.northHarbourWater` exposes lifecycle status, local resource budget and nested capture costs; main rendering cannot erase the separately recorded capture counters.

For current public base `c0302e1` (same World/main baseline as43980ad), the minimal source package is:

- `north-harbour-water.ts` lifecycle owner.
- `water-planar-reflections.ts`, `water-planar-distortion.ts`, `water-waves.ts`, `water-shader-layers.ts` accepted Three-only implementation dependencies.
- Minimal World/main hooks: weather/orientation invalidation, local update after ordinary reflection capture, no-water feedback wrapper, pagehide cleanup, diagnostics and the debug normal-mode baseline toggle.
- Portable `north-harbour-water.test.ts`, `water-planar-distortion.test.ts` and `tests/helpers/north-water-fixture.ts`.

No `water-optics.ts`, `water-scene-reflections.ts`, static cube/HDR PMREM fixture, half-fill UI or new asset is required. The clean base-specific integration package omits those experiment imports entirely. It retains normal-vs-original comparison in debug; the richer individual experimental controls remain on the development branch.

Tests exercise the actual installed Three Reflector callback with a controlled renderer: mirrored camera, clip plane, projective coordinates, capture cadence and matrix consistency, idle reuse, dirty-lighting deferral/fresh capture, local quality/weather/intro exits, failure release, comparison ownership and ocean-only normal blending. Mocked renderer counts do not establish GPU pixels or cost. Native review must verify region entry/exit and the new8Hz cadence before public release.
