# Canada Place northern forecourt seating

2026-11-16 UTC. Bounded photo-informed reconstruction of two seats in the public
west side of the northern forecourt. Not a surveyed furniture inventory.

## Identity and scale

MCM's Handford CanadaPlace04 photograph clearly shows separate pale sculptural
seats, with organic lobes/concave necks and dark cylindrical supports, beside the
planted islands in front of FlyOver. Source page:
https://www.mcmparchitects.com/projects/canada-place/
Local source crop: `artifacts/local/canada-north-bench-source-crop.jpg`.

The furniture manufacturer independently identifies **Natural Puzzle**, among
other Metalco families, in the 2016–17 Canada Place North Point renewal:
https://www.metalco.it/en/project/elementi-urbani-nel-porto-di-vancouver/
The manufacturer photograph provides a high oblique view of the actual location:
https://d3e844sonl74ih.cloudfront.net/wp-content/uploads/2022/03/metalco_projects_port_vancouver_natural_puzzle_5.jpg
It is cached as `metalco-north-natural-puzzle.jpg`. This establishes the northern
forecourt, rather than the hotel entrance or opposite operational cruise quay.

The Natural Puzzle product is a modular organically shaped HPC seat on tubular
steel supports by Pio & Tito Toso. Public supplier dimensions give2.15×2.16m,
height0.423m; another2025 catalogue gives2.00×2.12m/0.425m. These are family/variant
references, not a measurement of the installed Vancouver units:
https://metalco-mobiliar.cz/en/prodotti-en/natural-puzzle-2/
https://www.metalco.it/en/product/metalco%E2%80%91natural%E2%80%91puzzle%E2%80%91concrete%E2%80%91bench/

The authored silhouette uses original Bézier controls guided by those readable
lobes and concave transitions. It is not a manufacturer CAD asset. The chosen
2.15×2.16m footprint,0.423m seat height,0.15m slab,12mm bevel and70mm-radius steel
legs are a bounded interpretation. Lip bevel slightly increases the outer
footprint. Four supports are fitted below the actual slab. Colour is pale neutral
HPC with dark coated steel; no photographic artwork/texture is bundled.

## Registration and public support

Initial candidate[47,-66] lay inside the existing mask but too far south beside
the cinema. It was rejected after the manufacturer's high view clarified the
forecourt. Final source-local centres are[74,-76] and[84,-66], with estimated
orientations−0.20/+0.35rad. Their regional placement follows the west-side seating
shown north of the cinema; exact furniture stations are not surveyed. The cached
Esri aerial's capture date/roof parallax remain uncertain and are not used as an
exact furniture plan.

The actual source GLB PIER top is7.798935890197754m.273 grid rays around each of
five trial locations verified that floor. Four candidate regions were fully
clear;[90,-62] encountered retained terminal solid at79 samples and was rejected.
All final outline/leg samples hit the same original floor with upward normals.
The existing+.08m source placement is preserved; bench feet match the exact
source floor instead of a guessed raised plaza.

A bounded eligibility polygon adds only the photographed west part of the
northern forecourt to `CANADA_PLACE_PUBLIC_MASKS`. It does not replace PIER
containment, the650mm rim setback, any terminal/hall/hotel exclusions or unloaded
asset gates. The previous promenade route is unchanged. The tested continuation
runs local[42,-75]→[58,-76]→[68,-70]→[77,-61]→[82,-59], past the seating. No new
floor, road ribbon, terrain elevation or water exemption is created.

## Contacts, rendering and checks

One import/call beside the existing source-gated promenade fixtures installs the
seating. Two InstancedMesh batches submit 2,680 triangles and share the pale slab and dark supports across
both seats. Finite slab-outline/leg contacts use the same fixture capability.
An early local bounding check keeps distant world queries cheap. Existing
`height`/`walkingHeight` return the seat top only from a reference within200mm
below it or above; a ground walker cannot be promoted onto the seat. Ground and
road height methods are unchanged. Camera contact below a slab follows its actual
legs; above it the bench cannot create an infinite obstruction.

Focused checks cover metric lobed geometry, outward top/underside, supported
legs, exact GLB floor, retained terminal/hall exclusions, source-load gating,
full-data promenade/forecourt walking and camera clearance, ordinary Space
impulse 5m/s, normal walking speed 3.2m/s and gravity 17m/s² onto the seat, and stepping back to the source deck.
Native appearance/interaction acceptance remains pending. Manufacturer and MCM
images are reference-only; existing Codriver/OSM and CC0 runtime attribution is
unchanged.
