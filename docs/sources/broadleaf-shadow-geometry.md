# Broadleaf shadow crop consolidation — diagnostic candidate

The source-derived fallback broadleaf already has two render geometries in
`broadleaf-volume.ts`. Both use the same 22 nonempty planes from three orthogonal
source views, at the same source depths and atlas coordinates. Near geometry
splits each plane into cropped alpha bands (806 triangles per tree); the existing
far geometry encloses those bands in 22 quads (44 triangles). This experiment uses
that existing compact geometry only while native shadow maps render. It does not
replace the independently selected detailed street-tree leaf or branch models.

The geometry wrapper retains the installed `treeStemScale` attribute by identity,
all instance matrices/colors/counts, mesh bounds, material and custom depth
material, alpha cutoff, slice-axis/view dither shader, callbacks and caster flags.
It does not introduce a solid proxy, billboard, new texture, lower alpha threshold
or modified stem. It never disposes source resources. Only attached, visible,
casting source canopy InstancedMeshes with verified near/far metadata and shared
stem attributes qualify. Trunks, conifers and experimental packed BatchedMeshes
are excluded. Detached originals from the batching experiment remain untouched.

## Opt-in integration contract

Import `BroadleafShadowGeometry` from `src/world/broadleaf-shadow-geometry.ts` and
keep one instance per game. Root owns the debug UI/URL and actual integration:

```ts
policy.render(renderer, camera, world.root, debugCompactCanopyShadows,
  () => composer.render());
```

The default boolean must be false. Place this inside the existing final-draw
shadow cache scopes, after reflection capture, so cache accounting still owns
whether a shadow render runs. On toggling, invalidate both shadow caches and set
`renderer.shadowMap.needsUpdate = true`: the intentionally unchanged beauty
geometry must not allow a previously cached shadow representation to survive.
The current `StaticShadowCache` has no invalidate method: include the toggle in
its revision string. `liveShadowCache.setEnabled(liveShadowCache.enabled)` clears
its cached resources/signature even when the enabled value is unchanged. Also
set `world.sun.shadow.needsUpdate = true`. Report the selected toggle and
`policy.state` in the requested native profile.

The policy discovers InstancedMesh references once per root, then validates live
metadata, attachment, inherited visibility and cast flags per scope. Call
`invalidateTargets(world.root)` if source mesh objects are later added/replaced.
The current initialization installs the fallback volumes before gameplay. Normal
near/far LOD changes and material/geometry completion on existing mesh references
do not require rediscovery. No whole-world traversal occurs every frame.

Geometry must change before `WebGLShadowMap` calls `objects.update(object)`;
`onBeforeShadow` is too late. A render-local native shadow-map wrapper selects the
complete geometry then restores it in `finally`. Nested scopes share one wrapper
per renderer and restore their caller; a disabled nested scope supplies original
beauty geometry for probe rendering. An unrelated shadow camera receives original
geometry. Nested full probe rendering from inside a shadow callback must itself
use `policy.render(...probeCamera..., false, probeDraw)`; ordinary probes already
run before the final-gameplay scope. Failed scopes restore bindings/hooks and do
not replace the last successful outer-scope diagnostic state.

## Evidence and acceptance boundary

`gallery-terrace-access-profile.json` recorded 2,928,337 total shadow triangles.
Five explicitly listed fallback canopy submissions have 139+91+86+75+72 = 463
instances, each at 806 triangles. Their geometry capacity would change from
373,178 to 20,372 triangles: 352,806 fewer triangles, about 12.05% of that recorded
whole shadow pass, with the same five submissions. This is source arithmetic,
not a measured current-frame saving or FPS prediction. Remaining canopy rows
may already use compact geometry and are not included in this estimate.

`policy.state` reports eligible/changed mesh counts, submitted instance capacity,
source/compact triangle capacity and matching native shadow-map invocations for
the last successful outer scope. Capacities include zero-scale hidden instances
and do not account for light-frustum rejection or number of lights; invocation
counts are not draw counts. Existing `profileRender` hooks remain untouched and
measure actual renderer deltas while the compact geometry is active. A focused
simulated renderer test verifies attribution routing, not WebGL performance.

Existing source tests confirm identical slice/UV extents within float precision
(the upper Y differs by ~1.2e-7 normalized units) and no newly exposed base-level
opaque pixels: uncovered atlas alpha is at most 4/255. The same physical source
alpha cutoffs remain in force, including Three's current alpha-to-coverage shadow
handling. Larger rectangles can increase transparent fragment work. Mip sampling,
anisotropy and derivative behavior near crop edges can alter rasterized shadows;
base-level alpha evidence does not prove pixel-identical filtering.

Before any default change, root must compare native baseline/opt-in at the same
Gallery terrace pose and light heading, with nearby tree shadow edges across
paving and stairs. Check moving-camera edge stability, thin foliage gaps, branch
contact, and probe refresh/return-to-gameplay. Capture the same requested native
profile with fresh shadows: compare actual canopy shadow triangles/calls and
whole shadow/beauty totals. Beauty totals and geometry must remain unchanged;
measure submission cost independently and do not infer GPU/FPS benefit from
triangle arithmetic. Western conifer changes are owned separately.

Validation: focused policy tests exercise actual `installBroadleafVolumes`
geometry, exact bindings, disabled/far cases, exclusion gates, nested camera and
probe scopes, failure restoration, target refresh and native-profile callback
attribution. Existing source extent/alpha-coverage checks also pass. No browser,
full build or default promotion is part of this scoped candidate.
