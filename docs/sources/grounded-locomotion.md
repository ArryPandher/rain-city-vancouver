# Grounded locomotion

2026-11-15. Implementation checkpoint: `c22a329`. **Native checks passed for the movement and regression cases recorded below.**

The change reuses `rain-city-protagonist.glb` and `rain-city-pedestrian.glb`; no assets were added or modified. Their CharacterCreator/MakeHuman provenance and CC0 license record remain in `public/asset-manifest.json` and [CHARACTER-ASSET-LICENSE.md](CHARACTER-ASSET-LICENSE.md). Both loaded rigs contain compatible channels for `idle`, `walk`, `run`, `walk_back`, `strafe_left` and `strafe_right`.

## Resolved travel and direction

`src/main.ts` now derives player planar velocity and distance from the positions before and after `CollisionWorld.move`. Requested movement no longer drives full walking animation and footsteps when a wall prevents travel. The existing grounded-only footstep threshold remains 0.85 m, with its accumulator reset after a step; airborne travel contributes no footstep distance. Movement speeds, collision resolution, facing controls and shooting are unchanged.

`src/game/locomotion.ts` projects resolved velocity onto the character's current facing:

```text
forward = vx × sin(yaw) + vz × cos(yaw)
left    = vx × cos(yaw) − vz × sin(yaw)
```

Positive local X means **left** in the rig and existing A/D controls. For grounded armed/aimed movement, adjacent forward/backward and lateral clips receive weights `abs(component) / (abs(forward) + abs(left))`. A 45-degree diagonal is therefore a 50/50 blend; backward diagonals blend backward walking with the appropriate strafe. Weights vary continuously across direction boundaries and approach their targets by `1 − exp(−18 × dt)`, completing about 96% of a transition in 180 ms. Holstered movement retains turn-to-travel and forward walk/run selection. Missing optional directional clips fall back to walking.

## Source-measured contact phase

Moving clips share one normalized stride clock, sampled with the offsets below. The clock is not reset when movement changes direction or switches between walk and run. Idle retains a continuous independent clock, initially staggered by `(variant × 0.173) % idleDuration`. Phase offsets follow the actual loaded rig, including the existing male-template fallback.

The direct tests load both committed GLBs, normalize height to 1.84 m for comparison, select the lowest actual boot vertex in each foot's 3×5 sole grid (30 probes per rig), skin those vertices at 120 evenly spaced phases and compare which foot has the lower sole. Samples where either clip's left/right difference is within 5 mm are excluded as ambiguous double support. Offsets align lower-foot transitions, rather than peaks in swing height. This ordering is a contact proxy, not proof of world-space foot locking.

| Clip | Male offset (cycles) | Female offset (cycles) | Male agreement | Female agreement |
| --- | ---: | ---: | ---: | ---: |
| walk | 0 | 0 | 112/112 | 86/86 |
| run | −0.100 | −0.125 | 112/112 | 86/86 |
| walk_back | +0.025 | 0 | 79/79 | 79/79 |
| strafe_left | 0 | 0 | 85/85 | 84/84 |
| strafe_right | 0 | 0 | 85/85 | 84/84 |

## Validation and limits

All **18 focused checks passed**, along with TypeScript and diff checks:

```sh
npx tsx --test tests/locomotion.test.ts tests/animation-pose.test.ts tests/character-grounding.test.ts tests/character-bounds.test.ts
npx tsc --noEmit
```

Coverage includes blocked walking settling to idle without footsteps, actual tangential travel along a rail, pure directions/diagonals, continuous weights, loaded clip bindings, contact-phase agreement, full boot-vertex grounding during armed diagonal blends, finite hand posing, and existing pose/grounding/bounds checks.

There is no new foot IK or terrain-aware foot planting. The existing body-height correction remains; footsteps are distance-triggered rather than heel-strike events. No jump/fall/land clips were enabled, and airborne selection and bicycle posing retain their existing behavior. No quantified comparison of foot sliding was performed.

With `?debug`, **Profile one frame** includes a `locomotion` record: actual speed, grounded/armed/aiming state, available clips, weights, target weights, phase and the last nonzero movement sample. Movement-history recording is debug-only; no gameplay UI was added.

## Native acceptance

The `c22a329` preview was checked in the same existing Codex browser tab with the actual loaded male rig. The movement profiles below were received after key release; their `lastNonzeroMovement` records preserve the moving state, while the current state had returned to idle. Weights are rounded here.

| Native input | Resolved speed | Moving clips and weights | Local evidence |
| --- | ---: | --- | --- |
| Backward | 3.2 m/s | `walk_back: 1` | `artifacts/local/locomotion-native-back.json` |
| Left | 3.2 m/s | `strafe_left: 1` | `artifacts/local/locomotion-native-left.json` |
| S+D, backward-right | 3.2 m/s | `walk_back: 0.5`, `strafe_right: 0.5` | `artifacts/local/locomotion-native-diagonal.json` |
| Shift+W | 6.8 m/s | `run: 1`, clip phase −0.1 cycles from the shared clock | `artifacts/local/locomotion-native-run.json` |

A separate held-input check pressed D into the frontage. The profile arrived **6,243 ms into a requested 10,000 ms hold**, before release: position remained `[424.77725158542654, 8.936797704083641, -390.31594992774814]`, actual speed was zero and idle weight was 1. This establishes the blocked state while movement input was still held, rather than merely after stopping. Evidence: `artifacts/local/locomotion-native-held-block.json`, compared with `locomotion-native-blocked.json`.

The pistol fired once (15→14 rounds). The bike travelled 5.3157 m, braked to zero, retained its rider pose and successfully returned the player to walking; evidence includes `artifacts/local/locomotion-native-bike.json` and `.png`. Three native backward-walking frames were saved and reviewed. Recorded errors and warnings were empty. These are bounded native movement/interaction checks, not a motion-capture or quantified animation-realism result.
