# Harbour Green fountain, Hastings backdrop and tree submissions

2026-11-14 Vancouver time. A verified local improvement checkpoint; the broader AAA goal remains unmet.

## Changed

- One wet-granite substrate replaces the pale fountain-water overlay. Fine spray and continuous slender streams replace the old bright bead arcs. Dressed-stone pier courses, recessed panels and stepped caps reuse the old outer/collision envelope.
- The Bute frontage has visibly sloped canopy panels, ribs, eaves and more substantial balustrade piers.
- The central background building is identified as 1199 West Hastings and uses its actual mapped upper footprint, floor bands and recessed reflective glazing. Height and small roof-part interpretation remain approximate. Source identification also establishes1177 West Hastings and Carina as the next facade candidates.
- Weather initializes the sun direction before startup reflection captures. Captures translate sun and target together, preserving direction and restoring both. This removed observed white glass blowout;1199 glass then received a cooler, rougher, lower-intensity material adjustment.
- Distant crowns use the same24 source depth planes/alpha atlas with48 rather than806 triangles.192m cells improve culling; full near leaves remain close or large in the view, with the existing source-patch-preserving medium geometry elsewhere. Tree budgets and nearby source wood are preserved.
- Heavy optional tree assets no longer block entry. Street detail streams downtown; forest detail waits until near Stanley. Jobs/GLB requests are sequential, and placement yields between bounded CPU slices. Existing vegetation and solid collision remain available.
- Debug-only controls expose actual draw attribution and20-second raw-frame samples through ordinary UI. They are not included in normal non-debug gameplay.

## Actual checks and limitations

All184 tests and the production build pass locally. Tests cover mapped geometry, material/triangle budgets, source alpha bounds, projected-size/FOV/hysteresis, deferred loading order/failure, raw frame statistics, weather/capture direction, particle bounds and fog-integrated rendering. An initial missing fog uniform was found through actual rendering and corrected before the final checks.

The existing Codex in-app tab was the only browser/game instance. Native driving/braking and exit, walking through Bute stairs to the fountain, drag-look and all three weapons were exercised during the pass. Final ordinary-day route finished at(-81.38,1.55,-798.02); day/night fountain views were reviewed and daylight restored. No browser warning/error after the corrected shader was observed. User briefly took over driving, acknowledged it, and explicitly returned testing control; that interval is excluded from evidence.

A final20.0175-second run/walk sample covered(-145.43,4.18,-686.56) to(-81.38,1.55,-798.02), averaging24.68fps, median34.2ms, p9550.9ms, p9966.4ms, max66.7ms,70frames over50ms and none over100ms. Viewport903×670, DPR1.35, Balanced/day. An earlier20.05-second stationary inland view averaged14.11fps, p9583.4ms, max133.8ms. These are different workloads, not a before/after FPS improvement or a five-minute1080p benchmark. Sustained30fps remains unmet.

Comparable but non-identical inland profiles fell from21.38M to13.85M submitted triangles across successive tree changes. The poses differed by several metres and other scene state varied; do not present an exact performance percentage. The first96m-cell experiment increased calls;192m cells reduced that overhead. Source alpha comparison verifies newly covered atlas pixels remain below the existing cutoff. Moving transition and visual inspection support this checkpoint, not imperceptibility at every viewpoint.

At Stanley's entrance the existing world remained playable while optional forest detail loaded. The actual queue reported street ready in2.333s and forest ready in45.602s in this local session; those are detail-job times, not fresh network-load or first-entry timings. A native bike acceleration/brake sequence moved about13.2m and stopped. No first-entry timing guarantee or absence of all decode stalls is claimed.

Local evidence is under ignored `artifacts/local/`: `harbour-draw-profile-{before,after,second,final}.json`, `harbour-stationary-sample.json`, `harbour-walking-sample-final.json`, `forest-streaming-check.json`, test log and screenshots289–295.291 records the rejected overbright glass,292 the sun-direction correction,293 final day gameplay,294 night and295 Stanley cycling. Earlier screenshots are intermediate iterations, not final quality claims.

## Still open

The ordinary gameplay view remains far from the reference photograph or GTA fidelity. Background facade identity beyond1199, fine material response, fountain hydraulic form, street depth, character animation and moving-gameplay performance require further work. The validated source geometry should be retained while remaining draw-call sources are measured. The car-wheel report is a separate follow-up, not solved by this checkpoint.

See source notes for [water](sources/harbour-fountain-water.md), [stone](sources/harbour-fountain-stone.md), [frontage](sources/harbour-frontage.md), [Hastings](sources/hastings-building.md), [building identities](sources/harbour-view-a-buildings.md), [tree submissions](performance/harbour-tree-submission.md) and [streaming](performance/tree-detail-streaming.md). No new paid assets, reference-image textures, interiors or photo-mode features were added.
