# Prepare local reflections at the actual starting scene

Previously main.ts iterated every World reflection specification during startup,
passing each distant probe position as the viewer to force its capture. The saved
world contains 39 probes, so entering one neighborhood waited on other regions'
cube rendering and filtering. This change prepares only initially nearby dirty
probes using the real, already placed player. It does not reduce scene geometry,
probe resolution, material quality, capture contents or steady-frame rendering.

## Selection and lifecycle

`startup-reflections.ts` shares the original strict horizontal distance <180 m
predicate with `SceneReflections.update`. Height is deliberately excluded, so a
tall building's nearby receiver is handled as before. Source order is preserved.
No distant receiver is made eligible by moving the synthetic viewer to its probe.

The initial nearby count bounds startup attempts. After each awaited loading-stage
yield, live quality, position and the first eligible dirty probe are rechecked.
A moved player, intervening lazy capture or low-quality selection cannot cause a
stale queued capture. Each probe is attempted at most once; capture-callback
invalidation leaves it dirty for the existing lazy path instead of spinning in
startup. Capture itself is synchronous and retains the original generation,
visibility, sun, shadow, renderer-state and failure restoration logic.

The normal render path is unchanged: when the intro is closed and quality is not
low, it calls update before the beauty render, using player or photo position.
Fast travel moves that position and resumes play, so its first normal render can
prepare one nearby dirty probe; following frames prepare others. This can still
cause a one-capture hitch on first arrival in a new region. It is deferred work,
not free work. There is no new asynchronous capture job or background mutation.

## First-frame fallback and borrowers

Uncaptured materials retain envMap=null, so Three's existing scene environment is
used. No empty cube target is assigned, no surface hidden and no opacity changed.
Nearby initial receivers are captured before shader warmup and the first title
frame. The existing full sky remains for visible distant receivers. Weather /
daylight invalidation continues to clear maps and recapture the current region.
Low quality skips startup capture and keeps its existing invalidation/sky behavior.
The existing vehicle borrowers accept only completed current-generation textures;
absent local PMREMs keep their native sky contribution rather than black maps.

No new assets, probes, targets, texture resolutions, lights or World geometry are
introduced. The original 39 target descriptions are still constructed; GPU render
target allocation is lazy. This is a bounded capture-scheduling improvement, not
scene-bounded world preparation or a claim of reduced steady-frame GPU work.

## Evidence and native comparison

Profile `lighting.startupReflections` reports total probes, initially nearby dirty
probes, attempted and successful captures performed by this preparer, and remaining
dirty probes. Captures completed by a different update during a loading yield are
not misreported as this preparer's work. Existing startup timing records remain.
The exact current-world nearby count and saved wall time require native capture;
no 39-to-N count or performance gain is inferred from synthetic tests.

Eight focused tests use the actual SceneReflections implementation with controlled
cube submission. They cover strict radius/source order, sky/receiver map lifecycle,
first distant arrival, weather invalidation, low quality/upgrade, movement or
quality changes across yields, generation invalidation, capture failure and an
intervening update without duplicate work. The main startup/render wiring is also
checked. Existing probe lifecycle and actual E30 vehicle-borrower tests remain.

Native acceptance: compare the same default Canada Place startup with identical
quality/weather and cache state; record per-stage times and the new counts. Verify
near panes and car paint on the first title/game frame, then fast travel to Gallery
and back, including one photo-camera move and daylight change. Watch for black
panes, missing surfaces, obsolete lighting or repeated capture errors. Attribute
any waiting reduction to startup only; no steady FPS claim follows. No browser,
full build or push was performed for this candidate.

## Native counter verification — 2026-11-16

Root reviewed the combined startup-selection + Cathedral candidate. The saved
`artifacts/local/nearby-startup-native-profile.json` verifies 40 total probes,
16 initially nearby, 16 attempts, 16 successful startup captures and 24 still
dirty/deferred. Thus this build actually prepared only its 16 nearby probes;
24 remote captures were avoided during startup, rather than merely renamed.
The additional probe versus the earlier build belongs to the changed world.

| Observed stage metric | Earlier 8e world | Combined nearby candidate |
| --- | ---: | ---: |
| Reflection preparation stages | 39 | 16 |
| Sum of reflection-stage wall time | 6,844.6 ms | 5,620.7 ms |
| First capture synchronous invocation | 4,822.7 ms | 4,645.7 ms |
| Startup ready timestamp | 39,821.3 ms | 36,691.9 ms |

Earlier evidence is `artifacts/local/canada-east-terminal-apron-profile.json`.
The observed reflection-stage difference is 1,223.9 ms; the first candidate
capture still consumes 4,645.7 ms synchronously (4,650.8 ms including its stage
yield), dominating the remaining reflection wait. Reducing the number of captures
therefore delivered a modest observed reduction, not a proportional 39/16 speedup.
These sequential wall times are not GPU timings. World geometry changed between
builds, and this was not a controlled same-head/cache A/B; the 3,129.4 ms difference
in overall ready timestamps cannot be attributed solely to reflection scheduling.

After ordinary map travel to Gallery, saved
`artifacts/local/nearby-startup-gallery-travel-profile.json` reports 18 completed
captures, up from 16, confirming deferred nearby preparation through normal play.
The root's native review found valid appearance and empty error logs; saved car
reflection filter error is null. This provides first-arrival evidence, not a claim
that every deferred region or weather/quality combination was natively exercised.

No FPS, steady-frame, GPU-memory or RAM improvement is claimed. Remote work can
still cause first-arrival capture hitches. No further optimization is included in
this evidence-only update.
