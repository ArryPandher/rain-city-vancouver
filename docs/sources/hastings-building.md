# 1199 West Hastings: named exterior reconstruction

2026-11-14. Original bounded exterior replacing the generic parent-footprint tower for `w181355204`. Identity investigation and source disagreements are recorded in `harbour-view-a-buildings.md`.

## Evidence used

- [Wicklow West — Hastings Building](https://www.wicklowwest.com/building-info/hastings-building) establishes the name/address. Its [owner-hosted exterior photograph](https://officetours.com//theme/office-tours/allfiles/f55a742b87e1cacf860b87bb66641f43/1199-west-hastings-street%20(7).jpg) was directly inspected for narrow reflective window bands, dark horizontal spandrels, pale thin edges, chamfered/angled outline and a column-supported base.
- Darwin Construction's [Harbour Green photograph](https://www.darwinconstruction.ca/assets/Projects/harbour_green/harbour_3_840x520.jpg), already cached as `artifacts/local/harbour-green-reference/photo-4.jpg`, establishes this tower's central position above the Bute stairs. The prior game view `288-public-harbour-gameplay.jpg` has a generic thick grid/pointed-outline treatment which does not convey the same building.
- Actual cached [OSM map extract](https://api.openstreetmap.org/api/0.6/map?bbox=-123.126,49.2879,-123.1177,49.2915), `artifacts/local/harbour-green-reference/osm.xml`: parent `181355204`, glass 15-level upper part `1102662953`, and smaller overlapping glass part `1102662954`. Exact transformed vertices and original tags are retained in `src/world/hastings-building-map.json`; © OpenStreetMap contributors, ODbL. Projection matches `data.ts` (east/up/south, origin 49.283/-123.12).
- [City of Vancouver, 2002 report](https://council.vancouver.ca/020625/p3.htm) establishes the column-supported tower/plaza and grade context. City construction date 1974 conflicts with the cached OSM parent's 1968; no historical tenant signage is inferred.

## Geometry and explicit interpretations

The model uses the actual irregular upper outline, retaining its different front/back edge lengths and angled corners. Fourteen window storeys above a 4.8 m base total 48 m, derived from the existing 15-level scale of 3.2 m per level. **This is not a surveyed height.** Window strips sit 0.13 m behind the band plane; thin 1.5 m nominal pane subdivisions replace a heavy generic square grid. Bands wrap the whole mapped outline. The columned base has dark recessed closed backplanes and a visible soffit, with no interior or new accessible space.

The smaller overlapping part has no height tag. It is conservatively interpreted as a low 0.97 m roof enclosure clipped to the upper outline, rather than generating a second overlapping full-height tower. Its actual vertical role remains uncertain and should be checked against a roof view before stronger accuracy claims. Roof parapet, floor spacing, column spacing, band widths, material roughness and mullion dimensions are authored approximations informed by the photographs.

Six shared opaque materials batch the static exterior; blue-grey glass uses one bounded existing 128-pixel local reflection probe. There are no transparent interior layers, new lights, downloaded game textures or per-frame geometry updates. Existing credited CC0 cast-concrete maps are reused subtly on the pale edges. Photographs are references only and are not distributed as textures.

The existing mapped parent collision is unchanged. Columns/skirt follow its site ground; the visible open-looking base remains closed scenery behind the mapped collider. Preserve that limitation in playtesting. Standalone tests check finite geometry and material/triangle budgets, upper-outline containment, external raycast evidence of glazing recess and visible soffit, restoration of batch height offset, and suppression of duplicate upper-part geometry. They do not prove photographic resemblance.

## Integration and review

`hastingsBuilding` is integrated into the `architecture.ts` named-building handler chain before generic construction. The handler returns true for the two child-part IDs without generating them separately. It returns false for every unrelated building. No `world.ts` change is necessary.

Parent must review the ordinary-play fixed View A and the Hastings/Bute sidewalk approach, especially tower height, reflective colour under day/night sky, central silhouette and base/collision consistency. The reconstruction is an identity improvement candidate, not an achieved near-photographic match.

Local rendered review found an overbright facade. Correcting the sun direction used for startup reflection captures removed the white blowout; the glass was then made cooler, rougher and less reflective to address a remaining mint-green cast. This is material calibration against the source, not a measured optical reconstruction.
