# Canada Place ground door frontage

This is an original exterior interpretation based on Juan Tanus's photograph in the BC Museums Association's *Roundup*, Fall 2012, page 21: https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf. The inspected local reference is `artifacts/local/canada-place-pedestrian-references/museum-west-photo.png`.

The photograph shows pale repeated frames, paired ground doors, sidelights and transoms. Precise current bay positions and operating exits are not surveyed. Temporary exhibits, signs and interiors were not copied.

## Geometry and proportions

`canada-place-door-frontage.ts` replaces the former continuous ground pane, ground-level station frames, continuous rail at 10.03 m and single central handle. The original mineral base, overhead curves and soffit remain.

Twenty-nine bays, each approximately 3.55 m wide, divide the 103.1 m frontage. Each bay contains paired central closed leaves and fixed sidelights. A transom at source-local height 10.12 m gives a 2.15 m leaf height above the 7.97 m threshold. These are authored estimates, not an exit plan. Surfaces split at existing source path breaks to fit the tapered and angled ground envelope.

Frames are 80 mm wide and 160 mm deep. Panes sit 100 mm behind the nominal ground front. Recessed gaskets, threshold plates and mounted pulls provide physical depth. Pulls project 100 mm, within the existing 120 mm footprint allowance. Ground footprint data, support, stays and upper geometry remain unchanged.

## Glass and backing wells

Each pane has normalized 0–1 UVs that remain continuous across path segments. Behind it is a shallow, closed 400 mm backing well with a backplane and inward-facing side, top and bottom reveals. These use the gasket material batch. There is no playable interior or deeper scene.

Ground glass uses the supplied source-map key `door-glass` when available. Its clone preserves `onBeforeCompile` and `customProgramCacheKey`. The mesh and material are named `canada-west-door-glass`. The mesh receives shadows, does not cast shadows and uses the default render order of zero. Static batching separately requires `material.userData.castShadow = false`; a mesh-only flag does not survive `World.mergeStatic`.

`canada-place-door-glass.ts` provides thin transparency with stronger grazing reflection and subtly rougher pane edges. The doors share the existing west-concourse probe. Frame and gasket materials remain opaque; roof glass is unchanged.

## API and cost

`addCanadaPlaceDoorFrontage(root, { glass, frame }, pointAt, stationBreaks)` returns three batched meshes. The facade builder returns these alongside its existing three batches.

The full facade contains 47,468 triangles, compared with 29,336 previously, across six material batches. The geometry helper introduces no textures, downloads or per-frame CPU work.

## Verification and limits

The existing facade, source-selection, paving, route-clearance and upper-normal tests pass. New tests check normalized UVs, shader-hook cloning, glass shadow flags, finite vertices and ground-footprint containment, with a 2 mm allowance at float32 boundary edges.

Rays sample every bay's ground pane, transom, backplane and bottom/top well reveals. Native daylight checks cover close and oblique inspection, first-person viewing, walking, aiming/firing, bicycle motion and car clearance. Tests and these checks do not establish photographic or AAA parity.
