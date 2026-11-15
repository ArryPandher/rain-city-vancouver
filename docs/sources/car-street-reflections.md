# Optional Howe car street reflections

This candidate addresses a specific rendering gap: cars already have physically shaded paint and glazing, but their environment came only from the distant sky. It borrows local building/pavement information from exactly two existing scene captures: **Fairmont Waterfront street lobby** and **PwC Place street lobby**. It adds no cube camera, capture specification or scene capture. The reduced 40% blend is enabled in Balanced/High after a matched native parked comparison and short driving check. Low quality keeps the sky-only fallback; a diagnostic checkbox permits comparison.

The architectural source and approximation limits remain those documented in `fairmont-waterfront.md` and `pwc-place.md`. A reflection contains the current modeled street, not a new photographic reconstruction. Both cameras are fixed near their respective lobbies, so nearby-car reflections have approximate parallax and exclude moving actors. They do not represent a physically exact reflection taken at every car panel.

## Capture validity and ownership

`SceneReflections` now exposes explicit `valid` and `capturedGeneration` state, a `currentTexture(name)` query and a lifecycle subscription. A successful capture of the current lighting generation is required. `dirty === false` alone is insufficient because failed captures also become non-dirty. Invalidation, failure and disposal publish loss of validity immediately; a capture invalidated during its own render cannot publish stale light. Existing architectural material lists, their authored intensities and the scene environment remain unchanged by the car helper.

`CarStreetReflections` owns only isolated car-material clones and filtered derivatives. It selects the existing detailed-car body materials named Glass or Paint 1/2, including the hidden attached distant body. Three selected materials are cloned per source body: six for the player car with near/far bodies. It preserves all source maps, tangent/normal data, geometry, colors, roughness, metalness, clearcoat and intensities. It does not alter the templates, another car's materials, wheels, lights, interiors or architectural receivers. Material discovery runs initially and then at most every **0.5 s** for late LOD attachment; ordinary frame updates set blend weights. Removal, disabling and helper disposal restore the exact original material assignments and dispose only helper-owned clones.

## PMREM blend and transitions

Two lazy `PMREMGenerator.fromCubemap` derivatives retain Three's GGX roughness filtering. The shader reuses Three's cube-UV lookup and roughness-to-mip function with independent atlas constants for the existing 128-pixel captures; it does not use an unfiltered raw-cube roughness approximation. The native sky irradiance path and native sky specular lookup, rotation and intensity are retained. Only the specular radiance, including the material's existing clearcoat path, blends toward the local PMREMs. Weights form a convex combination, so blending does not introduce an intensity gain.

Car material `envMap` remains null for the current native sky fallback and its `envMapRotation` remains identity. Local lookup uses the already world-oriented reflection direction without applying the sky rotation or car heading a second time. The sampled street therefore remains fixed in world axes as the car steers or rolls.

The candidate influence is bounded to **x442–510, z−502–−397**, with an **8 m boundary fade** and a **12 m outer exit halo** to finish fading before releasing materials. Each probe has full horizontal influence within **14 m**, entry/exit hysteresis at **30/34 m**, and a vertical fade from **4 to 8 m** of camera-height separation. A **0.55 s exponential transition** smooths travel and source handoff. Where both local fields overlap, both can contribute; elsewhere the remaining weight belongs to the native sky. These are rendering fit parameters, not surveyed architectural boundaries. Teleports beyond the bounded halo, low quality, disabled state and invalid captures restore sky immediately.

The first matched native comparison, `artifacts/local/howe-wing-native-first.jpg` versus `artifacts/local/howe-car-reflections-full.jpg`, successfully compiled and filtered the candidate but rejected full local dominance: the car roof lost its broad sky highlight, while strong dark/mottled structure across the side door obscured the body shape. The revised candidate caps the **combined local weight at 0.40**, retaining **at least 60% native sky specular** even at full local influence. Spatial falloff and temporal transitions reduce that contribution further. This is an approximate visual calibration for the offset lobby captures, not a measured reflectance or a change to paint, glass, scene or probe intensities. The 0.40 revision still requires the parent's matched native comparison; the default remains off.

