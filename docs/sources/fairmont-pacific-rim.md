# Fairmont Pacific Rim reconstruction

2026-11-14. Original game geometry for the hotel and residences at 1038 Canada Place. Architectural design: **James K. M. Cheng Architects**. This replaces the generic four-corner, uniformly scaled tower previously generated for OSM way 143683979.

## Geographic and architectural sources

- [OpenStreetMap map extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.1181,49.2875,-123.1153,49.2889): parent way **143683979**, suite cube **360438242**, tower parts **360607252/253/254**, and podium parts **360607257/258/259**. Their projected outlines and min/max height tags are committed in `src/world/fairmont-map.json`. The overlapping parts are unioned at each height; roof terraces are differences between adjacent sections. Heights include 2, 15, 30, 128, 132 and 140 m.
- [DIALOG, structural engineer](https://dialogdesign.ca/projects/fairmont-pacific-rim-hotel-and-residences/): tower and entry photography, 458.25 ft total height (approximately 139.7 m), hotel/residence mix and projecting balconies.
- [James K. M. Cheng Architects’ project description](https://archinect.com/jameskmcheng/project/fairmont-pacific-rim): angled west face, setbacks between city-grid podium and tower, contrasting curtain-wall and balcony façades, zinc-clad waterside suite cube and public art attribution.
- [RDH, building enclosure consultant](https://www.rdh.com/our-case-studies/fairmont-pacific-rim/): photographed glazing, slab edges, podium, metal panels and stone cladding.
- [Zahner, façade fabricator](https://azahner.com/projects/fairmont-pacific-rim/): perforated/dimpled stainless-steel forest imagery, panel joints and diffuse metal finish. The real pattern derives from James Cheng’s forest photograph. Rain City instead generates an **original recursive branch drawing**, with a filtered shader interpretation of perforation, and does not reproduce the photograph or manufactured panel image.

The real wraparound text installation is by **Liam Gillick**. Its artwork is acknowledged here; the game currently uses plain horizontal floor bands rather than a copied text-art texture. Exact artwork, logos and proprietary imagery are not included.

## Implementation and reproduction

`node scripts/fetch-fairmont.mjs` prepares the eight mapped outlines, using a local XML cache when available; `--refresh` re-requests the public OSM API. `node scripts/make-fairmont-pattern.mjs` reproduces the original forest drawing. Geographic data retains ODbL 1.0 and © OpenStreetMap contributors attribution. Original code, branch drawing, façades, scenery rooms and palms use this repository’s MIT license. Existing cast-concrete photography remains Poly Haven CC0, as credited in `THIRD_PARTY.md`.

The tower has physical slab edges, 1.55 m balcony recesses, guard glass, mullions, blue spandrels, rooms behind the glazing, varied pleated curtains and some furniture/light silhouettes. Three local scene reflection probes serve the harbour, east and west sides, with lower intensity at night and restored daylight response. The podium includes stone bands, glazing ribbons and shades, round entry columns, a layered canopy, a zinc suite cube and planted roof. These are authored interpretations guided by the references, not a scan.

## Limits

Mapped height tags and primary-source height agree approximately, but published storey counts differ and the model does not claim an exact surveyed floor schedule. Window spacing, slab depths, rooms, canopy dimensions, roof planting, metal pattern and material responses are estimated. Downtown elevations remain interpreted; bases and columns meet the game’s existing local grade. The building shell is not an explorable hotel interior. Only exterior public routes are intended to remain walkable. References were viewed for reconstruction and are not distributed with the game. This remains below AAA visual production fidelity.

Tests sample the unioned height sections against all source parts, verify the 140 m top and finite geometry, raycast real depth behind a glass bay, and verify entrance pavement/column collision. Interactive evidence is recorded in `docs/PLAYTEST.md`.
