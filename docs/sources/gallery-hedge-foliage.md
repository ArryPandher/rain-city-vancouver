# Gallery west terrace clipped hedge surface

## Observed deficiency and bounded interpretation

The accepted Hooper close native view `artifacts/local/gallery-hooper-close-native.png` shows an untextured green box above the west terrace fascia, beneath the five columnar crowns. The [official Gallery 2023 exterior photograph](https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg), cached in `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg`, shows a dense continuous low planted edge there. Crop `gallery-west-planting-reference.png` supports this overall trimmed mass; it does not identify the hedge species or establish exact individual leaf dimensions.

This change addresses that existing hedge only. It keeps the previous envelope and planter datum. No extra shrubs, taller planting, bistro change, conifer change, architecture, stairs, road, navigation or contact volumes are introduced. The projected irregular leaf contours replace the exposed flat shell; the opaque core is recessed inside it, retaining a dense mass through gaps and at distance. The appearance is an authored generic clipped broadleaf interpretation, not a botanical survey or reconstruction of measured branches.

## Retained licensed assets

Seven individual leaves from Rico Cilliers' [Poly Haven Shrub04](https://polyhaven.com/a/shrub_04), CC0, already retained in `public/models/forest/shrub_04.glb`, supply color/alpha and tangent-space normal maps. `scripts/prepare-gallery-hedge.mjs` extracts the embedded1024px WebP maps byte-for-byte into `public/textures/gallery-hedge/`; no image processing, network download or new texture pack. Total map files approximately106KB. Source hashes/credits are in that folder's SOURCES.json. They are not the Gallery source photograph, a whole-tree atlas or fir-needle sprays.

Leaf crops are the seven existing coastal-plant preparation regions. Each has real transparent contour pixels. Folded six-vertex surfaces vary orientation, physical depth and bounded placement; 14.5–19cm lengths and7.5–10.5cm widths are an explicit broadleaf presentation estimate at this elevated viewing distance, not a species claim. Their complete vertices are shifted inward at envelope corners rather than clamped flat. Neutral0.84–1.0 per-leaf brightness variation preserves source color and prevents identical highlights; there are no random luminous leaves.

## Geometry, loading and budget

- Existing source hedge AABB in terrace assembly frame: x−27.780001..−9.420000, z27.054115..28.095884, y3.789517..4.250602m. Every new leaf/core vertex remains inside it within Float32 tolerance. Source geometry is not mutated.
- Core retains original topology but retracts0.06m at either length end,0.08m at either side and0.11m at the top. The bottom datum is unchanged.
- 4,295 folded leaves / **17,180 added triangles / one merged material draw**. No per-leaf objects, callbacks or per-frame allocations. Only top, sides and end faces receive leaves; no hidden underside foliage.
- Existing material cache supplies independent map wrappers; colorSpace/flipY/clamp settings are local, wrappers dispose once without disposing another consumer. The atlas uses glTF flipY=false, normal Y convention consistent with existing Gallery foliage, and its UVs opt out of global landmark surface projection.
- Opaque cutout with mipmapped textures and the renderer's existing MSAA alpha-to-coverage; no blended sorting layer. No new hard distance switch or LOD pop. The compact static batch uses existing landmark visibility/caster culling; unresolved leaves can reduce to the recessed core rather than losing the hedge mass. This is a deliberate bounded geometry cost, not a frame-rate optimization claim.
- Complete Gallery details now **52,370 triangles /12 draws with the runtime texture library**, or11 draws in the no-library fallback. Previous accepted Hooper runtime was35,190 /11; the earlier fallback was35,190 /10.

Focused checks cover source byte identity, actual crop alpha coverage, complete folded leaves inside the old envelope, deterministic generation, source/core topology preservation, sampler/disposal independence, the real facade atlas-UV path, and retained actual-city terrace/stair/body/camera clearance. Native same-view acceptance remains required: leaf contours should replace the solid green vertical band without an obvious sheet of large leaves, holes through the hedge, shimmer or changed crown silhouettes.
