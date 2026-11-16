# Distant traffic exterior level

## Observed cause

`artifacts/local/bridge-route-crest-profile.json` records `Car wheels: Rim1` submitting 12,241 triangles per traffic car, including ten explicitly listed beauty-pass instances at distances 270–616 m. Its top-object list is capped; this is a lower-bound count of eligible far traffic, not a claim that all sixteen cars are represented in those rows.

Existing `car-lod.ts` has 240 m entry / 200 m return hysteresis, wheel/body/lamp synchronization and a driven-car override. However, Actors attached it only to non-AI cars. The successful default E30 loading path also set the old distant template to null and returned. That older LOD only replaced the 185,379-triangle concept car with the 47,077-triangle traffic model; it did not simplify traffic itself.

## Bounded source-derived candidate

`trafficCarExteriorSource` clones the hierarchy of the already loaded `public/models/car-traffic.glb`. It removes meshes with an `Interior…` ancestor and hood interior/underside children. These include the dash, seats, steering hardware and inner door panels; the actual runtime traffic glass is opaque (`transparent=false`, opacity1, transmission0). Exterior body, roof, glass, handles, mirrors, lamps, lower shell and axle geometry remain. The source hierarchy, geometry, materials and images are never mutated.

Within the four explicitly named source wheel branches, only material `Rim1` (dense inner rim detail) and `Brake` (calipers) are omitted in the far template. Each wheel retains the original `Rim2` spoke insert, `Disc`, `Tireside` and `Tiretread` meshes. No new discs/cylinders, texture impostors or synthetic wheels are generated. The retained wheel attributes/indices match the near version exactly. Tyre contact, axle positions, neutral steering pose, rolling radius and complete vehicle bounding envelope also match exactly after registration to the near template's normalization. This is deliberately a source subset, not geometric simplification of exterior panels.

The distant traffic template is prepared before the E30 success/failure branch. The near traffic template is tagged so the proper distant frame is selected; E30 is explicitly excluded from the concept/traffic substitution. Actors attaches eligible levels to both moving and parked cars. Existing animation and lamp synchronization, 650 m actor visibility, recycling, traffic density, driving physics and collisions are unchanged. The actual driven-car update forces the full model regardless of distance. E30 continues to use its full source model even when parked.

The existing 240/200 m hysteresis stays unchanged. At 670 vertical pixels and 62° vertical FOV, a .7 m wheel projects to about1.6 px at240 m and1.95 px at200 m. This is a conservative ordinary-gameplay estimate, not a new adaptive pixel threshold. No alpha crossfade is introduced; a switch may still be observable in a high-zoom/photo inspection. Near traffic—including the entire interaction radius—keeps its original geometry. The existing distance policy uses the player-relative horizontal distance, not an independent remote photo-camera distance.

## Measured asset budgets

| Prepared real traffic clone | Near | Distant | Difference |
| --- | ---: | ---: | ---: |
| Triangles | 47,077 | 18,810 | 28,267 fewer (60.0%) |
| Opaque mesh/batch submissions with wheel batching | 22 | 14 | 8 fewer |
| Mesh submissions without wheel batching | 40 | 26 | 14 fewer |

For the ten eligible far beauty rows explicitly present in the recorded profile, the corresponding complete-model budget difference is 282,670 triangles and80 batched submissions before frustum/occlusion effects. These are real-asset counts and arithmetic, **not** a measured native frame reduction, GPU time or FPS increase. Near shadow casters retain full detail; the far source subset retains ordinary cast/receive-shadow flags, and actual shadow savings depend on the light frustum.

The extra far template and its immutable packed wheel buffers are reused by traffic clones. Near buffers remain for restoration, so this is a submission/geometry-work reduction, not a memory-reduction claim. No extra model download, image asset or render pass is added. Existing material/plate creation follows the car-template pipeline.

## Validation and native acceptance

Seven focused checks pass: three new tests plus existing source-car LOD and wheel tests. They use the committed real traffic, concept and decoded E30 GLBs, verify retained source identity/geometry and exact exterior envelope; near/far cost in both wheel-batching modes; hysteresis at240/241/220/200 m; full restoration for a driven car at616 m; unaffected independent clones; wheel roll/steer, body movement and headlight/brake synchronization. An actual `loadDetailedCar(true)` test exercises both successful E30 loading and forced E30 failure with concept fallback, then invokes `Actors.addVehicle` for AI traffic to ensure the formerly missing attachment is present. Existing concept fallback costs/frames remain unchanged. Scoped strict TypeScript checking passes.

No browser or build was run. Root should inspect the same crest route and a slow approach past the200–240 m transition, including side-on wheels; verify original nearby/entered car quality and night lamp behavior. A new native profile should confirm far `Rim1`, interior and dashboard submissions disappear while retained tyre/spoke/disc shapes remain. Inspect the resulting ordinary-view clips before treating this candidate as accepted.
