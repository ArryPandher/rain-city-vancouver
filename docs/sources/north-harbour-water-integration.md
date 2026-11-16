# Clean public integration recipe

Public base: `c0302e13dfbb08141b53ca8572b0cb1c86a5dfc7` (`c0302e1`). The package also applies after Gallery-only updates because World/main are unchanged there.

Clean production-only commit: **`66e7e7888e4f16beb35c2f2e807c59cc0d0b820c`**, retained on local branch `integration/north-harbour-water-c030`. Apply it on the public branch with:

```sh
git cherry-pick 66e7e7888e4f16beb35c2f2e807c59cc0d0b820c
```

This commit is independently parented on c0302e1. It adds four accepted Three-only water modules, the small lifecycle owner, portable tests and minimal World/main hooks. It does **not** carry development-branch static cube, HDR-water, half-fill, railway terrain or other unrelated changes. The clean package keeps a debug-only normal-water baseline toggle; richer individual experiment controls remain on the development branch.

Validation used an isolated c0302e1 source snapshot with the exact patch: full TypeScript passed and13focused lifecycle/distortion tests passed. The first snapshot initially omitted an existing docs JSON needed by a baseline test import; including the original base docs fixed the snapshot-only omission, without changing runtime or tests. No Vite build or browser was run. The patch and read-back metadata/logs are in `artifacts/local/north-harbour-production-package/`.

For the development preview, use the ordinary scoped lifecycle commit instead; do not also cherry-pick the clean package onto that branch, because its accepted helper files already exist there. The clean package is the route for public main. Native entry/exit, day/quality teardown and the new125ms moving-capture cadence must be reviewed before publishing. See [normal lifecycle and limits](north-harbour-water.md).
