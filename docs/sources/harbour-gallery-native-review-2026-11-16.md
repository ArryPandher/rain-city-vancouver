# Harbour, Gallery and railway bank gameplay review

Reviewed in the existing Codex browser tab with normal third-person walking on frozen build5738316 (bundle index-BwaY5qSo.js; SHA2569f8d83fae9ecb08aa28b497382f16dd956809e540bc905e4f63ba4b58b4c8a5d). No new browser, headless render or hidden runtime teleport was used. Visible guarded review-point controls selected the starting positions.

## Gallery

Accepted the Hooper-end correction6e2eb0c: three wide window bays in two rows, four engaged pilasters and deeper classical trim visibly improve the matched arrival and adjacent walking views. This remains an approximate reconstruction of the cited Vancouver source photograph. Local screenshots gallery-hooper-arrival-native.png and gallery-hooper-close-native.png record the result. All105 shared texture sources were ready. The near hedge still appeared as a solid green band; subsequent foliage0079ca6 is unreviewed. Main cherry-picks d31f907/c0302e1 are undergoing Pages43903500941; this document does not assert successful deployment.

## Harbour

The camera-correct planar reflection removes the prior static-cube distance ring and keeps the North Shore reflection registered after a native pan and walk. The bounded normal-driven ripple breaks the mirror appearance; filtered directional waves looked more coherent than the original fine speckle. No new warning/error was captured after this build's navigation timestamp2026-11-16T15:51:36.331Z.

Toggling ripple alone retained a single capture. Moving the camera110px and walking1.8seconds produced79 captures total; last capture7.8ms CPU wall time,31draws/86,199triangles. Total capture wall time597ms. This is not GPU timing or a frame-rate improvement. The512-square half-float target retains2,097,152 colour bytes plus1,048,576 budgeted depth bytes. Production lifecycle/rate/quality gating is a separate pending change; these controls remain debug-only in the reviewed build. The model is a mean-plane reflection plus bounded UV approximation, not ray tracing or full water optics.

Evidence: water-ripple-{on,directional,motion}-native.png; water-ripple-{off,on,motion}-profile.json; hooper-ripple-native-logs.json. Frame-edge behaviour in the observed pan showed no new bright seam. This short check does not establish every angle or sustained smoothness.

## Railway bank

REJECTED for visual promotion. The guarded ground point and roughly6m of native lateral walking worked, but rail-north-bank-ground-native.png and rail-north-bank-side-native.png show a huge untextured white triangular closure. Source inspection identifies an oversized vertical face incorrectly assigned to concrete, not a missing grass image. Correct the actual earth slope/underpass geometry and retain concrete only for the bearing before another native review. This diagnostic arrival does not prove a connected walking route from the highway.

The official Ironworkers plan audit separately finds the current main steel assembly roughly316m too far north and the generic road profile too low. Source-registered helper258d50f remains uninstalled until terrain, roads and buildings share coherent grades. Printed stationing is stronger evidence than image-derived heights; the latter retain metre-scale uncertainty. None of this is a claim that the AAA goal is achieved.
