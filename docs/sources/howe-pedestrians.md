# Howe frontage pedestrian routes

Implementation candidate, 2026-11-15. Ordinary browser walk/drive acceptance remains a separate root task.

## Existing source and defect

The approved local scene is the roughly 74 m Howe section between `(451,-417)` and `(495,-476)` in `artifacts/local/howe-scene-brief.md`. No new image, model or external source was fetched for this change.

The imported `public/data/vancouver-roads.json` describes Howe ways `w232195213` and `w1255990033` with `foot: true` and `sidewalk: none`. Separate mapped footways describe the adjacent pedestrian circulation. The ordinary population filter consequently excludes these Howe road shoulders and samples other walking ways throughout a 240 m radius; it provides no stable frontage coverage. The mapped western footway `w1194852096` also largely falls outside the current raised Canada Place approach support. Copying that footway onto the ramp would give it the wrong elevation or send it through the support edge/rail.

The existing `createCanadaPlaceSite` supplies a road buffer with a 3.5 m sidewalk allowance and subtracts building footprints. `canadaPlaceApproachGeometry` subtracts the union of all street and service carriageways, then renders the supported shoulder finish at `supportHeight + 0.15`. The source service driveway `w251586099` crosses the western shoulder near the middle of the scene. This implementation preserves that driveway, the authored grade, existing collision and all source road positions.

## Bounded population

`src/game/howe-pedestrians.ts` derives two short walking loops from metre stations along the two imported Howe ways. The center follows the west shoulder at `roadWidth / 2 + 1.7 m`; two directions are 1.1 m apart with rounded ends. These placement dimensions and turning points are gameplay estimates within existing supported public paving, not surveyed circulation or a claim about actual pedestrian counts.

| Loop | Imported way stations | Length around loop | Existing rigs |
|---|---|---:|---:|
| PwC-facing southern shoulder | `w232195213`, 18–49 m | 65.45 m | 2 |
| Northern shoulder beyond service driveway | `w1255990033`, 23–40 m | 31.66 m | 1 |

The three assignments take slots immediately after the six existing Canada Place promenade walkers. The overall pool limit remains 34. The player receives normal characters, animation, panic/down behavior, rendering distance and physical vehicle-contact bodies. The routes survive recycling and fast travel with the same actor identities and world progress. They do not cross the road or service driveway, enter a lobby, or pretend that a fixed pose is walking activity.

Every loop is validated before assignment against the loaded support, complete radius-0.4 body clearance, buildings and guard barriers, water, road/service carriageways and continuous grade. If either route is unavailable, normal population remains the fallback. Initial placement scans the same loop if a real parked vehicle already occupies its desired phase.

Feet follow collision grade plus the verified approach walking finish. At runtime, actors sweep their next travel in steps no larger than 0.1 m. They yield to player/other pedestrian bodies and to the existing vehicle center/nose/tail capsule shapes swept over the vehicle's next 0.65 seconds in either travel direction. Actors on another vertical level do not block them. Waiting and down actors produce zero gait speed. Player driving/contact code is unchanged. Waiting for an obstructed sidewalk is intentional; this is not a general navigation or traffic-AI rewrite.

`Actors.howePedestrianSummary()` reports route, stable object ID, world distance/position, speed, state and visibility for read-only browser diagnostics.

## Verification

Focused run: `tsx --test tests/howe-pedestrians.test.ts tests/canada-place-pedestrians.test.ts tests/vehicle-pedestrian-contact.test.ts` — 20 tests passed.

- 972 samples at 0.1 m spacing clear loaded buildings, guard barriers, streets and the actual service driveway. Feet range from 0.80 to 7.02 m; the grade is retained.
- Downward raycasts into the actual generated approach pavement triangles match the expected foot height within 0.02 m at points around both loops.
- A new trunk obstruction, missing support or incompatible grade disables assignment.
- Parked nose/tail overlaps and approaching forward/reverse vehicle sweeps cause waiting. A lower-level vehicle does not stop these walkers.
- Panic travel cannot skip a body between endpoints; down/corrupt/large steps remain stationary; recycling preserves the three identities and ordinary contact bodies.
- Existing Canada promenade and player vehicle/pedestrian contact regressions passed in the same focused run.

This validates route legality and code behavior. It does not yet establish ordinary-frame visibility, natural appearance, sustained browser frame pacing, feet animation contact through a complete walk, or the full scene's walk/enter/drive/exit acceptance. Those require the integrated browser round trip at the brief's normal HUD, FOV and 13:24 daylight.
