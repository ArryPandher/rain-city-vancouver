# One, Two and Three Harbour Green exteriors

2026-11-14. Original outdoor architecture for the three residential towers beside Harbour Green Park. No enterable building interiors were added. The window backplanes are shallow facade scenery.

## Sources and scale

- [OpenStreetMap extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.126,49.2879,-123.1177,49.2915), fetched 2026-11-14: parent ways 224131617, 224131618 and 224544078, plus 16 upper parts. Exact coordinates, original height and minimum-height tags are retained in `src/world/harbour-towers-map.json`. © OpenStreetMap contributors, ODbL 1.0.
- [ASPAC project page](https://aspac.ca/project/harbour-green/): the developer lists One at 80 m / 23 levels, Two at 105 m / 31 levels and Three at 116 m / 32 levels. It credits James K.M. Cheng Architects for One/Two and IBI Group for Three. The page repeats One's address under all three; the game uses the mapped addresses/locations rather than copying that repetition.
- ASPAC's exterior photographs `Coal-Harbour_42-792x.jpg`, `Coal-Harbour_41-804x.jpg` and `Coal-Harbour_04-547x.jpg` were inspected for facade composition: One's terracotta blade and rounded upper bay; Two's pale horizontal frames and side balconies; Three's green glass, projecting corner forms and open glazed crown. The images are reference-only and are **not** shipped or used as textures.

The low parent tags (10, 12 and 15 m) describe the modeled podiums rather than the whole tower. Upper OSM maxima are 78, 107 and 135 m. To resolve disagreement, upper part heights are proportioned above each unchanged podium to the developer's published overall height. The original tag values remain in the JSON. This is an explicit modeling decision, not a surveyed reconciliation: sources may use different roof/architectural datums. Intermediate floor spacing, fine facade subdivisions, balcony arrangements, colors, doors and landscaping are authored approximations. The curved One bay follows the faceted mapped outline.

## Construction

Height sections union the active mapped parts and retain their setbacks. Roof terraces are the difference between adjoining sections. The podium footprint also owns collision. Exterior glazing has shallow recessed backplanes, varied blinds, seals, metal frames and physical balcony slabs/guards. Thin canopy planes and terrace planting add visible depth. Two local 128-pixel scene probes per tower reflect the park and street, with separate authored day/night intensities. Existing licensed concrete maps are reused; no new downloaded game media is required.

The foundation follows the shared park/plaza walking grade. Balcony slabs stay within the mapped upper perimeter. Public park paths, stairs and vehicle surfaces retain their existing terrain and controls. The architecture remains an approximate independent browser-game interpretation and does not reach AAA fidelity.

## Reproduce and verify

```sh
node scripts/fetch-harbour-towers.mjs
# Use --refresh to replace the cached OSM extract deliberately.
npm test
npm run build
```

Tests compare unioned sections with source-part membership, check the developer-scaled heights, finite geometry and triangle budget, raycast the glass-to-backplane depth, and verify solid podiums with clear exterior routes. Native playtest and release evidence are recorded in `docs/PLAYTEST.md` and the project release log.
