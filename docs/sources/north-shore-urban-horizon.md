# North Shore distant urban comparison

2026-11-16. Diagnostic candidate only. The parent task owns the explicit `debug` + `terrain=dem` World hook and native acceptance. This is **a culling-only comparison at the existing zero city datum**, not a claim that North Vancouver buildings are aligned to measured terrain. It does not change ground, roads, collision, the default panorama or the DEM.

## Measured missing layer

The read-only audit reconstructs the actual base/eastern building merge and applies `vancouver-building-tags.json` with the same level precedence as `loadCity`. Its window is longitude −123.15..−123.01, latitude 49.306..49.335. This is a bounded diagnostic window, not a claim of complete municipal coverage.

| Reference position | Source buildings in window | Removed by current 2.9 km shell-cell culler | Removed buildings at least 20 m tall |
|---|---:|---:|---:|
| Recorded harbour walk (−123, −720.98) | 12,121 | 12,049 | 44 |
| Canada Place (644.7, −622.34) | 12,121 | 12,042 | 44 |
| Recorded bridge crest (6802.98, −1671.89) | 12,121 | 8,944 | 44 |

These are distance-culler results, not frustum/occlusion visibility counts. The original shell Batcher uses 270 m cells; World compares their cell centres with the player/reference position and retains cells at distance `<2900`. Static batching respects source visibility. Vegetation instances have a separate 1,400 m limit. Additionally, `ForestHabitat`'s densification is explicitly confined to Stanley Park; the existence of 131 North Shore forest polygons in this window does not establish rendered forest crowns there.

The source supports an actual skyline: Esplanade at the Pier is 23 levels / current 73.6 m, Premiere 22 / 70.4 m, and Marlborough Tower 24 / 76.8 m. From Canada Place they are approximately 3.46, 3.43 and 4.49 km away. All are currently culled. Forty-three selected heights derive from levels × the existing 3.2 m convention; ICBC uses its explicit 20 m height tag. These are the existing game's heights, not new surveyed measurements.

There is a second, independent problem. Cached Terrarium samples under the 12,121 building centroids range from about −0.52 to 196.53 m, with a 90.20 m mean. Runtime North Shore ground is zero. The far DEM begins at latitude 49.352 and has a 1,200 m southern transition. Restoring distant buildings alone cannot recreate the missing raised lower foothills. No buildings are raised in this candidate.

Evidence: `artifacts/local/north-shore-dem/urban-layer-audit.mts` and `.json`; native `dnv-native-harbour.png`, `dnv-native-crest.png`, and `dnv-native-review.json`. The audit uses already cached source tiles and made no remote requests.

## Implemented option A

`north-shore-urban-source.json` records the exact 44 selected IDs, ordered footprints, kind, height/levels and resulting current height. The runtime factory preflights all 44 atomically against the loaded source and returns no group on any missing, duplicated or changed source record. It never edits the source or replaces nearby geometry.

Each footprint becomes a closed, untextured extrusion from y=0 to the existing height. It intentionally omits facade grids and the generic renderer's interpreted tower setbacks. This may produce a silhouette change at the existing distance cutoff; that is an explicit limitation of the comparison, not a reconstructed architectural claim. A neutral lit material retains normal world fog. There are no additional shadow draws or reflection probes.

The 44 footprints occupy 18 original 270 m shell cells. Each distant cell is visible exactly when its matching source cell is distance `>=2900`. This gives no overlap and no fade hole at the existing cutoff. It does not change the source culler or render any of the other 12,077 full facades at long distance. Root must call `update(x,z)` with the **same** reference coordinates as the existing culler, including before the first render. Invalid coordinates hide the comparison. Normal frustum clipping and scene fog continue to apply.

Measured cost: **1,796 triangles, 129,312 bytes of vertex/normal data, 18 maximum draws before frustum culling, one shared material and no textures**. All three focused actual-merged-source tests pass, covering atomic failure, source precedence, complete roof area, upward front-sided roof rays, outward perimeter normals/rays, unchanged bases/heights, the exact cutoff complement at recorded cameras and no added shadows. Full TypeScript checking also passes. These are local geometry/source checks; native appearance and the intentional silhouette swap remain for the parent task to evaluate.

