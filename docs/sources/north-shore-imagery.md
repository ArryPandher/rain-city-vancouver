# Retained North Shore satellite-derived colour

This first diagnostic has been superseded at runtime by the [licensed DNV2013 forward-slope orthophoto](north-shore-ortho.md). Its asset, provenance and reproduction remain preserved.

The earlier debug DEM used a bounded, georeferenced colour crop of **Copernicus Sentinel-2 scene S2A_10UDV_20240830_0_L2A**, captured **2024-08-30T19:30:53.893Z**. This is satellite-derived colour, **not measured diffuse albedo**: baked shadows, seasonal appearance and source display processing remain. No guessed panorama camera, artificial forest filling, newer EOX non-commercial imagery, or whole-scene download is used.

## Source, rights and reproducibility

[Earth Search / Element 84](https://earth-search.aws.element84.com/v1) supplied the public STAC record. The scene reports 0.002077% overall cloud cover; that statistic alone is not a patch-quality guarantee. The actual crop was visually inspected and shows clear forest, rock and water, unlike the rejected EOX2016 mosaic. The identified COG is available without an account through [AWS Open Data](https://registry.opendata.aws/sentinel-2-l2a-cogs/):

`https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/10/U/DV/2024/8/S2A_10UDV_20240830_0_L2A/TCI.tif`

The [Copernicus Sentinel Data legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice) allows lawful reproduction, distribution, public communication, adaptation and combination. It is an open-data legal grant, not a CC0/MIT claim. Attribution: **Contains modified Copernicus Sentinel data 2024. Sentinel-2 Cloud-Optimized GeoTIFFs via Element 84 / AWS Open Data.** Code licensing does not replace the imagery's source terms. Central THIRD_PARTY and UI credits retain this attribution.

The source's full object is 208,521,692 bytes. Extraction consumed only **3,735,552 bytes across 10 HTTP206 ranges**, using its **20 m overview**. The extractor refuses full-file/non-range responses and caps new downloads at20MiB. It reprojects the bounded EPSG:32610 window into a north-up geographic raster; exact URLs, byte ranges/hashes, source window, projection, original scene footprint and texture checksum are in `src/world/north-shore-imagery-data.json` and the public texture's `SOURCES.json`.

Reproduce from repository root:

```sh
npm install --prefix artifacts/local/north-shore-dem/tools --no-package-lock --no-save geotiff@3.0.5 proj4@2.23.0
node scripts/prepare-north-shore-imagery.mjs
node scripts/prepare-north-shore-imagery.mjs --verify
```

The bounded byte-range cache is under ignored `artifacts/local/north-shore-dem/sentinel-ranges/`. Regeneration from those cached ranges performed no new downloads and matched the derivative. GeoTIFF/projection libraries are preparation tools, not runtime dependencies.

## Registration and incomplete coverage

The **1280×815 WebP**, **164,874 bytes**, covers the geographic rectangle lon−123.32..−122.93/lat49.352..49.515. Its original scene footprint is diagonal; the rectangle is not a claim of complete coverage. Grouse and Fromme controls are covered, while Seymour is outside this scene at its latitude. The image's alpha channel records actual coverage with a **600 m transition** at source/crop edges and zero at no-data pixels. It does not invent pixels for missing eastern slopes.

UVs follow the exact reprojected bounds, with north at v1. The opaque terrain shader mixes satellite colour with existing neutral vertex colour using that coverage channel. Alpha does **not** cut holes in terrain, and RGB is not multiplied by a second green/rock tint. Outside the patch, clamped border alpha is zero, leaving the neutral material intact. On local image load failure the entire group keeps its neutral fallback. Terrain elevations, topology, collision, road support and the0.35 terrain-only haze are unchanged.

This imagery is requested only by the existing **`debug` plus `terrain=dem`** gate. Default production URLs still use the previous photographic horizon. The local image adds no remote runtime requests. Geometry remains **28 chunks /202,496 triangles**; UVs bring total GPU geometry to **5,819,576 bytes**, adding approximately 0.84 MB. The RGBA texture adds about5.6MB including mipmaps before driver-specific compression. Native appearance/frame-time review remains with the parent task.

## Verification

Eight focused DEM/source/imagery tests pass: exact texture hash/range provenance, image bounds and no-data alpha, geographic UV registration at all actual vertices, chunk seams, opaque confidence blending, local success/failure handling, default-photo/debug-only selection, standard physical lighting/fog compatibility, original terrain contact and source-road separation. Full TypeScript passed after using the actual TextureLoader callback type in the test fixture. No full build, browser or publication was performed for this candidate.

The earlier **EOX2016 CC BY4.0** extraction was rejected because actual pixels contained widespread clouds and hard mosaic seams, including the southern slopes. Its evidence and original tiles are retained only in ignored local artifacts. No rejected EOX imagery or non-commercial EOX source is shipped with this candidate.
