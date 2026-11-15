# Canada Place promenade activity

Six of the existing 34 pedestrian slots now belong to the loaded west promenade. They follow a 174.395 m closed circuit along the already validated public deck route, with two lanes 1.4 m apart and rounded ends. The route is authored gameplay circulation, not a claim about observed pedestrian traffic in a Vancouver photograph.

Before assignment, every 0.1 m of the circuit must pass the actual map's support, water and radius-0.4 m collision checks at the existing 7.88 m deck datum. An unavailable or incompatible landmark leaves ordinary city population in place. There is no extra crowd pool, landmark collision exemption or change to deck geometry.

The six identities, route progress and panic/down state survive ordinary recycling and map travel. Nearby player, vehicle and pedestrian bodies stop movement; animation receives actual movement speed so a waiting actor idles. The common walking speed is 1.2 m/s and panic speed 4.8 m/s. This is bounded ambient activity, not a general crowd-navigation system: vehicles or a stationary player can block both lanes, and panic can bunch walkers behind slower people.

Native checks in the single Codex browser confirmed the same six IDs out of 34 before and after Stanley Park fast travel, invisible while far away and visible on return. A person stopped beside the player and resumed after clearance; a parked car stopped approaching walkers; nearby firing produced the existing panic behavior. These checks use ordinary controls and the requested, read-only render diagnostics.

The source-based tests cover the actual mapped route, unsupported-landmark fallback, loop wrapping, player/car clearance, waiting animation, panic/down state, bounded timesteps and pool/identity preservation.

Still-image review caught an inherited 110 mm body lift in the rig. The shared character now places its bind-pose base at the root plane and uses at most 30 actual boot-vertex probes for a bounded 60 mm idle/walk support correction. Full boot-vertex tests over 120 mixer samples for the player, male and female NPCs measured supported soles between -4.8 mm and approximately zero. Running keeps its airborne phase; bike mode restores the previous seating/IK offset. Collision roots and the 7.88 m deck remain unchanged. The native close and third-person views confirm the large hovering gap is gone; this is not full terrain-aware foot IK or gait calibration.

Final local pacing at position (483.070, 7.88, -592.547), Balanced/day, 723 by 670 CSS pixels and pixel ratio 1.35: a quiet 20.0166 s sample recorded 704 frames, 35.17 mean FPS, 33.4 ms p95, 50.1 ms maximum, one frame over 50 ms and none over 100 ms. Diagnostics were collapsed with no inspection or background build during sampling. This is a stationary local sample with dynamic people, not a guarantee of sustained full-screen performance or an isolated speed comparison.

No new runtime models, textures, external services or third-party reference images were added for this activity pass. Existing character licenses and provenance remain in the asset records. Realism remains limited by character materials, gait, contact lighting and the surrounding architectural detail.
