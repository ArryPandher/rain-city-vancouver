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
