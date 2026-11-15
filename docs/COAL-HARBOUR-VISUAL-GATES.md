# Coal Harbour matched-view and moving-gameplay gates

2026-11-14. Working benchmark, **not an achieved resemblance claim**. The user wants moving driving/shooting clips and scenes that almost match real reference photographs. A clean PNG export, more detail objects, or passing control tests does not establish either result.

## Evidence and reference limits

This review inspected the actual local photographs below, `current-preview.png`, `281-public-tree-day.png`, `281-public-tree-night.png`, and the older `250-harbour-fountain.png` / `250-harbour-shore.png` captures. The 250 captures establish an earlier composition and recognizable features; they are not current-release matched frames. No new runtime route or matched photograph was captured for this document.

Both selected references are pedestrian-height photographs from the existing Darwin Construction set. They reveal architectural and landscape relationships more usefully than the available aerial views. Source provenance is recorded in `artifacts/local/harbour-green-reference/photos.json`, `sources.json` and `docs/sources/harbour-green.md`. They are historical photographs: do not reproduce old construction cranes or infer current tenants from them. Reference photographs remain local reference material, not game textures or distributable release assets.

Coordinates below are game metres, `(x,z)`, not surveyed camera locations. Game yaw is `atan2(deltaX, deltaZ)` in radians: 0 looks south (+z), pi/2 east (+x). Set camera y to the current collision ground height plus 1.65 m; never use a high photo-mode viewpoint to conceal foreground defects. Suggested poses are starting estimates grounded in mapped features and previous capture poses. Refine once against the source, record the final pose/FOV, then freeze it for subsequent comparisons.

## View A — fountain, Bute stairs and city frontage

- Local photograph: `artifacts/local/harbour-green-reference/photo-4.jpg` (840 × 520).
- Original image: <https://www.darwinconstruction.ca/assets/Projects/harbour_green/harbour_3_840x520.jpg>.
- Original project page: <https://www.darwinconstruction.ca/projects/development/harbour-green-park-1>.
- Start near `(-80,-801)`, looking inland at `(-104.53,-757.17)`, yaw approximately **-0.51**, near-level pitch. Use a camera FOV equivalent to a 35 mm lens for a controlled reference capture; match perspective by moving the camera before fine-tuning FOV. Preserve the original 21:13 aspect when comparing, or apply the same explicitly documented crop to both images.
- Grounding: fountain way `w223936055`, Bute stair way `w48271068`, and `fountainWorld()` in `src/world/harbour-green-site.ts`. The stair lower point is `(-101,-763.26)`, middle `(-104.53,-757.17)`, upper `(-112.45,-743.66)`. Earlier capture script `artifacts/local/capture-harbour.py` used `(-70,8,-807)`, yaw -0.47; its eight-metre altitude is unsuitable as the final pedestrian benchmark.

Align the foreground bench silhouette and pale paving bands, paired capped stone piers, width and depth of the wet fountain pad, central stair axis, low terrace/pergola frontage and tower silhouettes behind it. These features must occupy comparable parts of the frame simultaneously; matching only the fountain centre is insufficient.

Visible/established gaps:

1. The reference's dark, continuous terrace/pergola/restaurant frontage across the stair landing is a dominant middle-distance feature. The older game capture leaves this area largely open, and `docs/sources/harbour-green.md` explicitly records detailed pergolas and restaurant frontage as unreconstructed. This is a scene identity gap, not a texture-resolution issue.
2. Reference water is a thin reflective wet surface with misty, varied jets. The existing view uses pale, opaque-looking water and discrete white bead arcs. Compare the pool surface, jet scale, spray opacity and reflections at walking height before adding more jets.
3. Stone pier proportions, stair enclosure, foreground paving bands and benches form a strong depth sequence in the photograph. Existing elevated captures cannot prove those relationships at eye level. The current park screenshots also show flat-looking turf and abrupt hardscape transitions.
4. Generic grid-faced background buildings remain visibly interchangeable. `docs/sources/harbour-towers.md` provides ASPAC tower provenance, but the whole background in this view must be identified before claiming a location match; do not replace every tower with a random more detailed facade.

First meaningful art milestone: reconstruct the missing middle-distance terrace/frontage and its relationship to the existing stair/fountain axis, using additional verified reference interpretation if needed. Do not claim it is completed by the curb or roof-planter fixes.

## View B — harbour promenade toward the convention centre

- Local photograph: `artifacts/local/harbour-green-reference/photo-5.jpg` (840 × 520).
- Original image: <https://www.darwinconstruction.ca/assets/Projects/harbour_green/harbour_4_840x520.jpg>.
- Original project page: <https://www.darwinconstruction.ca/projects/development/harbour-green-park-1>.
- Start near `(-158,-855)`, yaw **0.98**, near-level pitch, eye height ground + 1.65 m. Start with a 35 mm-equivalent camera FOV for comparison; refine to place the waterfront edge on the left and bench/tree line on the right. The prior `capture-harbour.py` shore pose used exactly this x/z and yaw with absolute y=3 m, making it a grounded initial estimate rather than a claimed solved camera.
- Grounding: `HARBOUR_COAST` and the inset promenade generated in `src/world/harbour-green.ts`; nearby mapped cycleway `w85240509` runs through `(-170.07,-855.87)`, `(-164.34,-850.91)`, `(-135.18,-828.78)`, `(-119.25,-817.51)`, `(-92.39,-801.03)`. Use the separate waterfront pedestrian promenade for the final eye-height pose, not the cycleway centreline.

