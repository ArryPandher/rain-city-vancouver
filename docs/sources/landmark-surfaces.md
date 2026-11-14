# Vancouver landmark surfaces — 2026-11-14

The 12 existing Codriver landmark models retain their geometry and placement. This pass replaces the generic pavement/brick material treatment with photographic material families, site-specific tint/roughness and metric texture projection. Codriver's CC BY 4.0 credits remain in the landmark catalog; original runtime material/UV/shader code is MIT.

## Reference and interpretation

- [RJC Engineers — The Station](https://www.rjc.ca/project-details/the-station.html) identifies Waterfront Station's brick and ornamental terracotta. Its restoration photographs guided the red brick/pale trim contrast. [Vancouver Heritage Foundation](https://www.heritagesitefinder.ca/location/601-w-cordova-st-vancouver-bc) documents the ten free-standing Ionic columns. The existing geometry remains approximate.
- [Parks Canada — Former Vancouver Law Courts](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?id=85) distinguishes the gallery's rusticated Nelson Island granite base, smoother Haddington Island upper stone and copper dome. This pass supplies different surface relief, not new carving geometry or a stone scan.
- [Fairmont — Hotel Vancouver exterior details](https://www.fairmontmoments.com/guest-stories/gargoyles-and-details-at-hotel-vancouver) documents the carved Haddington Island stone. [BC MINFILE](https://minfile.gov.bc.ca/Summary.aspx?minfilno=092L++146) also identifies the quarry's use at the hotel. Material colour/age and block dimensions are interpreted; roof detail uses an authored patina approximation.
- [Vancouver Heritage Foundation — Marine Building](https://www.heritagesitefinder.ca/location/355-385-burrard-st-vancouver-bc/) describes brick curtain walls and terra cotta trim. Green ornament is treated as ceramic rather than polished metal.
- [Safdie Architects — Vancouver Library Square](https://www.safdiearchitects.com/projects/vancouver-library-square) identifies sandstone-coloured precast concrete. Its concrete receives restrained fine detail and larger panel joints rather than brick or polished stone.
- [DA Architects — Canada Place/Pan Pacific](https://www.da-architects.ca/projects/canada-place-pan-pacific-hotel/) supplies architectural photographs, including the panelled pale exterior. These are historical design references; no current detailed survey is claimed.

These reference photographs are not distributed. No Rockstar media is included. Material maps are separately licensed CC0 photographs, documented in [SOURCES.json](../../public/textures/landmarks/SOURCES.json) and the [asset manifest](../../public/asset-manifest.json).

## Material preparation

`node scripts/prepare-landmark-surfaces.mjs` downloads source diffuse, OpenGL normal and roughness maps, verifies their source MD5 values and writes nine WebP files:

- **Red Brick**, Rob Tuytel / Poly Haven: 2K maps, used at the published 1.4 × 1.4 metre scale, with separately authored station/Marine Building tints.
- **Granite Tile**, Charlotte Baglioni / Poly Haven: a 448 × 448 crop inside one face of the 2K source excludes paving joints. The face is mirrored into a repeating texture; horizontal/vertical normal components are inverted on mirrored copies. Colour is neutralized so the model's material palette controls the final tint. This generic mineral detail is not a scan of Haddington Island stone, terracotta or any Vancouver building.
- **Green Metal Rust**, Rob Tuytel / Poly Haven: neutralized surface variation and 1K normal/roughness maps provide an authored aged-copper approximation. The source is weathered painted metal, not a copper scan. High roughness and low metallic response represent patina approximately.

Projection uses an orthonormal tangent plane, preserving metre scale on rotated and pitched faces. It keeps brick courses horizontal and removes the previous dominant-axis compression. Newly assigned texture maps use the matching tangent normal-map convention. Smooth curved ornament can still distort the projected pattern.

Stone and panel joints are authored in metres, with 2–8 mm relief and 4–8 mm joint width. An antialiased shader adds small per-block colour variation and normal relief; joints fade on horizontal/sloping ornament faces and below pixel size. Library and Canada Place panels use aligned seams; masonry uses staggered courses. They do not alter silhouette, walking height or collision. Course/panel dimensions are interpretations, not measured site records. Normal strength and tint remain artist choices.

## Limits and validation

The geometry, collision footprints, entrances and surrounding buildings are unchanged. Blank/approximate window interiors, simplified carvings, repeated procedural surrounding façades, building-scale lighting and city reflection fidelity still limit realism. This is a material improvement to a browser prototype, below AAA fidelity.

Tests verify metre density on rotated/pitched planes, unchanged vertex positions, separate ceramic/copper responses, source-material preservation, map reuse, finite normal maps and repeating mineral-image edges. Actual daylight/night gameplay and surface captures are recorded in the playtest log; successful shader compilation alone is not a visual-quality claim.
