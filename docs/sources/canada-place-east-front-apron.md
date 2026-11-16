# Canada Place east/front apron contact

2026-11-15. This corrects the native walking failure at world `(517.33, -491.45)`: feet followed terrain at 7.36905 m while the visible original PIER top was 7.8789358902 m. These are source-model dimensions, not surveyed elevations.

## Source and support boundary

The original [Codriver geometry](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/canada-place/geometry.js) creates the PIER prism at local y=0–7.8. Runtime decoding and Float32 baking produce a top at 7.7989358902; the existing +0.08 landmark transform gives 7.8789358902 world. Shared finished contact at 7.88 is 1.064 mm above that surface. The source remains CC-BY-4.0; geographic placement is © OpenStreetMap contributors.

`CANADA_PLACE_EAST_FRONT_APRON` follows source HOTEL vertices 32–38 and PIER vertices 26–29. `supportedDeck` intersects this exposed exterior patch with the original PIER and all existing solid exclusions. It does not open the private HOTEL or podium arcade, terminal, sails or unrelated pier surfaces.

The apron requires the complete actor circle to fit inside the source edge, with an additional 12 mm for quantization. The previous generic 0.65 m trail inset rejected the native coordinate although the actual 0.36 m character footprint fits its floor. Other pier areas retain their existing margin. A failed source load disables source support.

## Existing rail

Source geometry creates rails only on PIER edges at least 26 m long. The apron east boundary, PIER 25–26, has a real rail; adjacent short front edges 26–29 do not. The coarse mapped building proxy did not reliably collide with this rail.

`canadaPlaceEastFrontRailAt` follows only edge 25–26 at the source's 0.05 m exterior offset. The actual baked steel reaches 0.079227577 m from the rail axis, with world heights 7.776443081–8.955096321. The collision envelope adds 6 mm to those measured bounds on each side. The caller requires loaded source and supplies the 1.8 m actor extent or camera sphere radius. A camera entirely above the rail remains free. No wall mesh or entry barrier is added.

## Validation and entry limit

`tests/canada-place-east-front-apron.test.ts` checks the actual GLTFLoader scene, apron and character-perimeter floor rays, native bug point, failed-load fallback, hotel exclusions, original steel rays and vertices, and low/high camera clearance. It uses the game's 0.36 m character radius.

The nearby ordinary approach `(513.86,-483.35) → (516,-490) → (516,-492) → (517.33,-491.45)` is unblocked with a maximum physical upward step of 0.389625 m. Starting terrain remains 7.5749925 m outside PIER. The direct diagonal crosses a higher 0.489194 m source lip; use the lower entry or a normal jump rather than extending the deck outside its footprint. Normal gameplay verification remains the coordinator's responsibility.
