# 325 Howe Street: source and exterior fit

2026-11-15. Research for an original street exterior replacing mapped `w143683962`. This supplements [the identification audit](howe-325-howe-audit.md); it does not alter that prior audit or prove completion of the implementation.

## Confirmed reference hierarchy

The [owner identifies 325 Howe as the P. Angela Webster Building](https://new.equitablerealestate.ca/pacific-coast-building/), completed in 1912 and designed by Thomas Hooper. Historical names include Pacific Coast / Pacific Coast Fire Building and National Finance Corporation Building. The old ten-storey count includes floors below today's elevated street.

The actual [2013 corner comparison](https://changingvancouver.wordpress.com/2013/02/19/325-howe-street-2/) was inspected at original resolution, with its modern half enlarged for counting. **The narrow Cordova end has three broad paired-window bays; the long Howe face has seven, correcting the prior audit's approximate six.** Six upper window rows plus the current ground floor give seven visible levels. The main body has pale vertical piers, buff/orange spandrels on Howe, pale horizontal panels on the narrow end, a grey stone base, rectangular paired windows and a modest flat parapet. The historic heavy projecting cornice is absent from the modern comparison.

The [owner's actual Howe street photograph](https://new.equitablerealestate.ca/wp-content/uploads/2011/03/PPCF-Howe-Street-pic-4.jpg) corroborates the pale piers, warm spandrels and low street base through the trees. Its URL directory is upload context, not proof of capture date. Both image sources are reference-only; no open licence was established and neither is a runtime texture. The 2013 image is dated evidence, not a guarantee of current tenant signage or condition.

Local reference copies and source URLs/byte counts are in `artifacts/local/howe-325-howestreet-reference/`. Two small photographic sources total 673,645 bytes. No browser was used.

## Roof footprint identification

[Raw City roof records, converted coordinates and overlap measurements](howe-325-howe-source-fit.json) preserve building group **150434** and parts **166938 / 165371**. The union covers 476.309 m². Its intersection with the 537.375 m² runtime footprint is 431.668 m²: **80.33% of the runtime area and 90.63% of the City source area**. This supports the building match while showing that the geometries are not identical. Do not silently replace or stretch the runtime collision outline to the source polygon.

- Main flat part 166938: highest elevation 41.57 m, lowest element elevation 15.69 m, 426.041 m²; 381.400 m² intersects the runtime footprint.
- Small part 165371: highest elevation 44.43 m, lowest 16.15 m, recorded as pitched; its 50.268 m² footprint lies wholly inside the runtime building.
- Shared group base elevation: 16.56 m. Published group dimensions: 34.63 × 13.85 m. Runtime street edges are 31.820 m and 16.621 m; these differences remain registration uncertainty.

City metadata defines highest element elevations, **not continuous roof surfaces, cornice heights or mandatory ridges**. The 2009 LiDAR-derived dataset is approximate and is not updated. Its roof object classification should not override a better visual reference.

## Aerial roof check

A small crop from [City 2022 orthophotos](https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/) was inspected before prescribing roof form. It shows a largely flat brown/grey roof, a small inset rectangular raised plantroom/roof object, low mechanical units and a slim perimeter parapet. It does **not** support a large hipped roof. The 50 m² City part corresponds to the small raised object after allowing for visible historical/orthophoto roof displacement; its exact current height and slope remain unmeasured.

The raw source projection is saved locally as `2022-city-roof-overlay.jpg`. It visibly differs from the photographed high roof by several metres; it is an uncertainty illustration, not a corrected survey overlay. Roof-relief displacement cannot be removed from these images alone. Use the source object as a bounded placement guide inside the retained building, then check street visibility.

Nine level-20 source tiles total 116,053 bytes. The service is [Orthophotos_2022](https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer), captured June 6–July 1, 2022 under the [Open Government Licence–Vancouver](https://opendata.vancouver.ca/pages/licence/). URLs, georeference and local image paths are retained in the ignored source manifest; no aerial imagery is distributed as game content.

## Ground and vertical fit

The current actual map and CollisionWorld sampler give centroid datum **9.2577731552 m**. Exterior samples 0.25 m outside each edge give:

| Edge | Street role | World ground range |
| --- | --- | --- |
| 0 | Narrow Cordova end | 8.588–8.660 m |
| 1 | Long Howe face | 8.593–9.902 m |
| 2 | Rear end | 9.931–10.058 m |
| 3 | Adjoining return | 8.673–10.050 m |

Keep facade courses horizontal and extend the closed masonry base below the lowest visible contact. Do not slope every window row with the pavement. Three historic lower floors are below modern raised streets; this does not make the current 25.6 m above-ground height automatically wrong.

The **inferred** neighborhood conversion `City elevation − 7.52` places the main roof maximum at world **34.05 m**, or **24.7922268448 m above the current building datum**. The small high part maps to world **36.91 m**, or local **27.6522268448 m**. Group base 16.56 m maps to 9.04 m, about 0.218 m below the current centroid. This consistency supports an initial fit but does not establish a surveyed vertical datum.

## Initial architecture dimensions for native comparison

Confirmed bay counts yield a nominal 5.5403 m pitch across Cordova and 4.5457 m along Howe if fitted to the existing runtime outline. Reference openings occupy approximately 63–70% of each bay; the remaining width belongs to solid pale piers and corner returns. Opening width, reveal depth (roughly 0.25–0.40 m), frame thickness and material response are photographic interpretations rather than measurements.

A coherent first candidate uses a local 4.0 m stone-base/ground-floor zone and six upper window courses with sill/head pairs `[4.7,7.0]`, `[8.1,10.4]`, `[11.5,13.8]`, `[14.9,17.2]`, `[18.3,20.6]`, `[21.7,24.0]`. A flat roof around 24.3 m and slim parapet capped at the source-guided 24.792 m are reasonable initial geometry. Place only a modest small roof object in the source 50 m² footprint; 27.652 m is its historical upper control, not permission for a large building-wide roof.

These vertical bands are **not measured**. The enlarged photograph may favor a slightly taller base (about 4.7 m), shorter upper pitch (about 3.15 m) and more top-frieze space (about 1.3 m). Native comparison should resolve that proportional choice without moving the shared street or distorting the mapped footprint. Confirmed requirements are three/seven bays, six upper rows, closed recessed rectangular windows, pale piers/stone base, distinct Howe spandrels, no invented coffee signage and no revived historic cornice.

No tests, production build, browser gameplay or deployment were performed as part of this source audit.
