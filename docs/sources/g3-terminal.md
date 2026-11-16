# G3 Terminal Vancouver silo cluster

2026-11-16. Scoped candidate for west-facing Ironworkers bridge and path views. The existing eastern source map contains 48 silo footprints but renders each at the generic 6.4 m height. This implementation replaces exactly those 48 generic buildings with closed concrete cylinders at the documented 140 ft (42.672 m) height and three modest rooftop conveyor galleries. It does not alter the port ground, shoreline, road geometry, bridge, or North Shore terrain.

## Sources and licences

- [Kiewit: Completing the Chain](https://www.kiewit.com/newsroom/completing-the-chain-vancouver-terminal-is-final-link-for-g3/) documents three annexes of 16 concrete silos, each 140 ft tall. [Kiewit project scope](https://www.kiewit.com/projects/g3-terminal-vancouver/?lang=en-ca) confirms the 48 silos and conveyance systems.
- [G3 Terminal Vancouver Community Update, April 2020](https://triampcl.wordpress.com/wp-content/uploads/2020/04/g3-terminal-vancouver-community-update-april-2020.pdf), pages 1–2, supplies the inspected aerial and corroborates 48 silos. The aerial shows pale concrete cylinders, low open steel galleries on top, and separate taller processing structures. Cached research copy: `artifacts/local/ironworkers-reference/g3-community-april2020.pdf`; inspected aerial crop: `g3-roof-crop.png` in the same directory.
- [Sonic Enclosures](https://sonicenclosures.com/portfolio/g3-terminal-vancouver/) reports 64 m including conveyors. That is not the cylinder height and is not applied to these bins. The taller process towers, remote conveyor links and shiploaders remain outside this scope.
- Exact source rings: `public/data/vancouver-east.json`, SHA256 `1977b623c82edabe032b5524e3f951d7ef466a94bae4b0f436cccd0a94a7f295`. IDs **w1169734593 through w1169734640** inclusive, all `kind:yes`, with no height or level metadata. `g3-terminal-source.json` preserves the original coordinates and attribution: **© OpenStreetMap contributors, ODbL 1.0**; see [OpenStreetMap copyright](https://www.openstreetmap.org/copyright) and `public/data/LICENSE.md`.
- No open redistribution licence was established for the contractor/G3 photographs. They are research references only. No source photograph or PDF is shipped as a runtime texture. The concrete map is an independently authored 64×64 texture.

## Registration and uncertainty

The source footprint bounds are x **5417.7–5514.6**, z **−2431.4–−2242.7**, with centre `[5466.15,−2337.05]` (49.30414212, −123.04470989). Every original ring is retained, including tangent contacts between neighbouring bins. Side walls have smooth radial shading without replacing their mapped perimeter. Closed top caps are horizontal at centre-ground + 42.672 m; lower perimeter vertices follow the caller's existing ground.

The aerial establishes the low open rooftop-gallery form, but does not provide surveyed gallery dimensions or exact roof support locations. The authored approximation uses one central four-bin row per 16-bin annex, inferred from source-centre alignment on axis `(0.2804,−0.9599)`. Each gallery is 3.6 m wide, its floor 0.6 m above the highest supported cap, its rail 1.5 m above that floor, and its posts spaced no more than 3 m apart. These dimensions are **visual estimates**, not official measurements. Twenty-four narrow legs land inside their individually named silo caps. All gallery geometry remains within the original cluster bounds; highest steel is 44.812 m on the current flat ground. No freestanding span or unsupported connection to a guessed processing building is introduced.

From the recorded bridge crest `[6797.68,−1704.90]`, the cluster is about **1,474 m away, 64.6° west of north**. It belongs in a normal westward glance; it is not centred in the forward highway view and should not be moved to improve framing. Native appearance/visibility and frame cost still require the parent task's review.

## Integration and checks

`createG3TerminalAssembly` preflights all 48 original rings, uniqueness, kind and absent height/levels before emitting anything. A missing, duplicated, edited or reclassified member leaves all existing generic fallbacks active. The architecture hook suppresses only the accepted IDs and emits the complete assembly once. Ground is applied once; the caller's batch offset is restored. Three existing static batches receive the correct terminal culling centre.

The existing generic building collision already blocks these exact source rings at all queried heights, so no new broad obstacle, support surface or collision exemption is added. Adjacent buildings, roads, areas and water retain their original data and behavior.

Validation: `npx tsx --test tests/g3-terminal.test.ts` — **4 passed**. `npx tsc --noEmit --pretty false` — passed. Tests exercise actual-source SHA/rings and fail-closed fallback, one-time three-batch emission and culling registration, closed per-cylinder topology and outward volume, front-sided top/bottom rays, every conveyor support's actual cap contact, bounded gallery extents, caller ground offsets and existing source collision. Source rings touch, so each cylinder's manifold closure is checked independently rather than welding distinct touching solids together.

Cost: **6,708 triangles in 3 material batches**. This is total candidate geometry, not a measured native frame-time delta. No full build, full suite, browser or deployment was performed by this agent.
