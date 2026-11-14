# Prospect Point lighthouse and northern seawall

## Reference and placement

The original model follows the mapped footprint of **Prospect Point Lighthouse**, OSM way **1001586109**, rather than the previous generic building. [Destination Vancouver](https://www.destinationvancouver.com/things-to-do/listings/prospect-point-lighthouse) identifies the present square cement tower as the 1948 replacement and provides the close photograph used to study its proportions and details. The reference shows the flared base, tapered white body, broad red band, closed workroom door, external ladder/cage, projecting roof slab, rails, antennas and signal equipment. That photograph remains local and is not distributed.

The model is an original architectural interpretation, not a survey or a downloaded replica. The red beacon follows the OSM light metadata: a two-second isophase pattern and an 11.5 m focal elevation. Antenna/door/hardware dimensions and surface wear are estimated. The closed interior remains a solid collision footprint. Existing Poly Haven CC0 plaster maps provide concrete grain; no Destination Vancouver imagery is used as a game texture.

## Seawall and paving

The geographic layer contains OSM seawall ways **604043442** and **604043443**, about **3.23 km** along the western/northern coast, plus mapped railing **1227211750** near Prospect Point. It is not a complete detailed model of the entire park's seawall. The centreline layer is redistributed under ODbL with © OpenStreetMap contributors attribution. Reproduce with `node scripts/fetch-stanley-seawall.mjs` (`--cached` uses the retained Overpass response).

The original stone wall cross-section has a sloped lower face, coping and small cap recesses. Its height follows nearby mapped seawall paths. Where independently mapped wall and path lines nearly overlap, the rendered wall shifts outward by up to 3 m to preserve path clearance; this reconciliation and the wall heights are gameplay interpretations. The low wall and mapped railing have height-aware collision, while upper bridge movement remains separate. Walking and cycling centrelines share asphalt infill only where they run close and parallel. Tagged asphalt and paving-stone surfaces replace the old uniform concrete path material. Narrow gaps from the closest route to the wall are paved, with herringbone UVs aligned in world space across the separate meshes. The mapped shore steps (way 731791394) use a solid descending profile instead of a floating road ribbon; they remain scenic below the coastal edge, without a separate walkable stair system.

The terrain mesh is clipped to the existing mapped ocean polygons, with exact polygon differences only in shore-crossing cells. New boundary vertices interpolate height, normals and UVs from their original terrain triangle; the source heightfield, road grades and movement surface are unchanged. This removes raised grass covering the sea. The underlying map shoreline and old contour limitations still apply.

The lighthouse base also includes the rear circular recess visible in [Wikimedia Commons photographs](https://commons.wikimedia.org/wiki/Category:Prospect_Point_Lighthouse). Geometry tests guard the mapped footprint’s winding and keep the entrance treatment in front of the actual wall plane.

## Materials and limitations

**Japanese Stone Wall**, photography **Charlotte Baglioni**, processing **Dario Barresi**, tiling **Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/japanese_stone_wall), **CC0-1.0**. Color/OpenGL normal/roughness are converted to 2K WebP, mapped at the source's approximate 1.9 m scale, and darkened with a damp tidal band. This is generic granite masonry, not a photograph or scan of Vancouver's wall. Exact assets and changes: [source manifest](../../public/textures/seawall/SOURCES.json). Reproduce with `node scripts/fetch-seawall-material.mjs`.

**Herringbone Pavement**, **Charlotte Baglioni**, [Poly Haven](https://polyhaven.com/a/herringbone_pavement), **CC0-1.0**, supplies color/OpenGL normal/roughness for tagged paving-stone sections at a 2 m scale. It matches the photographed pattern class, not the exact local blocks. Six 2K WebP masonry/paving maps total about 8.60 MB.

Cliff overhangs, accurate tidal changes, all shoreline boulders, full structural wall profiles and current temporary closures are not simulated. These are scenic improvements to an independent browser game, not a current engineering reconstruction or a navigation aid.
