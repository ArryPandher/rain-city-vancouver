# North Shore photographic ridge mask correction

2026-11-16. A bounded correction to the existing photographic horizon, pending
root's normal Ironworkers native review. This is **not geographic terrain
registration** and does not promote the DEM/urban diagnostic.

## Observed defect and retained limitations

`artifacts/local/bridge-route-crest-native.png` shows long straight ridge edges
and a stretched mountain backdrop. The current alpha comes from approximately
50 hand-authored points in `scripts/vancouver-photo-textures.py`; comparing it to
the original photograph reveals real peaks clipped away and opaque wedges of
photographed sky above valleys. For example, in a 1400 pixel-wide overview:

| Observed point | Previous alpha | Refined alpha | Source interpretation |
| --- | ---: | ---: | --- |
|817,45|0|255|Dark source-visible peak clipped by old chord|
|891,49|0|255|Source-visible peak clipped by old chord|
|1105,55|0|255|Snow/rock ridge clipped by old chord|
|780,50|255|0|Sky above the real valley, previously an opaque triangle|

The source is Selmo's **North shore pan.JPG**, original 13295×1593, dated 2007,
photographed from Canada Place and stitched from 11 images. It is licensed
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), with existing
[Commons attribution](https://commons.wikimedia.org/wiki/File:North_shore_pan.JPG)
retained in `public/textures/vancouver/SOURCES.json`. The new derivative is also
CC BY-SA 3.0. The one original was downloaded from the already documented URL,
5,919,628 bytes, SHA256
`3706fe1551a0d7e07aff6953e5b524daef59b153ff4a222a4003fb6e88b7611b`.
It is cached in `artifacts/local/north-shore-horizon-refinement/`.

The 8192×982 image remains on the existing 24000×1977 plane at [400,480,−7000].
That is about 45.5% horizontal aspect stretch, and the real camera is roughly 6 km
away from the photograph's viewpoint when driving Ironworkers. Neither defect is
solved here. Correcting the aspect alone would change apparent mountain heights
without geographic registration, so it is deliberately retained for this narrow
comparison. March snow, baked shadows/haze and photographic urban foreground
remain historical photographic content. No mountain dimensions are inferred from
this mask, and no measured DEM point or live terrain contact is changed.

The cached DEM native crest view has real perspective relief, but its southern
transition, incomplete orthophoto coverage and absent terrain-aligned lower city
remain separate issues. The existing urban diagnostic restores 44 source building
silhouettes at the game's zero datum, not their measured ground elevations.
Those components remain unchanged and diagnostic.

## Reproducible source-guided trace

Run `node scripts/refine-north-shore-ridge.mjs [local-original.JPG]`. It makes no
network requests and rejects any original with a different SHA. The controls in
`scripts/source-data/north-shore-ridge-controls.json` are manually inspected
image-space ridge bounds. A dynamic-programming path follows the local negative
luminance edge within ±5 overview pixels of that prior, limiting per-source-column
steps to 5 pixels. All 8192 resulting ridge rows, source metadata, explicit controls
and output SHA are in `north-shore-photo-ridge.json`.

Cloud intervals overview x 350–510 and 835–880 lack a crisp visible land/sky
boundary. Their envelope is explicitly approximate, with the image-edge cost
reduced so the path does not follow the bright cloud band's lower edge through
terrain. These are authored image controls, not surveyed skyline measurements.
A first wider-band edge-following candidate was rejected for that exact failure. No
synthetic mountain or colour detail is added.

The final RGBA uses the original photo RGB, resized/re-encoded once, with the
new ridge alpha. Previously transparent WebP RGB cannot simply be uncovered:
old decoded RGB at 817,45 is [227,229,228] whereas the original peak is [57,72,100].
The existing 22 overview-pixel bottom fade and 160 source-pixel side fade formulas
are retained; the helper retains the shader's extra lateral fade too. Image
resizing/encoding is not byte-identical to the old derivative: over shared fully
opaque pixels, RGB channel MAE is 1.501/max 26. This is a codec/resampling difference,
not an authored colour, contrast or lighting change.

`--verify` regenerates both image and trace record exactly against their saved
bytes. The new separately named asset is **871,196 bytes, 8192×982 RGBA**; the old
`north-shore.webp` is preserved. It replaces one image at integration, requiring
no extra texture pass, reflection capture or geometry draw. It should not be
loaded beside the old image for ordinary rendering.

## Root integration contract

The pure factory `createNorthShorePhotoHorizon(photoTexture)` in
`src/world/north-shore-photo-horizon.ts` returns the same two-triangle mesh and
MeshBasicMaterial configuration as the old World inline path. It reads no URL or
browser state and owns no loader. Root can replace only the **normal photo**
branch after reviewing this candidate:

```ts
const photo = new T.TextureLoader().load(
  `${BASE}${NORTH_SHORE_PHOTO_HORIZON.texture}`,
);
const horizon = createNorthShorePhotoHorizon(photo);
this.northShore = horizon.material;
this.root.add(horizon);
```

Keep the existing debug+terrain=dem branch intact. World retains its existing
weather tint reference through `this.northShore`. The factory changes no global
fog, light, exposure, terrain, collision, source buildings, source roads, image
projection, positions or UVs. No main/World/shared-loader edits were made in this
scoped candidate.

## Checks and next acceptance

Three focused tests pass: exact prior plane positions/normals/UVs/indices and
render state, expected attribution/asset hash/resolution and continuous bounded
ridge rows, the four independently inspected source pixels, and unchanged
bottom/side opacity envelope. `node scripts/refine-north-shore-ridge.mjs --verify`
passes. Source comparison artifact (rows original/old/refined):
`artifacts/local/north-shore-horizon-refinement/source-old-refined-comparison.png`.

Root should compare the same ordinary Ironworkers crest and northbound approach
with unchanged camera/light. Confirm the snowy ridge is no longer chopped into
long straight chords, the valley sky wedge is gone, and cloud-boundary transitions
do not introduce visible notches/halos. Check Canada Place to ensure the same
source edge improvement does not introduce a new backdrop seam. This does not
establish correct Ironworkers mountain parallax, geographic scale or all-season
realism; those remain a future coherent terrain/skyline decision.
