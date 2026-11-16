# Robson garden path overlay correction — 2026-11-16

The first native paving candidate still showed the old irregular pavement across much of the foreground. Presence of `Robson Square — mineral paving` in the profile did not establish visible coverage. Reconstructing the actual mapped road ribbons and custom garden, using the saved first-person camera, identified generic footways above the new substrate. At pixels (410,780) and (600,780), `w600962365` was at y1.75 over custom ground y1.68. Other samples hit `w991569421` ahead of the custom stair. Some pixels already hit the new material, while the unchanged stair correctly retained its separate concrete finish. Evidence: `artifacts/local/robson-paving-coverage-audit.mts/.json`, `robson-paving-detail.png`, `robson-paving-third-person.png` and `robson-paving-profile.json`.

## Exact ownership and integration

`clipRobsonGardenPaths(geometry, garden, height, offset, road)` in `src/world/robson-garden-paths.ts` removes only overlapping fragments of generic ground footway/path/pedestrian/steps ribbons. The removal mask is the union of the supplied, mapped `ROBSON_GARDEN_ID` building footprint and the exact `ROBSON_LOWER_STAIR` rectangle. The custom garden generator renders the entire supplied polygon, including its y0.08 fallback outside the graded section; its separate stair generator renders that rectangle. This mask therefore follows existing rendered support, not a broad plaza bounding box or a new site survey. Coordinates are rounded to Float32 to match the actual generated surfaces. The supplied building/footprint is treated as immutable for the lifetime of its cached mask.

Root integration belongs in `World.roads()` in `src/world/world.ts`, inside the local `roadRibbon` function, after existing mound/Canada clipping and before the gallery stair clip/return:

```ts
geometry = clipRobsonGardenPaths(
  geometry, this.collision.robsonGarden, height, y, r,
);
```

The helper returns the original geometry for no garden, a different building ID, nonpedestrian roads, elevated `walkway` routes, grouped/unsupported geometry, or no actual overlap. It does not process generic street sidewalks because their owning road kind is a street. No custom garden, mound or stair geometry is passed into this hook. Existing private building solids, terrain heights, route topology, gallery stairs and canopy footprints stay under their existing owners.

Polygon difference splits crossing triangles at the true concave ownership boundary. Original exterior vertex positions, normals and UVs remain intact. Newly exposed boundary vertices interpolate original UVs/normals and sample the existing route height callback plus its original offset, preventing an interior elevated sample from holding up an exterior cut endpoint. Retained exterior routes keep their current material and UV convention. No extra finish mesh, painted mask, per-frame work or surface-height layer is introduced. A changed input geometry is disposed after replacement; unchanged inputs retain object identity. Empty results are valid for fully covered ribbons.

## Focused validation

Two focused tests pass in `tests/robson-garden-paths.test.ts`. They use the actual shipped garden footprint and roads `w600962365`, `w991569421`, `w297295138`, plus the exact saved C2 camera. Four sampled pixels first hit generic overlays before the correction and custom support after it. All ten actual custom treads, sampled at three lateral positions each, remain free of generic overlays and match their existing height function within 2 mm. The generated custom geometry positions remain unchanged.

Dense exterior route samples include the actual garden cut boundary: the route remains present outside, with before/after vertical difference below 9 cm (the existing raised-garden/route finish transition). A separate concave fixture preserves both approaches and an exterior pocket, checks supported new endpoints and finite UVs, and proves distant, street and elevated walkway inputs are returned untouched. This does not claim a surveyed accessible grade or repair older path topology outside the garden.

Only the focused helper tests were run for this correction. Parent owns integrated TypeScript/build checks and the matching native paving/stair review. The visible stair retains its original separate concrete material; this correction exposes it rather than applying the new paver grid to its treads. No whole-foreground material success is claimed before that review.
