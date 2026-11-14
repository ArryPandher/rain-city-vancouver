# Stanley Park terrain

The rendered park and its movement surface use the City of Vancouver's [1-metre elevation contours](https://opendata.vancouver.ca/explore/dataset/elevation-contour-lines-1-metre-contours/). The City describes these as **approximate contours derived from 2002 orthophotography**. The contour interval is not an accuracy guarantee. These are older photogrammetric data, not the City's 2022 LiDAR.

Contains information licensed under the [Open Government Licence – Vancouver](https://opendata.vancouver.ca/pages/licence/). The terrain derivative also uses the existing OpenStreetMap park boundary, water outlines and road network; © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). The published combined geographic derivative is made available under ODbL with both source attributions retained.

## Reproduction

```sh
node scripts/prepare-stanley-terrain.mjs
# Rebuild from the task-local source export:
node scripts/prepare-stanley-terrain.mjs --cached
```

The source export is cached at `artifacts/local/stanley-terrain-contours.json`; it is not a runtime dependency. The exact export URL, source SHA-256 and output SHA-256 are embedded in `public/data/stanley-terrain.json`. The script fetched 397 contour records / 326,674 original vertices, resampled segments to at most 4 m and deduplicated at 0.1 m. Its Delaunay surface contains 255,005 vertices and 509,952 triangles.

A 4 m grid stores 833 × 729 unsigned little-endian 16-bit centimetre values (`stanley-height.u16`, 1,214,514 bytes). Centimetres are **storage precision**, not source accuracy. The local projection matches the game: origin 49.283, −123.12, x east and z south, longitude factor cos(49.2935°) × 111,320 and latitude factor 110,540. Runtime interpolation uses the same triangle diagonal as the rendered grid.

## Interpretation and limits

- Terrain reaches 76 m in the western park. Prospect Point's sampled viewpoint is around 54 m; the bridge's southern road connection is around 52 m.
- Lost Lagoon and Beaver Lake use median shoreline contour heights of 2 m and 10 m. Their beds are interpreted 0.45 m below those levels; no bathymetry is provided.
- The source surface receives a smooth 96 m transition outside the mapped park into the existing flat city. Downtown elevation is unchanged.
- Road samples are fitted to a 12% segment grade limit and blended across the carriageway and shoulders. The seawall uses an interpreted 2 m level. This makes old contours usable with the newer road layout. Grid interpolation and road-junction blending can locally exceed the fitting limit; the result is not an engineering road survey.
- The bridge's south deck meets the new terrain. Its center target is 61 m; the simplified profile, towers, cables and northern approach remain interpreted. Lower routes retain their elevation when crossing beneath the deck.
- 12,857 interpolation queries fall outside the contour convex hull and return zero, with no extrapolation outside the available contour coverage. Forest vegetation, buildings, road furniture, actors and vehicle orientation use the shared surface. Material boundaries are assigned on 4 m cells; small edge details, retaining walls, real cliffs and road cuts need further work.
- City 2013 DEM / 2022 LiDAR downloads were investigated. Direct requests returned Cloudflare 403 and the browser root redirected to a transfer-client login; neither dataset was downloaded or used. No survey-grade claim is made.

Code and algorithms remain MIT. See `THIRD_PARTY.md` for all other assets and `docs/PLAYTEST.md` for actual input and rendering verification.