Align the curving water/stone boundary, foreground pier and transverse pale paving band, usable promenade width, repeated benches on the raised lawn side, lamp height and spacing, tree-trunk rhythm, and skyline framing. The source predates completion of nearby construction: its cranes/building works are excluded from architectural likeness acceptance, and that exclusion must remain explicit beside any comparison.

Visible/established gaps:

1. The older game shore view has an almost razor-thin water edge; the photograph has exposed shoreline stone, substantial coping and terminating pier forms. Inspect these at changing eye positions and tides/lighting represented by the game; a top-down shoreline outline is insufficient.
2. The game paving reads as a large repeated herringbone field and longitudinal stripe. The photograph has differently scaled paving with deliberate transverse bands and edge relationships. Match layout and metre scale before increasing resolution.
3. Benches, low retaining edge, lamps and trees form a tightly coordinated pedestrian corridor in the photograph. The older game scene has much wider empty intervals and very tall, visually repetitive vegetation. The latest 281 park images improve foliage but do not verify this promenade composition.
4. The reference's harbour surface and skyline produce layered depth. The older game water is uniformly bright with little contextual reflection. Assess water response while moving laterally, rather than accepting a single attractive sun-glint frame.

First meaningful art milestone: one continuous, correctly proportioned shoreline/paving/bench/tree corridor spanning this viewpoint and the fountain approach. Avoid isolated objects that look correct only from the fixed camera.

## Shared visual decision gate

For each view save the source link, original dimensions, exact game commit, final x/y/z/yaw/pitch/FOV, weather, viewport, preset and exported dimensions. Capture the same camera after every material geometry change. Present the source and game at the same aspect and scale, with no perspective warp or selective removal of mismatching game content.

- Geometry: select at least six persistent landmarks in each source (pier corners, stair ends, path intersections, tower edges). First align perspective and relative scale; then review remaining silhouette and position errors. Record errors as annotations, not a fabricated resemblance percentage.
- Materials/light: inspect wet/dry separation, concrete/stone roughness, glass depth/reflection, plant luminance and sun/shade relationships. Matching a photograph's weather approximately does not excuse mismatched structure.
- Ground contact: no floating roofs, pavement/tree intersections, exposed terrain gaps or detached facade parts in either stationary frames or the moving corridor.
- User judgment: the final acceptance question is whether the location almost matches the real reference and remains convincing in motion. No automated metric or test total substitutes for that review. Status of both views: **unmatched; new pedestrian-height captures and substantial scene work required**.

## Short connected gameplay clip

Record a continuous 2–3 minute daytime clip in the browser with native controls and game sound. Keep the wider game active. One-time setup before recording may place a car at the start; no teleport, free-camera movement, cuts, speed changes or hidden frame interpolation within the acceptance take. If recording must be split, label the segments honestly and retain an uncut route artifact. A PNG export is supporting evidence only.

1. **Drive and brake:** start on West Cordova near `(-244.9,-748.6)` and travel east/northeast through `(-198.7,-716.4)` to the Bute junction `(-156.9,-692.4)`, then toward `(-126.7,-677)`. These are centreline points from `public/data/vancouver-roads.json`, ways `w1257116936` and `w1257116937`, not exact lane poses. Use the correct travel lane, show steering, braking to a complete stop and a normal vehicle exit. Do not substitute driving on the park cycleway as evidence of a convincing street route.
2. **Walk into the park:** navigate from the parked car to the upper Bute landing near `(-114.2,-740.7)`, descend toward `(-101,-763.26)`, and reach the fountain's seaward approach near `(-87,-796)`. Those stair-route anchors appear in the existing `check-harbour-play.py`; the street-to-landing connection still needs a live clearance check. Show stair transitions, the fountain frontage and approximately View A without entering photo mode.
3. **Walk and shoot:** continue toward the waterfront path, show third-person locomotion and aiming, then fire several shots toward a visible in-game test surface/target where recoil and hit response can be observed. Keep the target and response in frame; record weapon, ammo change, sound, muzzle response and impacts. Do not claim shooting fidelity from an ammo counter alone. Reposition normally if scenery obstructs the line of sight.
4. **Promenade:** follow the connected waterfront walkway from the fountain toward the View B vicinity `(-158,-855)`, turn back east and walk briefly toward the convention centre. Show both ground-contact detail and the skyline during movement. A fixed matched still at each view supplements this clip.

Exact parking, entrance connector, shooting target and total route duration remain to be validated in the current build. Read those as planned acceptance actions, not completed tests. Capture a nighttime follow-up after the daytime route is coherent; darkness must not be used to hide unfinished geometry.

Record target laptop/browser, resolution/preset, frame-time distribution and stalls during the clip, and errors/route interruptions. The existing working target is sustained 30 fps at 1080p; a short clip or instantaneous FPS counter cannot establish the separate five-minute performance gate in `docs/QUALITY-ASSESSMENT.md`. If performance falls short, retain the footage and report the actual result. Never label a visually improved but stuttering take as accepted.

## Current implementation candidate

The first candidate now includes bounded curbs/gutters, supported roof planting, close-cut Harbour Green lawn materials and an original interpretation of the flanking Bute terrace frontage. These are awaiting final rendered acceptance. The historical gaps above remain the reference baseline, not a claim that the newly added geometry already matches. Arry explicitly declined new photo-mode work; validation prioritizes ordinary walking, driving and shooting.
