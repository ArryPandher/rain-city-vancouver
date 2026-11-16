# Bounded planar reflection ripple comparison

## Source and native starting point

Root's frozen87eb112 native `water-planar-on-native.png` showed a coherent reflected North Shore silhouette with the former260m surface cutoff gone. A110px camera pan remained aligned. Its capture profile recorded48calls/89,629triangles,34.5msfirstCPUwall and512²RGBA16F colour storage. That validates the mean-plane registration as a promising diagnostic; it does not establish realistic animated water or acceptable movement performance.

The installed Three r182 `examples/jsm/objects/Water.js` perturbs projective UVs using `normal.xz * (0.001 + 1 / distance) * distortionScale`, with default scale20. That example combines a four-layer normal texture and its own optics. Copying its constants would not calibrate our waves: directly assigning worldXZ normals to screenUV also ignores this camera's orientation. No source code/assets from Water are copied into the game; its approach informs this original bounded variant. Three retains its existing MIT attribution.

## Camera-oriented sampling

The independently toggled **Ripple planar reflection (comparison)** uses the existing shader normal `n`. Starting from incoming eye-to-surface direction, it computes flat-plane and tilted-normal reflected ray directions. Both are projected through the captured planar world projection matrix with homogeneous **w=0**, so translation does not incorrectly act on directions. Their projectiveUV difference perturbs the original mean-plane lookup. A flat normal therefore gives exactly the original sample, and rotating the complete camera/world configuration rotates the physical inputs without assigning world axes directly to texture axes.

This is a far-radiance angular approximation. A single colour reflection target has no scene-depth information to recover true rays from different water facets to nearby ships. **Angular gain0.15 and a smooth eight-target-texel limit are authored limits, not measured Vancouver water parameters.** The smooth bound is `delta / sqrt(1 + |delta/maxUV|²)`, with maxUV8/512. It avoids a hard displacement clamp and keeps the existing mean camera registration. No surface positions, wave amplitudes, shoreline geometry or optical brightness parameters change.

For comparison, the unattenuated angular field in an isolated synthetic NorthPoint framing produced median26.7/p9566.4 target texels, too strong for this conservative first trial. `artifacts/local/water-planar-distortion-study.ts` records a CPU-only study using the existing directional field, not rendered pixels or exact reconstruction of the recorded walking camera's look target. The committed gain/cap significantly reduces that displacement. It is not a calibration claim.

## Coverage and continuity

A perturbed ray approaching the reflected camera's rear hemisphere smoothly loses its offset. Rays tilted below the mean ocean plane also ease back to the undistorted sample, since this clipped capture has no water/self-reflection coverage there; this avoids pulling the HDR's lower ground/solar image into the water. Near the capture boundary, the offset shrinks within the available distance to the half-texel interior and eases out over two target texels. Its limit is the **undistorted planar sample**, not pale sky or a new distance-dependent water colour. There is no260m water-region cutoff, and no new per-fragment distance band. The target remains sampled once with its existing bilinear filter; no extra image or render pass is added.

The comparison first operates with the original normal field, as requested. The independent directional-wave checkbox can then replace that field with the already authored eight-component analytic spectrum and its existing4-to2pixels-per-crest attenuation. That option suppresses unresolved wave normals toward the flat plane; distortion correspondingly returns to the same planar radiance, rather than a far white fallback. With the original field, its old axis-biased repetition can still be visible: this sampler does not claim to repair the input normal field. No second sinusoid grid/noise field is introduced.

The512px target still has no mip chain or depth buffer texture for sampling; high-contrast reflected silhouettes may alias under compression, and the simple planar model cannot reproduce full water self-reflection/refraction. Native motion and edge checks remain necessary. No extra prefilter or arbitrary blur is added before that evidence.

## Control, cost and verification

The default ripple flag is off, separate from the default-off planar reflection. `World.setDebugWaterPlanarDistortion` is debug-gated and retains the choice while the planar backend is off. Toggling the ripple flag only changes a uniform: it does not invalidate or render another capture, replace material ownership, or change HDR/wave toggles. It adds two direction projections, bounded offset arithmetic, and no extra texture fetch beyond the original planar lookup. GPU cost has not been measured.

`lighting.waterScene.distortion` records requested/active state, angular gain and maximum target texels. The existing planar capture resource/count/time diagnostics remain unchanged. Pagehide clears the ripple choice along with the reflection backend.

Focused tests verify exact flat-normal sampling, rotation covariance, homogeneous-direction translation independence, extreme normals staying inside capture/max offset, continuous boundary fallback, continuous existing-wave motion, unresolved wave fallback to the same planar UV, and independent toggling without recapture or ownership changes. The full planar lifecycle/clip/projection/invalidated-lighting tests remain passing. Eighteen focused tests and TypeScript passed; no GPU pixel result is claimed.

Native comparison: keep the recorded NorthPoint camera/light, enable planar, toggle ripple alone using original normals, then compare with the existing filtered directional waves. Pan so shoreline reflections approach frame edges and walk enough to trigger capture refresh. Reject a bright boundary, displaced overall shoreline, large rubber-sheet motion, or new aliasing. This checkpoint remains a diagnostic and does not promote any water option to default.
