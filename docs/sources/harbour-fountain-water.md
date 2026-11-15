# Harbour Green fountain water and spray

2026-11-14 Vancouver time. Original renderer/geometry work informed by the historical pedestrian-height Darwin Construction photograph, not a scan or surveyed hydraulic reconstruction.

Reference: <https://www.darwinconstruction.ca/assets/Projects/harbour_green/harbour_3_840x520.jpg>, linked from <https://www.darwinconstruction.ca/projects/development/harbour-green-park-1>. Local reference `artifacts/local/harbour-green-reference/photo-4.jpg`. The reference shows a shallow, dark reflective spray pad, varied fine fountain plumes, capped dressed-stone piers and the Bute stair axis. Reference image pixels are not included in the game.

The previous water was a pale translucent physical-material plane above a separate stone substrate, with 1,400 point sprites clamped up to five pixels. Its rendered appearance was a uniform pale pad and white beaded arcs. The revised pad is one depth-writing granite substrate with a water-film clearcoat, wet roughness variation and shallow animated surface ripples. It reuses Charlotte Baglioni's Poly Haven `granite_tile` CC0 maps at their documented 2.3 m scale; details in `public/textures/harbour-green/SOURCES.json`. No transmission pass or new texture download is required.

Ten interpreted emitter positions retain the original pool layout. Slender continuous water cores are combined in one mesh. One particle draw adds 9,120 fine drops and soft breakup, with sizes derived from the actual drawing-buffer height and projection matrix. Subpixel drops reduce opacity rather than becoming permanent bright dots. The spray responds to the same day/night reflection setting and scene fog; it does not emit a fixed white glow at night. Particle bounds include the complete ballistic trajectories, and near-ground alpha hides drops below the walkable plane.

The first local render overemphasized mirror reflection and underrepresented visible spray. It was revised to a rougher film and denser fine plumes. The film remains an approximation: a static local cube probe cannot produce exact viewpoint-dependent planar reflections, physical refraction or dynamic actor reflections. The emitter count/positions and hydraulic strengths are interpreted rather than surveyed. Acceptance requires actual day/night moving gameplay, not the geometry tests alone.

Stone profile work is described in [harbour-fountain-stone.md](harbour-fountain-stone.md). Ordinary fountain walking/collision remains unchanged. No new photo-mode feature or interior work is included.
