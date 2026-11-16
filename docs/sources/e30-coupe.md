# E30 coupe asset preparation

Prepared 2026-11-15 for a bounded playable vehicle trial. This document records
the asset, not native rendering or gameplay acceptance.

## Authorship, license and source chain

**[FREE] BMW M3 E30**, **Martin Trafas**:
[original model](https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422),
[current artist profile](https://sketchfab.com/TinoD2),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The original Sketchfab metadata and the embedded GLB metadata independently
agree on artist, unique model ID and license. The embedded older artist handle
is Bexxie; it is retained in the asset rather than silently rewritten.

The input is a redistribution by **pedrosoandre/carros**, commit
`2d18dfd9db96bbf0d9cffa949deaf7f571388cbf`,
[exact GLB](https://raw.githubusercontent.com/pedrosoandre/carros/2d18dfd9db96bbf0d9cffa949deaf7f571388cbf/assets/bmw-m3-e30.glb).
Its [model license record](https://github.com/pedrosoandre/carros/blob/2d18dfd9db96bbf0d9cffa949deaf7f571388cbf/LICENSE-3D-MODELS.md)
declares weld, simplify, prune and meshopt processing; its
[credit record](https://github.com/pedrosoandre/carros/blob/2d18dfd9db96bbf0d9cffa949deaf7f571388cbf/CREDITS.md)
identifies this same model and author. Those prior modifications are retained
in our attribution. This is not the original full-resolution artist export.
Only this model was audited; general claims or unrelated entries in that
repository do not establish rights for any other asset.

[License evidence](e30-coupe-license-evidence.json) preserves URLs, document
hashes, the matching credit row, prior-modification excerpt and original API
license fields. The prepared model remains CC BY 4.0, separate from Rain City's
MIT code. BMW and Brembo names/marks are part of the artist's vehicle depiction;
neither those companies nor the artist endorse this game.

## Texture-only preparation

`public/models/e30-coupe.glb` is prepared by
`node scripts/prepare-e30-coupe.mjs [path/to/audited/bmw-m3-e30.glb]`.
The default input remains unchanged at
`artifacts/local/vehicle-candidates/bmw-m3-e30.glb`. A fresh checkout can obtain
the exact public input URL above and pass its local path. The script performs
no network request and rejects any input whose SHA-256 differs from
`35cad98e89e6f1e54ccd238a3df049d29f20ecec3fc0aa2a85e0ad6c2663d330`.

Rain City changes only embedded images and GLB packing/attribution:

- Rim base color, rim normal and tire normal retain their original 1024×1024
  PNG bytes, preserving detailed wheel appearance.
- The other 15 maps become 512×512 PNGs. Color maps use gamma-aware Lanczos
  resizing; ORM data stays linear. Resized normal maps are filtered without
  gamma and their decoded vectors are renormalized before encoding.
- Every node, transform, material name, physical material parameter, UV,
  index and vertex attribute remains unchanged. The meshopt geometry payload
  is copied byte-for-byte and its relocated offsets are verified by decoding.
- Artist/source/license metadata is preserved, with explicit distributor and
  Rain City change notices added. No image, geometry or material is generated
  from an unlicensed reference, and no further mesh simplification occurs.

The prepared asset has **52,728 triangles, 30 meshes and 15 materials**. All
**119 decoded accessors** match the audited source. It requires
`EXT_meshopt_compression` and `KHR_mesh_quantization`; it also uses
`KHR_materials_clearcoat`, `KHR_materials_transmission` and
`KHR_materials_emissive_strength`. The existing installed meshopt decoder is
required at runtime. PNGs introduce no KTX2/WebP decoder or texture extension.

[Machine-readable preparation record](e30-coupe-preparation.json) contains
the resulting bytes/hash, source hash, preserved compressed-payload hash,
per-image hashes/resolutions/material uses, tools and validation results.

## Browser budget and remaining acceptance

Using one RGBA8 allocation with a complete mip chain per unique embedded
image, the input's 18×1024 maps would use approximately **96 MiB**. Three
1024 maps plus fifteen 512 maps use approximately **36 MiB**, a **62.5%**
reduction. The current `car-concept.glb` contains 14 images of mixed sizes,
approximately **38.27 MiB** by the same calculation; `car-traffic.glb` repeats
that image set. This comparison is a storage estimate, not measured runtime
VRAM or proof that different loaded models share GPU textures. It excludes
duplicate uploads, driver allocation, geometry, CPU copies and engine-created
textures.

The source front wheels are pre-steered, its transparent windows have no
separate named interior rig, and lamp lenses use transmission. Those integration
issues belong to the vehicle adapter/native comparison. Preparation does not
change steering pivots, light behavior, glass tint, car scale or game collision.
The remaining acceptance is ordinary close walking and chase driving, including
turns, rolling wheels, braking, grades and exit/reentry. This asset is not yet a
claim of AAA graphics or demonstrated performance improvement.
