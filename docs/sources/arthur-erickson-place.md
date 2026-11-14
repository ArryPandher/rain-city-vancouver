# Arthur Erickson Place

Original game geometry for the MacMillan Bloedel Building at 1075 West Georgia Street, matched to OSM building `w143683975`. The generic glass extrusion is replaced by two offset concrete office masses, 27 window rows, deep square recesses on the long faces, and narrow glazing slots on the ends. Cast walls taper with height. The long faces use single panes without added mullions.

References reviewed:

- [Arthur Erickson project archive](https://arthurerickson.com/commercial-buildings/arthur-erickson-place/6): building organization, load-bearing cast concrete, taper and surface treatment. Exterior photographs by Geoffrey Erickson and Ezra Stoller/ESTO on pages 1, 2, 3 and 5 were inspected for proportions and façade treatment.
- [Vancouver Heritage Foundation](https://www.heritagesitefinder.ca/location/1075-w-georgia-st-vancouver-bc): two offset 27-storey towers, recessed mullion-free glazing, and wall thickness tapering from eight feet to eight inches.
- [MacMillan Bloedel Building](https://en.wikipedia.org/wiki/MacMillan_Bloedel_Building): seven-foot-square windows.
- [Vancouver building-height list](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Vancouver): 103.6 m height used for the model, rather than deriving a height from the extract's generic 32-level value.

This is a reference-guided approximation, not a survey or architectural model. The massing, offsets, floor spacing, window counts across each face, lower plinth, reflecting basin and small footbridges are estimated within the mapped footprint. The model does not reproduce the interior or every entrance, landscape or roof detail. Reference photographs are not distributed or used as game textures.

The surface is the separate CC0 **Concrete Wall 009** material by **Charlotte Baglioni**, from [Poly Haven](https://polyhaven.com/a/concrete_wall_009), with diffuse, normal and roughness photography. It is generic cast concrete, not a scan of this building. [Texture source record](../../public/textures/cast-concrete/SOURCES.json).

The basin uses a small 128-pixel scene cubemap to reflect the actual surrounding game geometry. It is prepared during loading and refreshed after a weather change when the viewer is nearby. This is an approximate static reflection, not ray tracing or an exact planar mirror; moving actors are omitted. Performance graphics retains the sky-environment fallback. Scene visibility, shadow flags, lighting position and renderer target are restored after each capture, including failure.
