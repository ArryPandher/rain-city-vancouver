# Howe podium integration and gameplay checks

## Scope

The Pan Pacific southeast podium now follows the visible hierarchy in MCM's
Handford Canada Place photograph 20: pale columns and capitals, projecting
terrace edges, a recessed pale panel wall, a narrow lower window strip and
divided upper glazing. This is a bounded reconstruction fitted to the existing
source envelope, not a surveyed model. The hotel tower remains an obvious
source of silhouette and facade error and is the next architecture priority.

The photograph is reference only. Runtime textures reuse the credited CC0
mineral maps. Original source remains Codriver/OSM with existing attribution.
No Rockstar content is distributed.

## Runtime integration

- Preflight the unmodified source scene, then extract paving before removing
  the 70 exact source podium triangles. Retain original caps, PIER floor,
  existing retaining walls, other elevations and tower.
- Install four merged opaque roles and one paired glass mesh. The latter has
  two ordered optical draws. Geometry totals 10,806 triangles and 300 panes.
- Capture the southeast surroundings once at 256px. The western capture is
  behind the hotel and is inappropriate for this elevation.
- Gate camera access on the loaded replacement. The old HOTEL and mapped hotel
  relation yield only within the bounded modeled recess; gallery, columns,
  rails, closed backing and end cheeks remain camera obstacles.
- Preserve closed hotel actor access. The separate exterior apron fix uses
  source PIER/HOTEL boundaries and the original visible floor, with exact
  finite-height collision for the visible east rail.

## Problems found through native gameplay

The first candidate incorrectly interpreted the upper gallery as continuous
glazing. It was replaced with pale physical panels. A second retaining skirt
overlapped original PIER wall faces; the added skirt now ends exactly where the
original wall begins. The terrace fascia was increased to a conservative
photo-inferred 0.60m; its top stays fixed and the lower window head clears it.

Walking onto the exposed apron at world `(517.33, -491.45)` put the character
at y7.369 while the original PIER top was y7.878936. The previous public support
masks omitted this area. The correction supplies source-backed y7.88 support;
it does not add a hidden floor beyond the PIER. Existing HOTEL remains solid.
The source edge has a real lip: a nearby arrival crosses a 0.390m step, while
the original diagonal approaches a 0.489m lip and may require a jump.

An attempted public comparison load returned HTTP503 for the Science World
GLB. Asset loading now retries transient HTTP/network failures at most twice,
with 500ms and 1500ms waits. Parse failures, aborts and HTTP404 do not retry.
Tests exercise actual Three.js loader errors. This does not establish a fix
for all slow startup behavior.

## Evidence and limits

Local evidence under `artifacts/local/` includes the rejected and corrected
podium screenshots/profiles, `podium-deck-height-bug.png` and its profile,
`podium-candidate-driving.png`, source contact audits and test logs. Native
candidate driving reached 42km/h, braking reached zero, exit worked and the
pistol counter changed from15 to14.

The final candidate (`index-D93BEesj.js`) loaded in the same Codex tab. Replayed
ordinary movement from the saved podium comparison position reached
`(517.81, 7.88, -492.27)`, then `(520.62, 7.88, -498.90)` with the feet visibly
on the floor. Lateral movement stopped at the visible rail at
`(523.169856, 7.88, -497.801064)`; another 1.5 seconds of held input left that
position unchanged. The normal camera remained clear. Saved native evidence:
`podium-release-apron.png`, `podium-release-rail.png`,
`podium-release-rail-profile.json`, and `podium-release-forecourt.png`.
The profile confirms a valid 256px podium capture; recorded warnings/errors
were empty. The fascia and pale service recess were reviewed from the same
ordinary FOV62 walking view. No special presentation camera was used.

The earlier integrated suite passed730 tests before the apron/fascia follow-up.
Subsequent focused geometry/camera/material tests passed13 checks. The final
source/apron checks include3,060 actual floor rays and complete source rail
bounds. A failed rail-width assertion exposed decoded steel extending beyond
the initial proxy; measured extrema plus6mm tolerance corrected it and the
focused rail rerun passed. The publication workflow supplies final full-suite
validation.
Six base material draws and four opaque shadow draws describe this assembly,
not whole-scene performance. Native view still has substantial visual and
smoothness limitations; this checkpoint is not GTA6/AAA parity.
