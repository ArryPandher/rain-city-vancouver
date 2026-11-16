# Cordova close-leaf LOD trial

This candidate changes only full curved-leaf selection in `street-tree-lod.ts`.
At the ordinary 62° vertical FOV, it enters below 4m of the existing vertical
canopy distance and exits at 6m. A large projected crown no longer promotes the
full model. Narrow FOV extends both distances by its magnification relative to
62°; 35° gives approximately 7.6m/11.4m. Wider, absent or invalid projection values
retain the 4m/6m close range. Extreme zoom retains the previous 27m/34m hard caps.

The medium/detail-to-depth-canopy selection, tree budgets, visible-first sorting,
all mapped trees, original wood, source patches, transforms, materials and shadow
policy are unchanged. Medium leaves still retain every source patch. The model
revision/cache key is unchanged because no model or image asset changed. The
existing update cadence (3m movement, small view rotation, FOV or budget change)
also remains; the thresholds apply when that selector refreshes.

The historical large-crown promotion is documented in
[Harbour Green submissions](harbour-tree-submission.md). This trial supersedes
only its full-curvature selector, not its medium or distant geometry work.

The native reference `artifacts/local/cordova-final-sidewalk-native-profile.json`
recorded one full near crown and eleven medium crowns. That full leaf mesh
submitted 727,601 triangles in each of beauty and shadow, versus 81,602 for the
existing medium leaves. If the candidate selects that crown as medium at the
same pose, the expected reduction is **1,291,998 submitted triangles** across
those two passes. This is a geometry-submission prediction, not a measured FPS
gain or a guarantee that the transition is visually invisible.

Validation: 19 focused tests pass (projection/selection/hysteresis, independent
shadow policy, slot sharing/restoration and culling), as does the targeted
TypeScript check. No source-asset regeneration or full build was run. Native
acceptance must compare the same ordinary driving/walking view, inspect medium
leaf coverage and the close 4m/6m transition, then check a narrow-FOV view.
