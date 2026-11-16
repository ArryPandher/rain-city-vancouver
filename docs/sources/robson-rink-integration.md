# Robson rink bounded integration

2026-11-16. Local candidate integrated after root authorization; native review and release remain root-owned. This does not turn the approximate source dimensions into a surveyed reconstruction. See [exterior source contract](robson-rink-exterior.md) for the corrected north trace, inferred southern closure,1.2m inset and approximate vertical datum.

## Render and support ownership

`World.build()` adds the three rink meshes only when `CollisionWorld` found the existing Robson garden ID and created its bounded rink contact provider. The two exact64-vertex opening polygons are the only new ground exclusions. `World.terrain()` clips the world grass floor, city base and covering flat area surfaces; the terrain tile generators receive the same polygons as their existing cutout input. `robsonSquare()` clips only its garden substrate before batching. Existing custom stairs, mound geometry, small entry canopies and roads are unchanged.

`clipRobsonRinkOpenings()` operates on world-space ground triangles. It preserves affine height, normal, UV and other attributes outside each hole, retains the original geometry for disjoint calls, and disposes a changed input. No bbox-shaped cut or material repaint substitutes for an opening. New cut vertices lie on the original triangle, preserving surrounding grade. Terrain masks use Float32 boundary coordinates matching the visible retaining geometry. Grouped input is rejected rather than silently losing material groups.

The collision provider extracts the actual rendered glass triangles once, then releases its temporary geometry. Floor and roof support are bounded to the openings. Actors falling onto glass receive the height of its actual planar facet; there is no analytical approximation floating above it. `height()`/`walkingHeight()` choose roof support when the actor is above it, otherwise the closed floor. `groundHeight()` returns the real lower floor only inside the cuts. Every outside coordinate falls through to the unchanged provider chain.

Retaining edges, guards and glass have finite body/camera obstruction. Guards match the visible128 closed segments; retaining faces extend from the well bottom to the rim. Body radius is accounted for. The existing player jump is5m/s under17m/s² gravity: its feet cannot clear the1.04m guard, and a jump from the closed lower floor cannot reach the underside of even the lowest glass. A camera well above the rim or roof is not blocked by an infinite column. No stair, underground passage, doorway, or public access into the wells is added.

The real connecting rink would pass below Robson Street, but this candidate excavates only the two closed exterior wells. `World.roads()` is not modified. The upper w50098016 crossing and every tested nearby road ribbon remain unchanged. Existing mapped and public-tree inventories contain no trunk inside either opening; no tree removal was necessary.

## Materials and budget

`robson-rink-materials.ts` reuses the existing licensed `cast-concrete/color.jpg` and `normal.jpg` assets; provenance remains in `public/textures/cast-concrete/SOURCES.json`. Concrete has independently cloned2m sampler repeats, roughness.94 and restrained normal strength.16. Disposing its material releases each owned sampler once without mutating or disposing the library textures. The steel is a shared neutral stainless finish, metalness.82 and roughness.32.

The glass uses the established ordered extinction/reflection pair on one indexed mesh. Both components use IOR1.5; authored linear throughput[.88,.93,.94], reflection roughness.09 and environment intensity.85 retain clear, slightly cool glazing. It uses the existing scene environment. There is no new cube capture, light, emission, photographic texture, screen refraction or render-target transmission pass. The grouping is retained outside material batching. Glass does not cast an opaque shadow; concrete and steel do.

Budget remains18,796 triangles including252 glass triangles, three mesh batches and four beauty draws for the two-pass glass. No FPS improvement is claimed.

## Focused evidence

`tests/robson-rink-integration.test.ts` builds the real `World.terrain()` and `World.roads()` with actual nearby source buildings, areas and roads; only browser-only texture loading is stubbed. Before/after terrain rays show both wells lose every prior flat cap. Adding actual retaining geometry makes the first downward hit the visible floor at−4.6. Just-outside boundary rays keep their original heights. Road position buffers are exactly identical before/after, including the street crossing, and sampled outside walking heights are unchanged.

Other focused checks cover sloped clipping/UV preservation, disjoint identity, exact glass-ray/landing parity, finite camera collision, actual jump envelope, sampler independence/disposal and ordered glass groups. The three exterior closure/footprint tests and two existing garden-path/stair regression tests also pass:9 focused tests total. Scoped TypeScript diagnostics are zero. No full build, full suite, browser, deployment or push was performed in this lane.

Root's next action: build and inspect the ordinary third-person Robson approach, the two rims, and upper crossing. Evaluate shallow roof silhouette, actual reflected environment, material brightness and the explicitly conservative footprints against the cached references. The exterior candidate remains approximate and intentionally closed; do not describe it as completed rink access or a surveyed replica.
