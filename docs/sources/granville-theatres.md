# Vogue Theatre and Orpheum — Granville Street

Original reference-guided geometry, November 14, 2026. Footprints are from the committed OSM-derived map (ODbL); sizes and decorative details are interpretations, not surveys.

- **Vogue Theatre**, 918 Granville Street, OSM `w97160604`: broad Art Deco façade, vertical piers, carved panels, maroon entrance canopy, projecting two-sided VOGUE blade, generic live-music marquee and Diana figure. [Parks Canada designation and architectural description](https://www.pc.gc.ca/apps/dfhd/page_nhs_eng.aspx?i=51352&id=799) documents the 1940–41 theatre and neon tower. The separate Vogue Hotel at 1060 Granville is not the theatre.
- **Orpheum**, OSM `w301875556`: the narrow Granville lobby frontage connects to the wider auditorium on Smithe. The projecting blade is located at the Granville entrance rather than the auditorium centre. Pale ornamental piers, roundels, a recessed arched grille, canopy, metal supports and a rounded neon frame provide the street view.

The old arbitrarily positioned entertainment signs have been removed. The two theatre signs have independently printed outward-facing sides. Night mode enables four short-range practical lights and raises neon emission; daylight disables the lights without adding/removing lights and recompiling every material. Theatre doors are architectural scenery; interiors are not enterable. The façade shells retain their mapped collision footprints, with shallow trim and overhead marquees.

## Distributed imagery

- **Vogue Theatre 2026.JPG**, [Canmenwalker, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Vogue_Theatre_2026.JPG), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Two derivatives are distributed: a cropped carved relief (grayscale, normalized and relit for daylight) and the cropped yellow Diana neon figure (alpha isolated from the night sky). Exact modifications and source URLs are in [the texture manifest](../../public/textures/theatres/SOURCES.json). These derivatives remain CC BY 4.0 and are not covered by the code's MIT license.
- **Painted Plaster Wall**, [Amal Kumar, Poly Haven](https://polyhaven.com/a/painted_plaster_wall), CC0. Color, OpenGL normal and roughness maps converted to 1K WebP, calibrated to approximately two-metre repeats. This is generic plaster photography; the Orpheum's pale stone treatment is an approximation.

Reproduction: `node scripts/fetch-theatre-materials.mjs`. No source photograph's event advertisement is reproduced; the marquee uses original generic wording.

## Reference-only imagery

[Orpheum vancouver sign.JPG](https://commons.wikimedia.org/wiki/File:Orpheum_vancouver_sign.JPG), **SamGusway**, CC BY-SA 3.0, was inspected for the lettering, outline, bulbs, brackets and façade. This image and image derivatives are not distributed in the game. The photograph's camera GPS is not used for placement; the mapped entrance footprint controls placement. Parks Canada photographs were used for reference only and are not game textures.

## Limits

The blade proportions, typefaces, colours, decorative carving arrangement and façade openings are simplified. The Orpheum's exact mouldings and the theatres' interiors remain unmodeled. Street-level recognition and coherent day/night materials are the purpose of this pass; this is not photogrammetry or AAA production fidelity.
