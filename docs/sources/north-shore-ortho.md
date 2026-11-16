# Diagnostic North Shore forward-slope orthophoto colour

2026-11-16. The optional `?debug&terrain=dem` material now uses one licensed
**District of North Vancouver2013** orthophoto crop. It supplies forest, rock and
ski-run colour across Grouse, Fromme, Lynn Valley and Seymour, replacing the earlier
Copernicus crop's large neutral eastern gap. The DEM, normals,28 mesh chunks,
experimental0.35 fog-depth scale, scene lighting/weather and default panorama
are unchanged. Native visual acceptance is still the parent's next step.

## Exact source and rights

The [DNV open-data catalogue](https://geoweb.dnv.org/data/) explicitly lists
**Orthoimagery(2013)** under the Open Government Licence - North Vancouver. Its
[dataset metadata](https://geoweb.dnv.org/data/metadata.php?dataset=ImgOrthoimagery2013)
identifies District ownership and McElhanney's2013 developed/alpine photography.
The catalogue gives10cm capture resolution, urban capture May3 and alpine capture
June15. The OGL grants copying, modification, publication, distribution and
commercial exploitation with attribution; no endorsement is implied.

**Contains information licensed under the Open Government Licence - North Vancouver.**

The exact data service is
`https://geoweb.dnv.org/arcgis/rest/services/Basemap_Ortho2013/MapServer`.
The service's map export returned blank pixels, so the derivative uses its actual
published image-cache tiles at level1:
`/tile/1/{row}/{column}`, rows2..4, columns5..12. Published cache origin is
[474584,5480125], NAD83 UTM10N/EPSG26910, resolution10.583354500042335m per pixel.
These24 tiles total **741,754 bytes**. Every exact URL, hash and byte count is in
`src/world/north-shore-ortho-data.json` and `public/textures/north-shore-dem/DNV-SOURCES.json`.
No map labels or municipal boundary graphics are present in the inspected tiles.

The DNV2024 service was also inspected and has a clear image, but its individual
licence field is empty and that year is not explicitly listed in the open-data
catalogue. Its pixels are not used in this asset. The older Copernicus asset and
its provenance remain preserved separately, rather than silently relabeling it.

## Crop and observed quality

Output is **2048×504**, lon−123.128..−122.876,lat49.352..49.414, reprojected from
NAD83 UTM10N to north-up geographic pixel centres. The effective source is the
10.58m cache level; output spacing is roughly8.9m east-west/13.6m north-south.
This is not a10cm game texture, nor additional terrain geometry. The complete
crop was inspected at native resolution: forest canopy texture, clear ski runs,
exposed rock, real June2013 summit snow and baked shadows are visible. It is
cloud-free in this crop. No invented snow, paint-over, brightness lift or
speculative terrain noise is added. Seasonal snow is historical photography,
not a simulation of the current HUD date/weather.

RGB comes from the actual image with bilinear geographic resampling. A conservative
exterior mask removes only near-white pixels connected to the raster border,
where the cache has missing rectangular coverage. Enclosed photographed snow
remains. Source/crop exterior boundaries fade to the existing neutral terrain
within300m. The terrain remains opaque; image alpha is coverage, not water/sky
transparency. All four named controls, including formerly missing Lynn Valley
and Seymour, are fully covered. Terrain farther north/west/east remains neutral;
this bounded forward-slope source does not claim full North Shore coverage.

The **643,400-byte WebP** has SHA256
`737206b9ae0945c5f5914601d3a9e7b52abb58933efb02c8d02f2da50f56ca5e`.
Texture storage is about5.5MB including a full RGBA mip chain. Geometry stays
202,496triangles/28chunks and5,819,576bytes including UVs. One image replaces
one image; there are no additional material draws or runtime external requests.

## Orientation and shader audit

The current Three.js TextureLoader creates a normal HTML-image texture with
`flipY=true`, sets its image and marks it for upload before invoking onLoad.
WebGLTextures passes that flag to `UNPACK_FLIP_Y_WEBGL`: the top source row
therefore corresponds to terrain north atv1. Texture's own `transformUv`
corroborates north(0,1)→image(0,0). The material keeps sRGB interpretation,
`premultiplyAlpha=false`, default identity UV matrix and clamp-to-edge sampling.

Installed Three meshphysical shader includes map_fragment before color_fragment.
The diagnostic hook samples the map there, removes the ordinary diffuse map
multiply, then mixes source RGB and neutral vertex RGB by coverage alpha exactly
once. Diffuse alpha remains1. No double vertex-colour multiplication or V reversal
was found. Native23 confirmed the older Copernicus map actually loaded; the change
addresses its coverage/resolution/source contrast rather than inventing a UV fix.
The new ready profile should name DNV2013 and show2048×504/sRGB/28meshes.

## Reproduction and checks

With `proj4@2.23.0` in the existing ignored preparation-tools directory:

```sh
node scripts/prepare-north-shore-ortho.mjs
node scripts/prepare-north-shore-ortho.mjs --verify
npx tsx --test tests/bounded-fetch.test.ts tests/north-shore-imagery.test.ts tests/north-shore-dem-integration.test.ts
```

The extractor uses a1MiB per-tile and20MiB complete-source budget, checking HTTP
status, Content-Type and Content-Length before body reading, plus accumulated
stream bytes before retaining chunks. Writes occur only after validation. Cached
source bytes also count toward the complete-source limit. It never calls a bulk
item-data endpoint. Local fixtures cover a tiny allowed JSON body, declared
oversize rejection before body reading, non-JSON bulk type rejection, and a
chunked response crossing the shared total limit. Regeneration from cached24tiles
matched with zero new network bytes. Eight focused tests and full TypeScript pass.

During preceding research an ArcGIS MetroVancouver item `/data?f=pjson` unexpectedly
served bulk ZIP instead of metadata. A25s curl timeout left758,211,316bytes of an
incomplete response. It was deleted immediately when detected, no contents were
used, and the endpoint was excluded. The new bounded helper/fixtures prevent that
failure class. The deletion was verified; available disk afterwards was7.5GiB,
without a prior free-space sample for an exact delta. This incident is separate
from the bounded741,754-byte DNV2013 source used here.
