# Vancouver Convention Centre West — 2026-11-14

Original Rain City geometry replaces the generic procedural building at OSM way [85240507](https://www.openstreetmap.org/way/85240507). It uses the existing mapped outline and a local frame aligned with its north façade. The main roof, raised central/eastern roof planes, clerestory gaps, leaning glazing, timber soffits, foyer floors/core, wood blocks, seating, metal mullions, fascia, shoreline deck and rail are authored interpretations.

## References inspected

- [LMN Architects — Vancouver Convention Centre West](https://lmnarchitects.com/project/vancouver-convention-centre-west): design team, public waterfront integration, living roof and marine structure.
- [DA Architects + Planners — Vancouver Convention Centre West](https://www.da-architects.ca/projects/vancouver-convention-centre-west/): completed 2009 building, north and west façades, northeast elevation and roof photography. The roof and three exterior views guided the split sloping silhouette, large glass walls, substantial overhangs and timber soffits.
- [City of Vancouver — Form of Development, 1055 Canada Place](https://council.vancouver.ca/20061212/documents/a5.pdf): November 28, 2006 report, Appendix B plan and south/east/north/west elevations, drawing date October 25, 2006. The three complete drawing pages were rendered and visually inspected. These are simplified pre-completion plans, not an as-built survey. Low-resolution elevation labels are not treated as precise current height measurements.
- [PWL Partnership — Vancouver Convention Centre](https://www.pwlpartnership.com/projects/vancouver-convention-centre): six-acre living roof and sloping planted planes. Plant bed layout, blade density, tint and species in this game are interpretations, not an ecological reconstruction.

The architectural photographs and PDF are reference only and are not distributed with the game. No third-party mesh or Rockstar asset is included in this original building.

## Map, geometry and movement

The original ten-vertex roof outline is retained in the source map. Its two shallow northern notches are bridged in the authored lower shell, with separate raised roof planes above. Lower glass is inset approximately 3.8 m from the simplified roof perimeter, leaning outward toward the upper edge. The collision outline uses that same lower wall setback, opening the covered perimeter to walking. The central/eastern roofs peak at approximately 28/33 m in the game; all heights and roof subdivisions are interpreted from the references.

The outer promenade follows local controls from mapped Seawall cycleway `w116527975`, inner footway `w364263622` and outer footway `w618425761`. A narrow uniform roof offset was rejected because it crossed the actual footpath and cycleway. The authored deck shares a 0.04 m game ground level with collision, remains dry over the ocean mask and keeps the hall interior solid. Rail collision follows the visible outer north shore segments. The city's baseline downtown terrain does not reproduce the site's real elevation above tide; piles extend below the local water plane, and the marine habitat skirt is not reconstructed.

## Materials and rendering

Existing Poly Haven CC0 cast-concrete, grass/rock and painted-wood photography is reused. The painted-wood maps are tinted as an approximate timber grain; they are not a scan of the actual Douglas-fir interior. Roof beds combine photographic surface detail, broad authored meadow bands and scattered original grass blades. Geometry/code is MIT; existing source-map ODbL and material CC0 notices remain in the asset manifest and THIRD_PARTY.md.

Clear glass has separate north/east/west materials. Three static local scene probes capture the surrounding city and harbour when approached and refresh for weather changes; target glass and moving actors are excluded from each capture. These probes approximate local reflections rather than tracing the correct reflection ray at every point on the large façade. Transparent walls expose actual simplified foyer floors, a core and lounge groups. Interior night tint and emissive strips are artistic approximations, not a full lighting simulation.

## Verification and remaining limits

Focused tests cover finite/limited geometry, raised roof consistency, continuous dry perimeter clearance, solid hall/rail collision, visible deck raycasts, floors remaining below their covering roof, and more than 350 metre-spaced samples of mapped walking/cycling centrelines. Native play checks and inspected final views are recorded in `docs/PLAYTEST.md` after the final build.

The interior is scenery and is not open to the player. Building services, exact room layout, stairs/escalators, detailed glass hardware, shore habitat, western plaza/canopy/art and current events/signage remain approximate or absent. Roof access is not provided. Nearby buildings and city terrain are still simplified. This is an architectural improvement to an independent browser prototype; AAA fidelity remains unfinished.