The parent's first native filter reported one derivative with **1.2 ms CPU submission time**, with no logged shader/filter errors. That figure is not GPU time or a sustained frame-pacing measurement, and it describes the first full-local trial rather than acceptance of the reduced-weight revision.

Source invalidation or failure clears the affected uniform binding and disposes its owned derivative synchronously. Low quality/disabled state releases both derivatives and restores original car materials. Failed PMREM filtering keeps sky, restores the renderer target/cube-face/mip, XR and auto-clear state, and is not retried every frame; a new capture generation or explicit re-enable permits another attempt. PMREM temporary outputs observed during a failed submission are disposed. The helper never disposes a source capture texture or any shared vehicle texture.

## Resource and verification limits

Each derivative is a **384 × 512 RGBA half-float atlas**, with no depth buffer or mip chain: **1,572,864 bytes (1.5 MiB)**. Two retained atlases use **3,145,728 bytes (3 MiB)**. The generator's same-size ping-pong scratch adds **1,572,864 bytes**, giving a **4,718,592-byte (4.5 MiB) texture peak**, excluding driver overhead, shader programs and the small filter-plane buffers. The source cube textures are pre-existing and remain owned by `SceneReflections`.

For the installed Three version, filtering a 128-pixel cube uses ten packed LOD levels: one conversion draw plus eighteen filter/copy draws, **19 filtering draws per derivative / 38 for both**. These are occasional offscreen filtering passes after a successful capture, not new scene captures or recurring per-frame capture work. Main-scene car geometry and draw counts do not increase. Bound paint/glass shaders add up to two filtered environment lookups per specular evaluation, with native clearcoat evaluating its own lobe. The candidate still needs native shader-compile, GPU-time and frame-pacing observation; source-level counts do not establish negligible runtime cost.

Nine focused checks in `car-street-reflections.test.ts` and `reflection-probes.test.ts` passed. They load the actual concept and traffic GLBs through GLTFLoader, verify independent near/far car materials and unchanged source attributes, prove zero additional cube captures, check current-generation validity, exercise immediate invalidation/failure/quality/disposal cleanup and renderer recovery, verify late-LOD discovery bounded to 2 Hz, and follow a six-second route with continuous bounded weights. GPU texture uploads/filtering are substituted in these CPU tests; actual native PMREM generation and shader appearance remain acceptance work. TypeScript and scoped diff checks passed.

## Minimal integration

Construct with the existing reflection manager and renderer. The accepted reduced blend is enabled for Balanced/High, and a diagnostic flag permits comparison:

```ts
const carStreetReflections = new CarStreetReflections(reflections, renderer, {
  enabled: candidateFlag && quality !== "low",
});
```

After the existing reflection update and actor/LOD poses, before the main draw:

```ts
carStreetReflections.update(actors.vehicles.map(v => v.model), dt);
```

Flag or quality changes call `setEnabled(candidateFlag && quality !== "low")`; teardown calls `dispose()`. Existing weather invalidation is already subscribed, with no extra source-material registration. If enabled for a diagnostic session, the first update can run during loading after existing captures to absorb initial filtering and shader warm-up. Native acceptance should compare the exact parked pose with the flag off/on, rotate/drive between both frontages, leave the influence area, toggle quality, and change weather before deciding whether to retain the candidate.

## Native acceptance of the reduced blend

The final local view keeps the broad roof sky highlight and adds restrained street structure across the side panel. Saved player/camera/light coordinates match the earlier full-strength comparison. The player car settled at local weight0.3949683 with six isolated near/far material bindings and no filter error. The corrected Granville Square sign is readable in the same frame. A short drive reached73 km/h, braked to zero, exited and walked, and a pistol shot reduced ammo15→14. These are incremental visual/gameplay checks, not AAA acceptance or a claim of physically exact panel reflections. Initial filtering and variant preparation are included before the existing startup shader warm-up; disabled updates return before traversing cars. Public verification follows the release.
