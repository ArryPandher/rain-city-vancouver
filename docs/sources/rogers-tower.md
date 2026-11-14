# Rogers Tower exterior reconstruction

2026-11-14. Original game geometry for the former Shaw Tower at 1067 West Cordova Street. Architecture: **James K. M. Cheng Architects**; landscape: **PFS Studio**. Arry's current scope prioritizes outdoor places and façades; building interiors are not an exploration requirement.

## Sources

- [OpenStreetMap extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.1192,49.2878,-123.117,49.2893): parent way **361502265** and six building parts **91998084, 91998096, 91998107, 91998122, 91998146, 361502266**. Explicit height tags of 142 and 149 m take priority; 3/7/10/17-storey wings are interpreted as 11.6/26.4/37.2/62.4 m. Projected outlines/tags are committed in `src/world/rogers-map.json`.
- [Westbank, Rogers Tower](https://westbankcorp.com/body-of-work/rogers-tower): owner photography, sculpted tower and crown, 2005 completion, 24 residential floors above 16 office floors, separate lobbies and architect/landscape credits.
- [Vincent Helton, Shaw Tower](https://www.vincenthelton.com/shaw-tower): water-feature designer's photographs, mist/nozzle system and 489-foot tower height (approximately 149 m).
- [Westbank, Light Art](https://westbankcorp.com/public-art/light-art): **Diana Thater, Light Art (2005)**, green-to-blue vertical LED installation with coloured glass, pool and mist.
- [Michael's Shaw Tower photograph](https://commons.wikimedia.org/wiki/File:Shaw_Tower,_Vancouver.jpg), [Flickr original](https://www.flickr.com/photos/sagamiono/4398581409/), **Michael / sagamiono**, CC BY 2.0: photographed balcony recesses, glazing, mullion divisions, stepped lower wings and thin roof screens. Viewed as reference only, not included as a texture or redistributed.

## Construction

`node scripts/fetch-rogers.mjs` reproduces the source extract from a local XML cache; `--refresh` requests the OSM API. Height-section unions form the exterior shell; differences between sections form the terraces. Collision uses the mapped parent outline. Static geometry batches physical slabs, recessed balcony bands, glazing mullions and seals, varied visible window depth, terrace guards, roof enclosure and canopy brackets. Plain ROGERS lettering identifies the site; no logo image is copied.

The outdoor water feature uses an original simplified interpretation of Light Art: coloured shaft/fins, rounded stone basin coping, a reflecting water surface, small nozzle hardware and animated local mist. The shaft is placed outside the building shell. The basin blocks entry, while public perimeter routes remain available. A stone apron and narrow drain slots follow the existing pavement grade. Four local reflection captures supply the building/pool, with lower night intensity and automatic daylight restoration.

Geographic source data remains © OpenStreetMap contributors, ODbL 1.0. Existing Poly Haven cast-concrete and painted-wood maps retain CC0. Original code and game geometry are MIT. The real artwork/design is credited above; no artist media, third-party model, reference photograph or Rockstar asset is distributed.

## Limits and checks

This is a photograph-guided interpretation, not photogrammetry or a survey. Fine façade spacing, recess dimensions, pool/lighting geometry, window scenery, landscape hardware and local grades remain approximate. The scene behind ground-floor glass is shallow scenery; interiors are not explorable. The public outdoor experience is the focus. AAA visual quality remains unfinished.

Automated checks compare height sections to source parts, verify finite geometry/crown height, raycast glazing depth and check clear perimeter routes/solid basin edges. Browser checks cover rendering, animation time, day/night reflection response, native walking, driving, cycling and all three weapons. Results are recorded in `docs/PLAYTEST.md` and the release log.
