# North water and Robson daylight native comparison

2026-11-16, frozen build `86a78e9`, existing Codex browser tab at its ordinary viewport. All 1,037 tests and the production build passed. The native bundle was `index-CPvsSfg9.js`, 2,319,419 bytes, SHA256 `a34700382611a826bce1183eb75cf29388013ba2e13bfc674cc5ee9a2c631fda`. Unfinished north railway terrain was excluded using a Git archive. No new browser, screenshot renderer, photographic postprocessing or photo mode was used.

## Static north-water cube: not accepted for default gameplay

Camera position `[684.6432759,10.51209325,-693.5630883]`, yaw `2.6432963268`, pitch `.19`, FOV62, ordinary walking player `[686.6983737,7.88,-697.3402]`. Daylight remained south180, sun3.4, hemisphere1.15, exposure1.08.

The dedicated scene cube compiled and captured once: status ready, null error, 1,198.1ms preparation wall time, 2,621,424 retained color-texture bytes. That time includes CPU submission and setup; it is not GPU duration. The fixed camera registered exactly with the baseline. Turning the option off reported zero retained option bytes; the independent HDR and wave options also restored their original/off states. All102 shared image sources were ready. No warnings/errors were recorded from this build during the review.

The darker reflection is visible in near water, but its260m spatial limit produces an obvious transition into pale distant water. Combining the scene cube with the HDR and directional-wave options does not remove that transition. The added reflected tones do not justify publishing this discontinuity. The result remains debug-only. Original water and all comparison options were restored before leaving the view.

Local evidence: `water-scene-off-native.png`, `water-scene-on-native.png`, `water-scene-combined-native.png`, `water-scene-combined-off-native.png`, matching off/on/restored profiles, and `north-water-native-logs.json` under `artifacts/local/`.

Next implementation direction: a bounded, camera-correct planar reflection of the existing scene, with the actual ocean plane and no circular surface cutoff. This must be evaluated for normal camera movement, near-shore registration, clipping, state restoration and native render cost before acceptance. Increasing a static cube's radius alone would trade the visible seam for inaccurate near-object parallax.

## Hemisphere fill: retain the existing default

Compared1.15 and0.575 hemisphere intensity with the same camera/player at each Gallery and Hotel viewpoint. Sun, HDR orientation/intensity, exposure, bloom, materials and geometry were held fixed; the normal weather action invalidated local probes. The profiles confirm identical camera/player values within each pair and the intended intensity change.

The half-fill option subtly darkens shaded recesses and vegetation. It does not materially improve the flat wall fields or restore absent surface detail. This is insufficient evidence for a global daylight change. Normal1.15 remains the default, and the option was turned off after review. No general fidelity, FPS or memory improvement is claimed.

Local evidence: `robson-fill-off/on-native.png`, `hotel-fill-off/on-native.png` and matching profiles. The Hotel pair is at player `[-117.2766943,0,49.5151362]`; it is a new reached walking view, not an assertion that it duplicates the earlier wider Hotel photograph.

The independent Robson source audit instead identified a concrete material mismatch: the modern west terrace inherited the heritage foundation's ashlar joints. Its source-grounded cast-concrete correction is a separate candidate requiring native review under unchanged lighting.
