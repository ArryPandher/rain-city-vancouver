# Robson public-path walkers

Integrated into the existing Actors pool in c603fa8. Native review below uses the built 8cce82b candidate. No new model, texture, animation, road or collision geometry.

## Source and registration

`public/data/vancouver-roads.json` supplies OpenStreetMap footway `w749560067` (existing project ODbL attribution). Clip its actual straight middle segment at Gallery-local v 37 and v 49 using `galleryStairLocal`, rather than copying approximate world coordinates or inventing a connection. The source middle segment runs from local (-0.49321265,60.54985485) to (0.18924534,30.00751945). The mapped width is 1.8 m. The module rejects a missing, forbidden, too-narrow or differently positioned source way.

Two lanes ±0.48 m around that centreline join with 16-segment semicircular ends. Including a 0.4 m pedestrian body requires 0.88 m of the mapped 0.9 m halfwidth. The 27.017 m circuit occupies approximately local v 36.52–49.48, ending more than 3 m before the stair foot at v 33.37. It is east of the corrected west terrace, whose street-facing edge is u−4.85. It does not enter either terrace, stairs, service recess, roadway or building. This is a gameplay walking circuit derived from the public map, not a claim that real people follow an oval.

## Actors integration contract

- Reuse **three existing rigs at pool indices 9–11**, immediately after six Canada and three Howe allocations. Keep `PEDESTRIAN_POOL_LIMIT=34`; remaining generic walkers 22. Ironworkers source-route adapter remains unchanged.
- Cache `createRobsonPedestrianCircuit(collision)`. Null means retain generic placement; do not create an invented fallback circuit.
- `robsonPedestrianAssignment(circuit, slot 0..2)` returns phase/distance and pace. `findRobsonPedestrianSpawn` searches for a clear nearby phase on the same circuit, checking other pedestrian bodies/player and current vehicle capsules. Undefined means do not spawn the fixed walker there.
- Store distance/pace/speed on the existing pedestrian. Use `robsonPedestrianPoint` and `robsonPedestrianHeight` for initial/down placement. Height calls existing `walkingHeight(x,z,0)`; full-city verified foot height is 0, not the Canada 7.88 m deck datum.
- Call `advanceRobsonPedestrian(circuit,{distance,pace,panic,down},dt,collision,bodies,vehicles)` in the existing update loop. It returns x/y/z, tangent heading, wrapped distance and **actual world displacement/dt**. Blocked/down/invalid ticks return speed 0. Keep existing heading easing and `Character.update(timer,next.speed,false)`; no animation changes or extra rig load.
- Skip fixed Robson walkers in generic recycle, as for Canada/Howe. Preserve existing 190 m visibility, down timer/recovery and nearby-rig collision collection.
- Use existing `PedestrianBody` data (including the player) and `RobsonVehicleObstacle` (ContactPose plus car/bike kind and signed speed). Existing finite vehicle capsules are swept over 0.65 seconds to yield to approaching/reversing vehicles. This only stops the pedestrian; no driving changes.

## Contact and cost

Construction validates the full circuit every 0.1 m against current loaded collision, water, complete body footprint support and all nearby mapped carriageways including service roads. Runtime sweeps movements at ≤0.1 m, checks height continuity and rechecks finite source geometry and dynamic bodies. Any changed obstruction makes walkers wait; they never jump to an unverified path. A 0.25 m maximum ground-level envelope explicitly rejects terrace/seat snapping. No source arrays are modified.

Only 34 route points and lengths, three existing actors, no render batches or new asset bytes. Vehicle yielding uses the same physical contact capsules as existing actor systems. The runtime road list is spatially bounded during construction; it does not scan the whole city every frame.

## Validation and limits

`tests/robson-pedestrians.test.ts` loads the same complete public city layers, including terrain, as production. 271 route samples verify actual 1.8 m footway containment, current world ground y0, no blocked/water points and clearance from **all** loaded carriageway segments. All three phased walkers complete two laps under mutual yielding. Tests cover blocked/closed/narrow/missing source, invalid/down ticks, car, bike and body yielding, elevated-body separation and occupied spawn alternatives.

The ordinary local u 0.8 approach from v 51.3 to 33.45 and 4.3 m chase boom stay clear of fixed geometry, including the corrected west edge/stair mouth. NPCs intentionally occupy public walking space and yield to the player; this is not a guarantee that every camera ray through a moving character is unobstructed. Native composition and central allocation were checked below; the existing character art and animation remain far below the AAA target.

## Native candidate review — 2026-11-16

In the existing Codex browser at its native821×839 viewport and pixel ratio1.35, the ordinary Gallery arrival showed three clothed walkers on the mapped approach. Diagnostics confirmed totalPool34, sourcew749560067 and circuit27.017m. After the player walked forward to(-60.41,0,43.16), then stepped aside to(-57.25,0,46.33), all three resumed walking at1.08/1.16/1.12m/s. Their earlier waiting states therefore recovered without respawn or a route override. Foot placement and alternating walking motion were visible. No captured browser warnings/errors.

Evidence: `artifacts/local/gallery-pedestrians-arrival.png`, `gallery-pedestrians-passing.png` and `robson-pedestrians-native.json`. This verifies one ordinary passage and recovery, not every possible crowd configuration or animation quality. Same-rig allocation tests and existing collision/yield tests cover the separate bounded cases. Public deployment verification remains a distinct release step.
