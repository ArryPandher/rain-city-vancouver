# Browser quality assessment and review brief

2026-11-14. Reviewed against game release `5995f9d532a52e3f7aa3dc43e5c8b35ee2b77be9`.

Current November 15 direction is recorded in [Realism workflow](REALISM-WORKFLOW.md):
GTA 6 is the realism reference for Canada Place/Howe Street first, Robson Square
and the Art Gallery second, then the Ironworkers Memorial Bridge. Finish one or
two standout scenes before expanding, with ordinary daylight third-person
walking, driving and shooting as the review scope. The release-specific
measurements and earlier region order below remain historical evidence.

## User direction

- Browser-only is essential. A native Unreal application is not the deliverable.
- GTA VI remains the visual reference; Arry wants to work toward at least GTA V quality, starting with a few more convincing regions.
- Preserve the existing Vancouver map and requested walking, car, bike, gun and NPC features. Prioritize a few exceptionally convincing regions in ordinary gameplay. Interiors and new photo-mode features are not priorities. Arry wants driving/shooting clips and near-photographic correspondence to real Vancouver viewpoints.
- Use only the existing Codex in-app browser for this project, as Arry explicitly clarified. Keep one game instance. Chrome is no longer the test surface. The Codex browser still uses local RAM/GPU.

## Honest assessment

The current game is a playable independent prototype, far below either GTA V or GTA VI production fidelity. Continuing small procedural-detail passes alone is not an evidence-based path to parity. There is no defensible completion percentage: feature presence, visual quality, performance and production depth are different measures.

The tools can edit and profile the browser renderer, generate/process geometry and textures, obtain properly licensed assets, run deterministic tests, inspect real rendered frames, exercise controls and publish a shareable build. They do not supply a finished art library, artist team, unlimited GPU performance or a guarantee of matching a major studio. Switching models alone does not establish visual quality.

## Evidence at the current release

| Area | What is established | Gap |
| --- | --- | --- |
| Geography | Real OSM streets/footprints; City tree data and contour-derived terrain; recognizable landmark work | Approximate buildings, terrain and generic storefront assignment; no citywide surveyed reconstruction |
| Controls | Native browser walking, car/bike acceleration and braking, entry/exit and three weapons pass | Basic game feel and animation; passing controls does not establish AAA polish |
| Rendering | PBR materials, HDR lighting, shadows, reflections, detailed foliage and custom landmarks | Inconsistent asset/material quality, flat or generic facades, occasional detached-looking geometry and weak scene coherence |
| Performance | Final public photo samples 19/16/31 fps (day/High-night/Performance); last active gameplay observation 11 fps | No sustained target frame rate; samples are not a controlled whole-game benchmark |
| Reliability | 134 tests, production build, CI and release hash checks pass | Tests do not measure resemblance to real Vancouver, visual appeal or AAA production quality |

The 116.38 m public test route needed native-key corrections, with initial timed under-travel up to 11.43 m. Source `Game.frame` caps elapsed simulation time to 0.05 seconds, which loses real elapsed time below 20 fps. This is a concrete timing issue to examine with controlled tests, alongside reducing rendering cost. Do not attribute every route error solely to that cap without isolating it.

Recent medium-tree work reduced each tree from 206,013 to 95,375 triangles while retaining better canopy coverage. The pre-shadow-callback local walking comparison improved only modestly (~19.53 to 20.12–20.39 fps). It is useful progress, not evidence that the overall visual target is close.

## Prioritized high-fidelity regions

1. **Coal Harbour / Canada Place / Harbour Green.** Establish a coherent harbourfront district: grounded buildings, accurate roof/entrance shapes, convincing close facades, seawall surfaces, vegetation, water and distant silhouettes. Start by identifying the detached-looking West Cordova piece and validating generated roof planters against actual roof footprints.
2. **Robson Square / Granville.** Civic terraces and gardens, theatre/storefront identity, street furniture and believable pedestrian-scale lighting/materials.
3. **A Stanley Park seawall section.** Forest edge, coastal rock, water contact, path texture scale, vegetation variety and a convincing continuous bike route.

Arry reaffirmed that making a few of these regions convincing is the immediate goal. Keep the wider map usable while improving the priority districts. Finish and evaluate the first region before spreading the same unresolved visual problems across all three. Use the concrete references and route in [Coal Harbour visual gates](COAL-HARBOUR-VISUAL-GATES.md).

## Region acceptance gates (proposed working targets)

- A repeatable walking/driving/cycling route with fixed camera checkpoints, daylight captures, and matching Vancouver reference photographs. Judge real scale, skyline, street identity and materials at normal gameplay height. Nighttime expansion is deferred under the updated goal.
- Continuous moving gameplay is the acceptance artifact, supported by stills. No floating structures, visible ground gaps, abrupt dominant detail transitions, obvious texture stretching or scenery obstructing the intended route.
- Establish one target laptop, resolution and quality preset. First require sustained 30 fps at 1080p on the agreed device, with 60 fps as a stretch target. Record frame-time distribution and stalls over a repeatable five-minute route; do not substitute a single fps counter or photo-mode sample.
- Record peak memory, initial-load duration and repeat-route growth. Run one game instance. Check that reused scene assets and streaming/LOD choices fit a bounded resource budget.
- Character movement, camera, vehicle response, aiming and sound must support the same presentation quality. Treat unnatural motion or frame-dependent movement as visible quality defects.
- Preserve actual provenance and license information. Reference GTA images for direction; do not distribute Rockstar assets. Do not promise the gates are met until captures, measurements and review support it.

## Rendering and asset strategy

Prioritize coherent, well-authored assets and fewer unnecessary submissions: spatially bounded near scenery, useful mesh detail at the actual screen size, shared materials/instances, and progressive loading. Compare improvements against identical views/routes. Evaluate WebGPU only as a measured experiment with an agreed browser/device matrix; it is not an automatic realism upgrade or a reason to discard the working WebGL version.

The current local data volume is a constraint: the Data volume had about 254 MiB free during this assessment. Large new texture/model downloads need storage planning first. No new paid service or remote GPU browser has been provisioned. A suitable remote browser could offload functional checks, but its WebGL/WebGPU support and GPU performance need verification and would not prove performance on Arry's laptop.

## Independent reviewer brief (Claude or another reviewer)

No reviewer has been contacted or launched by this assessment. An independent review is recommended because the project needs a fresh visual and architectural critique.

Review the running build and actual screenshots, `docs/VISUAL-REFERENCE.md`, `src/world/architecture.ts`, `src/world/detailed-trees.ts`, `src/main.ts`, and `docs/performance/`. Identify the five largest visible gaps to a GTA V-inspired harbourfront scene. For each, name the asset/code cause, a concrete intervention, expected resource tradeoff and an observable acceptance test. Challenge the browser strategy and frame budget; do not use test counts or raw map size as proxies for quality. Recommend one coherent district plan before proposing additional citywide decoration.

The current build remains available at https://arrypandher.github.io/rain-city-vancouver/. The first priority is a convincing, performant Coal Harbour region; broader AAA parity remains unproven.
