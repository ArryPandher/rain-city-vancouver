# Robson daylight landscape and gallery checkpoint

2026-11-15. Ordinary walking and driving views are the acceptance target. The GTA VI reference remains an aspiration; this pass does not establish AAA realism.

## Changes and sources

- Restore the mapped Robson/Hornby mound, with a 7.62 m crest supported by CSLA/TCLF descriptions. The original mapped outline is exact; the smoothed interior contours and planting are interpretations. One height function supports terrain, paths, mapped trees, pedestrians and vehicles. The revised terrain and broad shrubs total 10,912 triangles in two batches, plus local path refinement.
- Replace the gallery cross-wing roof slopes with closed clerestories, shallow patinated copper roofs and layered eaves. Add exposed rear cornice bands and warm grey stone separation. Retain the central dome, original terrace balustrade, protected entrance and source attribution. Net roof addition: 5,088 triangles in four materials.
- Add three original name-only gallery banners. They claim no current exhibition or copied artwork. Cloth stands 190–210 mm from the wall, clearing existing sills; larger centred typography remains readable in the ordinary close view.
- Correct 48 stationary core-window vertices incorrectly included in the earlier entrance translation. The complete correct entrance still moves; these window rails and reveals remain at their original coordinates. This fixes the floating sky bars caught in the first native capture.

See `sources/robson-mound.md`, `sources/gallery-roof.md` and `sources/gallery-facade.md` for evidence, source bounds, rights and estimated dimensions. Reference photographs are local research files, not shipped game textures. Existing licensed CC0 materials and CC BY source geometry are retained.

## Verification

The combined suite passed all 428 tests and the production build. After declining the car threshold experiment, the five car/wheel tests, TypeScript and the production build passed again. Final CI verifies the exact released source. Tests cover source-ring equality, terrain/path contact, clearance, source-preserving roof cuts, closed surfaces, protected stairs and the independently pinned 48 stationary window vertices.

Native Codex browser checks used the existing single tab, Balanced/daylight, 723×670 CSS pixels and pixel ratio 1.35:

- Matched whole approach: final position approximately (−145.96,1.68,128.14), yaw 2.35546. The revised broad shrubs and rounded shoulder improve the first candidate's sparse upright foliage and sharp ridges. Independent visual review accepts the bounded improvement.
- Gallery close view: approximately (−68.82,0,51.12). The floating sky bars and banner/sill overlaps are gone. Roofline, original stairs and attached cornice remain intact.
- Lateral gallery view: (−33.19,0,89.22), yaw 2.82116, pitch −0.22425. Actual source rays identify the apparent open strip as the retained stone balustrade. The new clerestory is mostly occluded behind that real terrace from this grazing view; it is not a reason to delete the rail or claim dramatic visible roof detail.
- Walking crosses the revised mound from (−152.65,0,60.51), through approximately (−124.85,7.57,80.47), back to grade on the east side. The centre crest is independently tested at 7.62 m. No under-terrain reset occurred.
- A summoned non-AI Pacific GT drove from the east plaza onto the mound at (−119.95,6.93,74.07), across it and down to (−145.37,0,82.58), then braked and exited. Final speed was 0.0334 m/s after 58.89 m accumulated manoeuvre/traverse distance. A prior summon attempt on the occupied/narrow crest declined safely; the accepted crossing started from a clear lower path.

Local evidence is retained under `artifacts/local/robson-*` and `artifacts/local/gallery-*-final*`. The before/after screenshots show real gameplay, not an offscreen or photo-mode render.

## Performance trial and remaining work

The earlier candidate's matched whole-Robson 20-second samples were 24.81 fps before and 25.05 fps after, p95 about 50 ms. Those samples precede the final foliage revision and are not proof of a gain. A separate Cordova car trial was slower (27.60→22.36 fps) with different traffic and shadow load. Its attempted walk-back used an AI car and did not establish the non-AI transition. The 160/140 m thresholds were therefore **not adopted**; the existing 240/200 m thresholds and corrected wheels remain. The scoped candidate patch and measurements are retained locally. See `sources/car-distance-lod.md`.

Mature pine/rhododendron structure, dense connected planting, proper garden stairs and retained path edges still need work. Current internal mapped steps remain continuous slopes. Gallery surface/weathering detail, surrounding generic buildings, character/vehicle animation and consistently smooth performance remain major gaps. The four-scene GTA VI/AAA goal remains active and substantially unachieved.
