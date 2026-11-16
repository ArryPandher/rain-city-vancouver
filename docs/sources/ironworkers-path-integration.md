# Ironworkers path and fence integration

2026-11-16. Integrates candidate `dc86e39` with the accepted shared road alignment. Source photographs, measured path/fence dimensions, estimated member sections and rendering costs remain documented in `ironworkers-path-boundary-candidate.md` and `ironworkers-path-fence-proposal.md`. Native acceptance is still pending.

## Installed behavior

`World.build` creates the path boundary from the unchanged bridge grade and existing external ground+.07 finish, adds its visible group directly to the world root, then installs the same object in `CollisionWorld`. Instanced pickets and LOD remain outside static mesh merging. Existing Ironworkers sparse rails are omitted only when the new visible boundary is installed; other bridges retain their existing rail construction.

`CollisionWorld.height` and `water` consult only the exact path/tie top triangles, retaining the prior vertical eligibility gate. The physical member check runs before the elevated-bridge early return. Default-height actor calls resolve an actual local support height, so spawn checks cannot silently bypass the fence because their reference height is Infinity. Camera spheres use finite physical members; no infinite wall or blanket bridge collision is added.

`World.roads` omits the old inboard concrete finishes for **w35260598 and w62125826 only**. New concrete floor geometry is the same sampled surface used by support. The four source carriageways and their lane markings retain their exact generated attributes.

`createIronworkersApproachClipper` subtracts the four new tie polygons only from these existing approach ways: **w503135269, w336869485, w62125827, w336868165, w41840546, w880719215**. Every retained triangle vertex/attribute is interpolated on its original source triangle. Source finish generation uses the prior bridge/ground sampler, not the installed path finish, preventing feedback that would raise the old source by another7cm. No source road coordinates or tags are changed.

## Scoped pedestrian assignment

`ironworkersPedestrianRoad` returns the original Road object for every other way. For the two bridge cycleway IDs it caches a route with the same metadata, a2.5m width, the shared path centres, and the exact external source vertices connected by the four finish ties. West walks preserve the source north-to-south order; east walks preserve south-to-north. Both route ends remain open and generic pedestrian end reflection remains unchanged.

Only the pedestrian span preparation in `Actors.populate` and `Actors.recycle` calls this adapter. Traffic spawning, driving offsets, one-way continuation, vehicle models and AI heading logic are unchanged. Pedestrian placement, ordinary movement and recycling use the installed support surface. All external source approach roads retain object identity and their original vertices.

## Verification

The focused integration tests call the actual `World.roads` implementation, rather than a substitute ribbon builder:

- Every generated carriageway attribute is byte-for-byte numerically identical before and after path installation.
- The two obsolete cycleway finishes disappear while source Road data stays unchanged.
- New approach interiors contain no old coplanar source finish; actual mesh rays match installed support. Eight probes on both sides of the four external seams retain a continuous7cm finish.
- Live `CollisionWorld.move` stops attempted outer-fence and inner-curb crossings. Ordinary/high/under-deck camera cases agree with the finite visible members.
- Other bridge support/collision samples remain unchanged.
- More than8,000 pedestrian cursor samples, including turns and reflection through both approach ends, stay on supported clear floors. Only the two intended route IDs are adapted.

The existing pure candidate tests additionally cover9,373 source strip vertices,11,160 full lane-car corners,2,278 floor triangles, perpendicular2.5m approach widths, and bounded24-draw instanced LOD. The alignment and below-deck structural regression tests are included in the focused verification command:

`npx tsx --test tests/ironworkers-path-boundary.test.ts tests/ironworkers-path-integration.test.ts tests/ironworkers-alignment.test.ts tests/ironworkers-bridge.test.ts`

All17 focused tests and `tsc --noEmit` passed. No browser, full build, full suite or push was performed. Root's next check is a northbound drive in the actual northbound carriageway, both path approaches, close fence-camera behavior, and native frame cost. The earlier crest traffic audit established that the hero had driven north in a southbound lane; this integration intentionally does not alter source-correct traffic flow.

## Native shoulder-floor correction

Root's `ironworkers-fence-native-path.png` recorded an apparently watery floor at world `[6790.03,35.59,−1441.31]`. That point is on the inboard bridge shoulder, between the source carriageway and the new sidewalk. The new path is farther west at the shared16.55m offset.

The actual failure was static distance culling, not reversed path triangles. The Ironworkers deck and merged underside builders emitted world-coordinate vertices while their mesh positions remained at world origin. `World.mergeStatic` selected a batch centre from those mesh positions (`[200,200]` after cell rounding), then `World.update` hid the batch more than2,900m away from the real player. Source road ribbons had correct batch locations and stayed visible, leaving the shoulders open to the water and port below.

`registerIronworkersStaticOrigins` moves only these owned bridge meshes' vertex origins to their own bounding centres and compensates their object transforms. World-space geometry is preserved. It runs in the Ironworkers landmark branch before static batching; all other landmarks/bridges and the global culling policy remain unchanged. The full deck and below-deck structure now receive nearby culling cells. Restored previously hidden geometry adds about48,492 visible triangles before frustum culling, so native frame cost should be checked again.

Three regressions in `ironworkers-static-origin.test.ts` reproduce the old failure using actual `World.mergeStatic` and `World.update`, confirm the corrected shoulder and35 deck-section positions with FrontSide rays, confirm the new path's upward normals/FrontSide hits, and preserve all below-deck world vertices within1mm while restoring their visibility. No DoubleSide workaround or support widening was applied.
