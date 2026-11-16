# Debug daylight orientation comparison

2026-11-16. **Current candidate: south180° for normal daylight.** The earlier comparison history below records the former southeast default. Public release remains982a753 until the new candidate passes integration and native checks.

## Physical reason for the comparison

The actual registered Gallery rear-facade transform gives an outward horizontal normal **[−0.6844808654,0,0.7290308257]**, azimuth **223.1948°**. Its unoccluded cosine incidence under the existing southeast daylight is only **0.02774**. A southwest225° sun at the same elevation gives **0.88014**. This is a strong geometric explanation for uniformly shaded pale stone despite physical cornice and wall detail. Actual neighboring buildings and trees can still occlude the light; this calculation does not claim the native pixels must reach a particular brightness.

The retained baseline is azimuth135°, elevation28.288107°, and offset length determined by horizontal278 m / vertical149.613152 m. The alternative is azimuth225° at exactly the same elevation and distance. At Vancouver latitude49.29°, both imply a physically possible solar declination within Earth's obliquity. They are authored orientation comparisons, not a date/time simulation; the fixed HUD clock is not solar evidence.

## Coupled implementation

The new `daylight-orientation.ts` wraps the existing `daylight.ts` offset without changing its constants. Southwest applies **−π/2 around world Y** to the daylight sun and the retained photographic sky orientation. Baseline HDR rotation remains−0.17418295284928853 rad; the comparison uses−1.744979279644185 rad. Background and distant environment use the same rotation. The water highlight direction is always the normalized sun-to-target offset.

The original **Rustig Koppie Pure Sky** HDR remains byte-identical, with no pixel edit, new asset or purchase. Its CC0 provenance and measured solar-disc direction remain in `afternoon-daylight.json`. Tests decode the existing2K unclamped HDR and verify that its measured disc follows the actual sun and water in both orientations. The horizon/elevation is unchanged.

The comparison changes no sun/ambient colour or intensity, exposure, fog density, bloom, material settings, reflection intensity or shadow quality. The camera-following light/target pair translates together and preserves the selected global direction at Robson, Canada Place/Howe and the bridge. There is no per-region sunlight.

## Visible debug control and restoration

Only the existing `?debug` **Render diagnostics** panel exposes **Daylight direction (day only)**:

- **SE135° · baseline** — unchanged default.
- **SW225° · comparison** — global daylight orientation trial.

The choice is memory-only, never saved to localStorage or normal settings. Reload starts at southeast. Golden, overcast and night retain their original direction and separate original sky/environment rotations. A selected comparison remains dormant during those weather modes and is restored when returning to day; choosing southeast restores the exact baseline.

The UI action ends an active frame sample, applies the direction, requests a shadow-map update and invalidates the existing SceneReflections generation. Old local cube assignments are cleared immediately, exposing the newly rotated distant sky while the existing bounded scheduler recaptures nearby probes. Cube count, resolution and allocation are unchanged. The experimental static-shadow cache also detects the changed light matrix through its existing state key. Local cubes retain world axes and are not rotated again as if they were the distant HDR.

The ordinary one-frame profile now reports `lighting.daylightOrientation`: selected mode, active mode (`weather-default` outside day), actual azimuth/elevation and actual normalized direction. The prior sun/water vectors, background/environment rotations, intensities, exposure and probe validity remain available alongside it.

## Validation and native acceptance

Fourteen focused daylight/weather/reflection tests pass, plus scoped strict TypeScript. They preserve the exact baseline weather tests, compare both orientations against the measured HDR solar disc, verify all scalar values survive the switch, follow the camera at all three scene coordinates, restore day/night/day and day/overcast/golden/day correctly, verify Gallery incidence, and exercise the same UI action against real SceneReflections invalidation. No GPU capture or screenshot acceptance is claimed by these tests.

Root should capture baseline and comparison from identical ordinary playable camera poses at **Gallery/Robson**, **Canada Place/Howe**, and **Ironworkers**, checking that relevant nearby probes have become valid after each switch. Keep time, weather, exposure, camera and quality constant. Review the Gallery stone relief and public tree shadows, Howe's formerly strongly lit facade and glass, bridge structure/path/rails, sky solar direction and water highlight together. A better Gallery alone is insufficient to change the global default. No native browser, build, dist edit or publication is performed by this lane.

## Native comparison and intermediate south trial — 2026-11-16

The 990a850 native build was reviewed with the same player/camera pose for each SE/SW pair at Gallery arrival, Howe corner and Ironworkers vehicle arrival. Gallery southwest light visibly reveals the columns, entablature and tree shadows; southeast leaves that facade almost tangent to the sun. Howe southwest instead shades more of the photographed street frontage, while southeast preserves its existing stronger facade light. The relevant325 Howe and Terminal City reflection probes were valid in both recorded states. Bridge lighting remains coherent under both directions. Exposure, intensity and material values were unchanged. This is a visual tradeoff, not acceptance of a new default.

A third **S180° comparison** is now available only in the same debug selector. It applies−π/4 to the baseline sun and photographic environment, preserving their measured elevation and alignment. This intermediate direction can illuminate both southeast- and southwest-facing architecture without moving the sun between areas. The actual HDR solar-disc test covers all three directions. Native south acceptance remains pending. Default reload and normal gameplay remain southeast.

Evidence: artifacts/local/{gallery,howe,bridge}-daylight-{se,sw}.png and matching daylight-comparison.json profiles. The Gallery two-flight stairs reached the full3.28m landing through ordinaryW input and returned to ground withS, without jumping. Stairs still needed a separate grey mineral finish; the later material candidate was not part of these captures.


## South gameplay candidate, 2026-11-16

The scene comparison favors south180° as a shared daytime compromise: the Gallery rear stone gains directional relief, while Canada Place and the bridge retain a coherent shared sun. The south native comparisons are recorded in `three-scenes-reflection-native.json` and `gallery-portico-shadow-review.json`; the latter also records normal stair-to-terrace walking. These comparisons do not establish AAA appearance or a performance improvement.

The normal World now initializes `DEFAULT_DAYLIGHT_ORIENTATION` to south. The physical HDR disc, direct light, water highlight and distant environment use the same45° rotation from the original measured southeast baseline. Elevation28.288107°, intensity3.4, material settings, exposure and reflection budgets remain unchanged. The fixed daytime HUD reads12:00 to suit the authored noon direction; it is not a calendar simulation. The debug selector labels south as gameplay and southeast as previous. Night, overcast and golden behavior remains unchanged.

Nine weather tests pass, including actual owning weather/update methods across Gallery, harbour and bridge positions and day/night/day restoration. Existing measured-HDR tests remain required. A fresh normal startup and all-three-region native check are still required before publishing this candidate.
