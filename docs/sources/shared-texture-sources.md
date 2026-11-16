# Static texture Source sharing

`Materials.texture` now uses one `SharedTextureSources` cache per Materials instance. It keys the full existing `${BASE}textures/${name}` URL and always returns a fresh Three.js Texture wrapper. Color/data interpretation remains a per-wrapper property. Existing repeat, wrap, anisotropy, filtering, offset, rotation and matrix settings remain independent.

The cached Texture is a private, unrendered holder for the image's Three.js Source. TextureLoader still performs the load through its original LoadingManager and TextureLoader instance. Real `Texture.clone`/`copy` semantics share the Source object, so consumers and their further clones created before completion see the later image assignment and source-version update. No manual image copy or global THREE.Cache change is used.

Failures evict the URL record, allowing a subsequent request to retry. A late or repeated error from an older load cannot evict a newer successful record. This also handles a loader that invokes its error callback synchronously. Existing failed consumers remain associated with their failed Source; they are not silently retargeted. A retry returns wrappers of a new Source. Synchronous thrown loader errors propagate without leaving a record.

Consumer disposal emits only on that wrapper. Three's renderer owns GPU reference counts for wrappers sharing a Source; disposing one cannot dispose a sibling or the unrendered holder. Static source data remains retained for the Materials instance lifetime, as do its other shared materials. The helper does not close image data or mutate caller image contents. HDRLoader images, mutable canvas/DataTextures, generated AO atlases and reflection targets do not pass through this cache and are unchanged.

## Evidence and bounded allocation audit

Eleven actual installed material factories were called once each through the real Materials.texture method with only TextureLoader.load stubbed. Before the change, they made35 loads and35 distinct used Sources for three512×512 plinth images (color13, normal13, roughness9). After the change, they make3 loads and share3 Sources, with the same35 independent used texture wrappers and the same five repeat scales.

Local before/after harness and results:
- `artifacts/local/shared-mineral-source-audit.mts` / `.json`
- `artifacts/local/shared-mineral-source-audit-after.mts` / `.json`

Installed Three r182 WebGLTextures uses Source identity plus upload/sampler settings as its GPU allocation key. UV repeat/offset/rotation/center are not part of that key. All sampled wrappers of each URL have one compatible upload variant. If all these textures are resident as RGBA8 with full mipmaps, avoiding32 duplicate512² uploads corresponds to approximately42.7MiB by arithmetic. This is not measured GPU/process memory or an FPS result; native visibility, driver storage and lifecycle affect actual costs. No claim about network bytes is made because browser HTTP cache behavior was not measured.

## Checks

Eleven focused tests pass: five cache tests plus existing Pan Pacific tower and Robson paving material tests. They cover delayed completion including arbitrary further clones, independent color interpretation and sampler transforms through actual Materials.texture, distinct URL/owner separation, failure eviction/retry, repeated old failure safety, synchronous failure and disposal isolation. Scoped strict TypeScript checking passes. The existing material tests retain licensed map reuse, geometry-based metre sampling and disposal contracts.

No full build, browser or native memory benchmark was run for this change. Native review belongs to the combined candidate build. Verify all image maps load after an ordinary fresh start and preserve per-site tiling/colors before accepting the cache.
