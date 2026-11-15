# Howe Street: Granville wing and walking contact

The current pass replaces the repeated heritage facade on mapped building w208599553 with the modern Granville Square Howe wing visible in the independent street reference. The scene remains an approximation and is substantially below the requested GTA 6 / AAA visual target.

## Architecture

The retained six-point footprint receives deep rectangular window reveals, sloped concrete belts, a registered roof split and a pale sign volume. The adjacent tower, parkade and station remain separately owned. Geometry uses 2,910 triangles, six material batches and 203,572 buffer bytes, plus one generated name mask. See [source registration and estimates](sources/granville-square-howe-audit.md).

The first native street view confirmed the modern silhouette improvement and exposed a mirrored sign, corrected before the final check. It also shows a continuing site problem: the elevated Howe roadway hides much of the lower frontage, and the station entry and adjacent ground connection remain unresolved. The borrowed vertical datum is not a surveyed street elevation. This pass must not be described as a completed realistic street.

## Walking contact

The protagonist previously followed the construction surface beneath the finished Canada Place paving. On foot, a bounded triangle index now samples the actual street ribbons and the shared sidewalk masks. The car/construction datum is preserved, and existing pier, bridge and recessed-floor overrides do not get a second finish offset. The index is prepared while loading.

337 points on the arrival route matched rendered road/paving triangles within 0.013803 m; the remaining difference is pavement triangulation interpolation. The saved arrival-court point now adds the rendered 0.15 m finish. The road index contains 5,906 triangles / 212,616 bytes / 127 cells and took about 51 ms to prepare in the local CPU check. These checks do not measure foot animation quality or prove contact across the whole city.

## Renderer experiments

Car reflections reuse two successful existing street captures through independent PMREM derivatives and isolated near/far paint and glass materials. The first full-weight native comparison compiled successfully with 28 unchanged scene captures and no recorded warnings/errors, but made the roof and side body too dark. A reduced blend is capped at 40% local contribution, preserving at least 60% sky. Filtering adds 4.5 MiB atlas/scratch textures and occasional offscreen passes, not additional scene captures. Full lifecycle/source limits are in [the reflection note](sources/car-street-reflections.md).

The static-shadow candidate preserves the native PCF renderer and depth-tests moving casters into a cached static depth map. It is opt-in and costs an estimated 80 MiB plus copy/state-comparison work. First native inspection recorded one static refresh and 349 reused frames, with 879,725 static triangles skipped on reuse and no cache error. This is submission attribution, not a frame-rate gain. The matched A/B/A samples at 1021×839 / DPR1.35 / Balanced / daylight were 15.55, 17.42 and 18.30 fps respectively; p95 was 99.3, 67.0 and 66.7 ms. The first baseline may overlap the tail of focused checks, while the second baseline and candidate were quiet. The candidate did not beat the later baseline, so no speedup is claimed and the default stays off. During a short graded drive, the cache invalidated as needed (79 refreshes / 2,520 reused frames at the final read); no cache error or captured browser warning/error was recorded. This does not establish sustained driving performance or complete shadow parity in all weather/views.

## Verification and remaining work

The final native view confirms readable sign text and a restrained 40% car-reflection blend, retaining the broad roof sky highlight. That blend is enabled in Balanced/High, with preparation included before startup shader warm-up; Low keeps sky-only rendering. Final local driving reached73 km/h, braked to0, exited, walked to(503.71,7.60,−486.42) and fired the pistol15→14. All542 local tests and the final production build pass. Low-quality native inspection showed local reflections disabled, zero car bindings and no filter error; returning to Balanced re-enabled filtering without captured warnings/errors. Release evidence follows in the durable project/board log. [Actual ordinary-gameplay screenshot](screenshots/howe-granville-gameplay.webp).

Next: reconcile one shared section through Howe Street, the wing terrace and lower frontage, and the adjoining PwC floor. Resolve the station pavilion footprint separately; retain the sourced4.28m roof difference and document inferred elevations. Improve glass variation, road/tree contact and character motion. The heavy shadow candidate remains off, and smoothness plus AAA scene fidelity are unachieved. The hotel driveway’s full curve is still unverified.
