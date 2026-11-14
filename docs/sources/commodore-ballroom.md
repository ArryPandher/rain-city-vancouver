# Commodore Ballroom — Granville Street

Original reference-guided architecture, November 14, 2026. The model replaces OSM `w301876706` at the actual Granville frontage, preserving its slight mapped angle. The committed OSM-derived footprint remains the collision boundary. The architecture is an interpretation, not a measured survey.

## Architectural references

- [Vancouver Heritage Foundation — Places That Matter](https://placesthatmatter.ca/location/commodore-ballroom/) documents the 1930 opening, H. H. Gillingham's Art Deco/Mission Revival façade, the second-floor ballroom and restoration of the exterior tilework.
- [Vancouver Heritage Site Finder — 868 Granville Street](https://www.heritagesitefinder.ca/location/868-granville-st-vancouver-bc) identifies the decorative tilework, parapet and Art Deco character.
- [Vancouver — Commodore Building pano 01.jpg](https://commons.wikimedia.org/wiki/File:Vancouver_-_Commodore_Building_pano_01.jpg), **Joe Mabel**, photographed September 3, 2010, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The panorama supplies façade proportions, window placement, patterned masonry and ornament. Perspective and cylindrical panorama distortion limit precision. The game uses eighteen individually recessed arched windows, stone piers/coping, a stepped central crown, ornamental bands and curved entrance canopies.
- [The fabulous commodore ballroom neon (3683353819).jpg](https://commons.wikimedia.org/wiki/File:The_fabulous_commodore_ballroom_neon_(3683353819).jpg), **Ben Aston**, photographed July 2, 2009, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). The photographed tube lettering and mounts provide the small entrance sign, including separate emission control.

## Distributed image derivatives

`public/textures/commodore/` contains ten WebP assets (~0.6 MB): two masonry colour/normal/roughness sets, a cropped tile frieze, a rosette, and neon colour/emission maps. Masonry crops are mirrored for seamless repetition; normals and roughness are estimated from image contrast, not measured surface data. No whole street photograph, pedestrians or source-photo business advertisements are distributed.

Joe Mabel photo derivatives retain **CC BY-SA 3.0**; Ben Aston sign derivatives retain **CC BY 2.0**. They are not covered by the code's MIT license. Exact files, source URLs, authors, licenses and changes are in [SOURCES.json](../../public/textures/commodore/SOURCES.json). Reproduce with `node scripts/fetch-commodore-materials.mjs`.

Existing CC0 plaster maps provide generic pale trim, and existing licensed shop panoramas provide fictional retail interiors. New shop labels are generic rather than a claim about the current tenants. The ballroom, bowling lanes and shops are not enterable. The sign and canopy light react to night mode; nearby door/window depth and canopy geometry provide close-range detail. Upper windows have physical glass materials and modeled arch bricks/muntins, rather than a flat photograph of a window.

## Approximation limits

Height is inferred from the photographed proportions scaled to the mapped frontage. The parapet, canopies, doors and decorative details are simplified. The 2010 panorama is historical reference; the model does not claim to depict a later redevelopment, current tenancy, exact tile placement or a photogrammetric reconstruction. Wider Vancouver terrain, interiors and AAA production fidelity remain ongoing work.
