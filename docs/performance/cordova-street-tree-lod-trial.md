# Cordova close-leaf LOD trial

This pass tightens full curved-leaf selection in `street-tree-lod.ts` and corrects
`DetailedTrees.update()` to measure distance and projected crown size from the
supplied camera's **world position**, rather than player feet. Movement and view
refresh also follow the camera's world transform, including parented cameras.
Camera-less callers retain their supplied x/y/z origin.

At the ordinary 62° vertical FOV, full curvature enters below 4m of the vertical
canopy extent and exits at 6m. A large projected crown no longer promotes the
full model. Narrow FOV extends both distances by its magnification relative to
62°; 35° gives approximately 7.6m/11.4m. Wider, absent or invalid projection values
retain the 4m/6m close range. Extreme zoom retains the previous 27m/34m hard caps.

The camera-origin correction matters at street level: a 13.7m tree's canopy
begins 4.11m above its root. Measuring from nearby player feet could therefore
prevent a 4m entry even while the higher chase camera was close to the leaves.
A regression test uses the observed close-walk pose and verifies camera-only
entry, retreat, re-entry and distant fallback restoration.

Medium/detail-to-depth-canopy criteria, tree budgets, visible-first sorting,
all mapped trees, original wood, source patches, transforms, materials and shadow
policy are unchanged. Medium leaves retain every source patch. The model
revision/cache key is unchanged because no model or image asset changed. The
existing update cadence (3m movement, small view rotation, FOV or budget change)
remains; thresholds apply when the selector refreshes. The historical crown-size
promotion is documented in [Harbour Green submissions](harbour-tree-submission.md).

## Native acceptance

Normal walking produced the following recorded selection sequence:

- `howe-final-sidewalk-profile.json`: first arrival, **0 near / 11 medium**.
- `howe-final-near-profile.json`: walked closer, **1 near / 11 medium**.
- `howe-final-restored-profile.json`: returned through the visible QA control to
  the exact saved sidewalk pose, **0 near / 12 medium**.

The first-arrival medium count differs because of selection hysteresis. It is
not used for the matched submission comparison. The reviewed
`howe-final-sidewalk.png` and `howe-final-near.png` preserve canopy coverage; full
selection activates on the close walk and leaves again on return. These local
screenshots and profiles are under `artifacts/local/`.

The restored profile matches the player/camera pose and 62° FOV in
`artifacts/local/cordova-final-sidewalk-native-profile.json`. The leaf material
rows, rather than total frame counters, show:

| Leaf submissions | Baseline | Restored candidate | Saved |
|---|---:|---:|---:|
| Beauty triangles | 1,298,815 | 652,816 | 645,999 |
| Shadow triangles | 1,462,019 | 816,020 | 645,999 |

Leaf calls remain **8 beauty / 10 shadow**. The measured reduction is
**1,291,998 submitted leaf triangles** across those passes: the full
727,601-triangle leaf mesh becomes the existing 81,602-triangle medium mesh.
Dynamic objects and other culling differ, so total-frame changes are not
attributed to this selector. This establishes submission savings, **not an FPS
gain** or an imperceptible transition at every viewpoint.

Validation: **22 focused tests pass**, covering projection/selection/hysteresis,
camera-only and parented-camera changes, slot sharing/restoration, culling and
independent shadow policy. The targeted TypeScript and diff checks pass. Narrow
FOV behavior is covered by tests; the final native evidence above is the ordinary
walking view, not a separate zoom or frame-time benchmark. No assets were
regenerated and no asset revision was bumped.
