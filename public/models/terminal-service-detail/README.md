# Roller shutter source component — not installed

Selective export from [Modular Factory Facade](https://polyhaven.com/a/modular_factory_facade), by James Ray Cock / Poly Haven. **CC0-1.0**, free for commercial use, modification and public redistribution. See [provider terms](https://polyhaven.com/license), [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode) and `SOURCES.json` for the exact source files and hashes.

This is an asset donor, not a measured Canada Place model. No application loader references this file. The retained MCM Handford01 reference shows grey horizontal rolling shutters on the dock frontage, so the component type is supported. It does not establish an exact bay location, door schedule, measured size or the factory kit's heavier weathering. Do not fill every opening with this closed shutter or claim it is scanned Vancouver architecture.

## Selection and resource cost

- Original node `door_garage_centered_01`, only its `modular_factory_facade_garage` primitive. Its separate decorative header and all brick/other kit geometry are excluded.
- 342 triangles, 514 vertices, one material, three embedded 1024×1024 JPEGs: base color, OpenGL normal and packed occlusion/roughness/metallic source image. The source material uses the packed map as metallic/roughness; no ambient-occlusion map is bound.
- GLB 2,043,100 bytes. Texture image bytes: 588,149 + 752,068 + 682,331 = 2,022,548. Conservative decoded GPU texture budget: 12 MiB RGBA8 base level, about **16 MiB with mipmaps**; these are not compressed GPU textures. Sharing instances should reuse these three textures/material.
- Approximate physical bounds 3.10 m wide × 2.64 m high × 0.50 m deep. Authored dimensions are generic; no nonuniform scaling or Vancouver placement was baked.
- Original POSITION/NORMAL/TEXCOORD_0/index arrays and JPEGs preserved. Library-layout translation discarded, replaced by `[3,0,0]` to centre X approximately at zero. Y remains the foot at zero; front near local Z=0; unit scale/identity rotation.
- Mesh is a double-sided source assembly with side tracks and upper/lower return lips. It is not a watertight building or a navigable-interior model. Any future installation must retain verified opaque terminal closure and exact public clearance.

The PBR atlas adds correlated seam, fastener, grime, normal and roughness detail absent from the current uniform procedural shutter. This is source-material fidelity, not evidence that terminal maintenance/weathering is identical. Native improvement has not been tested.

## Verification and reproducibility

Download the 1K glTF manifest from `https://api.polyhaven.com/files/modular_factory_facade`; require the sizes/MD5 values recorded in `SOURCES.json` before reading. The complete library was 17,626,179 bytes; this output retains only five required source files' relevant resources. With glTF Transform 4.5.1, select the named node and garage primitive, remove other nodes/primitives, set translation as above, run `prune()` and write GLB. Re-read the GLB and compare all geometry attribute/index hashes and embedded source-image hashes. Local extraction and CPU visual-audit scripts/results are retained under `artifacts/local/facade-asset-research/`; the preview is an audit raster, not a game screenshot.

No runtime, collision, terminal geometry or material installation is included.
