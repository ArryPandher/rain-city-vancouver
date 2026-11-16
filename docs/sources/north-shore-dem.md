# North Shore measured terrain prototype

2026-11-16. **Visual diagnostic candidate only; no gameplay support or collision change.** `World.mountains()` enables this candidate only when the URL contains both `debug` and `terrain=dem`. Default URLs still render the existing `north-shore.webp` plane unchanged. The diagnostic omits that plane from the scene, retaining its resource for comparison. This prototype supplies a real perspective ridgeline rather than stretching or warping that photograph.

## Source and processing

Public [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) Terrarium PNGs, zoom 11, x **322–325**, y **698–700** (12 tiles), fetched from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`. The exact URLs and SHA256 checksums are recorded in `src/world/north-shore-dem-data.json`. The original tiles and downloaded attribution document are cached at `artifacts/local/north-shore-dem/`.

[Tilezen/Joerd attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) identifies Canadian Digital Elevation Model coverage under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Attribution for this derivative: **Mapzen Terrain Tiles. Contains information licensed under the Open Government Licence – Canada. Global fallback terrain courtesy of the U.S. Geological Survey.** Tile-level source lineage is not supplied in these RGB tiles, so the global fallback credit is retained. No endorsement or survey accuracy is implied. No paid satellite imagery is used. The optional diagnostic colour derivative is [credited separately](north-shore-imagery.md).

Reproduce with `node scripts/extract-north-shore-dem.mjs`. Verify the committed derivative against every cached original tile with `node scripts/extract-north-shore-dem.mjs --verify`; this passed. Terrarium decoding is `R*256 + G + B/256 - 32768`. Coordinates sample pixel centres with bilinear interpolation across tile boundaries. The output is a regular **449×227** geographic grid (about **79 m east-west, 80 m north-south**), quantized to **0.25 m**. It stores measured values without vertical exaggeration, smoothing noise, or invented peaks. Row zero is north. Runtime projection uses the game's existing `geo` origin and scale.

The 452,071-byte JSON contains 101,923 measurements. Raw heights range **−5 to 1,755.75 m**. Negative coastal samples are preserved, not raised into invented land. Source tiles have approximately 50 m ground pixels here; the prototype's grid is a bounded resampling rather than survey-grade reconstruction. A 160 m trial lost about 72 m at a narrow Seymour control ridge, so it was rejected. At the accepted 80 m grid the corresponding difference is about 19.5 m.

Inspection controls (named nearby features, not claimed surveyed summit coordinates):

| Nearby feature | Latitude, longitude | Original tile sample | Resampled grid |
| --- | --- | ---: | ---: |
| Grouse Mountain | 49.3796, −123.0817 | 1,107.49 m | 1,106.10 m |
| Mount Fromme | 49.3802, −123.0575 | 1,129.38 m | 1,129.43 m |
| Mount Seymour | 49.3933, −122.9445 | 1,424.43 m | 1,404.95 m |
| Lynn Valley | 49.3790, −123.0180 | 731.34 m | 731.90 m |

## Boundary and playable-area separation

Longitude **−123.32 to −122.83**, latitude **49.352 to 49.515**. All loaded source roads stop at or south of 49.34660865 (world z −7031.3), buildings at 49.33443206 and areas at 49.33651637. The candidate starts at world z **−7627.26**, approximately **596 m beyond the northernmost source road vertex**. Source roads, buildings and areas are not moved, flattened, draped or covered by this prototype.

A smooth **1,200 m southern boundary transition**, entirely outside those playable source footprints, joins the visual mesh to the existing zero-height ground. The west/east/north perimeter transitions over 640 m for a finite mesh without exposed cut walls. These boundary strips are deliberately modified elevations, not claimed measured ground. Interior elevations are unchanged. The derivative is strictly visual: do not use it for player, pedestrian or vehicle support. A future navigable North Shore terrain project would require separate road/building registration.

## Geometry, appearance and integration contract

`createNorthShoreDemGroup()` returns 28 positioned mesh chunks, sharing one rough, neutral vegetation/rock material. Colour depends on slope and elevation; it is a broad land-cover approximation, not a classified vegetation survey. No forest scatter or synthetic elevation noise is added. Normals are computed on the complete grid before splitting, so adjacent chunks share exact heights, normals and colours. Triangles face upward. Each chunk uses a local origin for stable positions, bounding volumes and normal Three.js frustum culling. It casts no shadows.

**202,496 triangles; 4,982,376 bytes of GPU geometry; 28 maximum material draws before frustum culling.** The data is bundled locally; there is no runtime remote elevation download. The current diagnostic also supports [georeferenced satellite-derived colour](north-shore-imagery.md), with neutral fallback outside source coverage. The direct group is suitable for `scene/root.add`, not the city's 2.9 km static-distance culler. The only world hook is the explicit diagnostic gate inside `World.mountains`; it adds the group directly to the root and returns before photo creation. The previous photo asset is preserved.

The DEM material uses an **experimental terrain-only fog-depth scale of 0.35**, inserted into Three.js’s standard fog fragment chunk. With `FogExp2` this equals multiplying the current scene density by 0.35 (daytime effective density 0.0000525). The standard lighting, fog colour and dynamically updated weather uniforms remain intact; global fog is not modified. This is an appearance choice for comparison, not an atmospheric measurement. Unscaled daylight density 0.00015 would remove approximately 90% contrast at 10 km and over 99.9% at 20 km. Camera far distance, old-photo overlap and night/rain appearance likewise belong to integration review. Do not report this candidate as a proven native improvement before that review.

## Verification and handoff

`npx tsx --test tests/north-shore-dem.test.ts tests/north-shore-dem-integration.test.ts`: **5 passed**. The added owning-method regression verifies the default photo and both required URL flags, direct-root attachment, no overlapping photo, and the installed Three.js standard shader fog hook without shared uniform or lighting changes. The checks cover exact metadata/control elevations, unmodified interior heights, all 202,496 upward-facing triangles, shared chunk seams, zero-height perimeter contact, front-sided rays at four real source controls, separation from actual source road/building/area vertices, and the bounded geometry budget. `node scripts/extract-north-shore-dem.mjs --verify` also passed against all 12 cached original PNGs. `npx tsc --noEmit --pretty false` passed for the integrated diagnostic candidate after narrowing the shader test fixture through `unknown`; no runtime change was needed for that fixture correction.

Read-only measured-height preview: `artifacts/local/north-shore-dem/measured-height-preview.png` (north up, relief colouring; not a native screenshot). Proposed ordinary camera comparison: Ironworkers crest `[6797.68,37.91,−1704.90]`, northward heading around −3.1188, then west/east glances from the existing paths. The parent task owns build/native comparison and acceptance; no browser, build, full suite or publication was performed here. The later satellite-colour integration adds UVs and its own bounded texture; current costs and coverage are recorded in [the imagery source note](north-shore-imagery.md).