Integration contract:

```ts
// Only in the existing debug + terrain=dem branch:
this.northShoreUrban = createNorthShoreUrbanHorizon(this.data.buildings);
if (this.northShoreUrban) this.root.add(this.northShoreUrban.group);
// Alongside the ordinary chunk culler, with its same reference x,z:
this.northShoreUrban?.update(x, z);
```

The factory's `stats` and group name explicitly identify the culling comparison and zero datum. Root owns the diagnostic gate; this module reads no URL or browser state.

## Deferred option B: coherent central Lonsdale ground

A minimal geographically bounded follow-up would study longitude −123.098..−123.06, latitude 49.306..49.365: approximately 2.76 × 6.52 km. Its existing mapped lower-city part contains 6,200 footprints and 41 of these 44 taller buildings. Its eastern edge is well west of Ironworkers and G3; its western edge is east of Lions Gate. The other three tall footprints farther east would remain at the unchanged datum. This is a study envelope, not an approved terrain boundary.

At roughly the cached DEM's 80 m resolution, the envelope needs about 5,700 ground triangles before exact shoreline/edge clipping. A 40 m render grid would be about 23,000 triangles but would not add elevation-source detail. The larger cost is contact correctness across thousands of existing objects, not the terrain mesh itself:

- A bounded field must return the original height outside the final land polygon, use existing ocean polygons without new water cuts, preserve both bridge endpoint heights, and join the northern DEM's *rendered* transition rather than overlaying two different surfaces.
- `CollisionWorld.existingGroundHeight` is the suitable bounded field hook. Source building batches already take `groundHeight(centroid)`, but wide buildings need perimeter foundation/terrain contact; a centroid lift alone buries or floats corners. Foundation work cannot be limited to the 41 distant towers if the same playable ground changes.
- `World.terrain` needs a matching ground mesh and fitted mapped area overlays. `World.roads` needs the field's intersection in `onTerrain`, so its ribbons sample both road edges; otherwise a changed centre height is not sufficient. Existing tree instances and actors already request the collision ground field, but require boundary and road-contact regressions.
- Use cached DEM elevations without height exaggeration. A blend to unchanged ground at the bounded edges is an explicit seam interpretation; do not label blended values as measured elevations. The current source map stops near49.334, so a terrain continuation northward must not fabricate an unprovided building inventory or arbitrary treeline.

Required acceptance includes source ocean-edge preservation, upward surface rays, watertight terrain/chunk joins, road-edge/vehicle/foot support continuity, building-perimeter gaps, unchanged bridge grades and unchanged heights outside the envelope. That is a separate coherent-ground task; A does not solve or conceal it.

## Source and licence

Forty-three ordered rings are from the existing OpenStreetMap via Overpass extract, `public/data/vancouver-east.json` (fetched 2026-11-14; SHA256 `1977b623c82edabe032b5524e3f951d7ef466a94bae4b0f436cccd0a94a7f295`). **Echo, w1554934227, retains the actual loaded base-map footprint**, which takes precedence over the different eastern ring: `public/data/vancouver.json` (SHA256 `50428e79cf93dd54a1c6fd8468d2911c2363ca254a93dedd63707028e79c3d09`), converted with the exact `loadCity` projection. Existing tags come from `public/data/vancouver-building-tags.json` (SHA256 `0fac8d4facf9ea19b318ee39b7aa3dea1c524dc351774f6b831542bf490bc4da`). © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Existing project OpenStreetMap credits apply to this derivative. No new image asset, download, purchase or licence acceptance is involved. The elevation audit retains the [DEM source attribution](north-shore-dem.md).


2026-11-16 root integration: World constructs this guarded layer only inside the existing debug + terrain=dem branch, initializes its complementary visibility at the same origin used during startup, and updates it beside ordinary chunk culling. The public render profile reports its source count, geometry budget and visible cell count under northShore.urban. Five focused integration/source tests pass. Native appearance and cutoff transitions remain unverified; this is not a default change or terrain-alignment fix.
