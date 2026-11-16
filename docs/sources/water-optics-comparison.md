# Debug HDR-water reflection comparison

The default water is unchanged. The optional, day-only comparison replaces its constant reflected fog color and separate analytic sun lobe with one directional reflection sampled from the existing daytime HDR. It is a diagnostic candidate pending ordinary-camera native review, not an accepted harbour material.

## Motivation and controlled scope

The native Canada Place apron profile records matching scene/water sun direction S180°, elevation28.288°, exposure1.08. The current water shader reflects `scene.fog.color` at every direction and never samples sky or nearby geometry. CPU evaluation along the recorded view showed the pale constant reflection dominates the100m surface; a darker deep-water color or different Fresnel alone would not address it. Local source/reference audit: `artifacts/local/water-optics-audit/recommendation.md`.

`water-optics.ts` inserts only the reflection alternative before the existing additive noise and fog terms. The existing two sinusoidal waves, noise grids, finite-difference normals, `.85*(1-NdotV)^3` Fresnel weighting, deep color, water elevation, fog expression, exposure and global lighting are untouched. The original shader source and original uniform objects are restored on disable. Non-day weather sets the comparison weight to zero without changing its accepted appearance.

The candidate samples the physically reflected world direction using Three's own CubeUV PMREM lookup, with an explicit128-face atlas. The lookup rotation follows WebGLBackground's inverse-Euler convention and the actual scene background rotation, including southeast/south/southwest controls. It uses the existing background intensity, without an extra brightness/tint multiplier. A fixed0.1 lookup roughness filters the small solar emitter; this is an explicit diagnostic filtering choice, not measured harbour wave roughness. The broad wave shape remains unchanged.

The HDR already contains the solar region, so the candidate replaces the entire old environment-plus-analytic-sun alternative. It does not add another sun to it. Below-horizon reflected directions retain the complete old response; an upper-hemisphere transition over directionY0..0.05 (~0..2.87°) avoids a discontinuous seam. This confidence blend deliberately avoids showing the HDR photograph's unrelated ground. It is not a substitute for real shoreline/ship reflection or physical horizon occlusion.

## Shared source and owned resources

Input is the already loaded, runtime-luminance-limited `public/textures/afternoon-sky.hdr`: **Rustig Koppie Pure Sky**, Greg Zaal / Jarod Guest, Poly Haven, CC0-1.0. [Existing provenance, hash and license](afternoon-daylight.json); [existing central attribution](../../THIRD_PARTY.md). No additional asset is downloaded or copied. The shared texture, its pixels, sampling state and lifetime are unchanged.

A one-time area-weighted box filter makes a512×256RGBA16F input from the loaded2048×1024HDR, preserving its flipY/color-space convention. Weighting accounts for equirectangular row solid angle and avoids point-sampling the solar disc. A separate short-lived PMREMGenerator filters it. Public PMREM APIs are used; no renderer-private shared PMREM cache is borrowed.

The owned output is **384×512RGBA16F, no depth buffer or generated mip chain**, with the PMREM LODs packed inside that atlas: **1,572,864 bytes (1.5MiB)** of retained texture storage. The temporary input is1,048,576bytes, and PMREM ping-pong is another1,572,864bytes; combined texture peak is approximately **4MiB**, excluding small filter meshes/shaders and driver overhead. Temporary input and generator scratch resources are disposed immediately after construction. Output is disposed on toggle-off or water material disposal. Renderer target/cube face/mip, autoClear, toneMapping and XR state are restored even when filtering fails. An unsupported input/target leaves original water unchanged.

There is **no scene capture, extra water draw or per-frame filtering**. The active shader adds one PMREM lookup for upward reflected directions. The first enable performs CPU filtering/GPU filter submissions and may pause briefly. Profile `preparationMs` is CPU wall time including those submissions, not a GPU duration or measured frame-rate result. Actual target dimensions and retained texture-byte accounting are reported; native renderer memory/frame cost remains to be checked.

## Root debug-control contract

- `World.setDebugWaterOptics(renderer, enabled): boolean`: enabling requires the URL's existing `debug` flag and loaded daytime HDR; false means it did not enable. No URL flag alone starts it. Disabling is always allowed and disposes its owned target.
- `World.waterOpticsDiagnostics()`: `requested`, `active`, `status`, source, target dimensions, retained/transient texture bytes, filtering roughness, rotation/intensity, CPU preparation time and below-horizon limitation. Off reports original/error and zero retained bytes.
- Visible debug label: **HDR water reflection (day only)**. Root owns the checkbox and `lighting.waterOptics` profile hook in main.ts. Suggested pagehide cleanup: call `setDebugWaterOptics(renderer,false)`.
- `setWeather()` and `setDebugDaylightOrientation()` refresh only the comparison's active weight/rotation/intensity. They allocate no new target and do not change accepted global fields.

## Validation and native acceptance plan

Focused tests use the actual retained HDR and loaded runtime clamp policy, verify filtering energy to0.1%, preserve shared pixels/orientation, and align the independently recorded solar direction under all three real daylight orientations. They exercise actual World weather/control hooks, exact restoration of default shader/uniform ownership, day/non-day gating, resource disposal and filtering-failure renderer restoration. Resource-construction tests substitute a PMREM target factory because no browser/GPU is used; they do not claim GPU shader compilation or image acceptance.

Root should compare unchecked/checked at the same Canada Place apron camera `[516.1658,10.5121,-495.6463]`, yaw2.32061, and a normal bridge side/path view. Hold camera, time and day lighting fixed; inspect coherent sky-direction variation, stable solar glint and the horizon transition, not simply whether water is darker. Turn toward/away from the sun, switch day→night→day and toggle off to verify restoration. Inspect profile target bytes and absence of extra draw/capture counts; record first-enable pause separately from steady frame timing.

Sky-only reflection still misses the ship, terminal, bridge shadows and forested shoreline. If it produces a differently colored sheet, unstable glint or an obvious fallback seam, retain default and reject this candidate. Do not promote it based solely on a close crop or combine unrelated wave/fog/brightness edits into the first A/B.
