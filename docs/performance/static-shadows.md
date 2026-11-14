# Reusing unchanged shadows

Paused and photo views reuse a completed shadow map while the camera matrix, world-update revision, weather and quality mode are unchanged. Every world update invalidates the cache, including detailed-tree selection and the camera-centred sun position. Normal gameplay and the introductory scene continue rendering shadows every frame. Explicit renderer `needsUpdate` requests, including local reflection restoration, remain effective. The original renderer setting is restored even if drawing fails.

No geometry, textures, tree coverage, shadow resolution or post-processing are reduced. This improves static viewing; it is not a gameplay frame-rate fix.

## Evidence — 2026-11-14

The fixed Harbour Green camera (-125,20,-817), Balanced at 1440×900, measured 19.64/19.60 fps with full shadow rendering and 22.70/22.91 fps with reuse in alternating four-second samples. Mean submitted triangles fell from 22,537,408 to 15,891,822/15,868,002. Paired refreshed screenshots had identical RGB pixels. These are local samples, not a general device benchmark.

All 133 automated tests and the production build pass. Tests cover active simulation, camera motion, world/weather/quality changes, explicit invalidation and render-failure restoration. Native gameplay and public release verification are recorded in the project log.

The preceding rendering audit also preserved two rejected experiments in separate branches. Traffic instancing (85a9d6a, `experiment/traffic-instancing`) reduced draw calls but did not demonstrate an fps gain. A distant mesh (9b1611b, `experiment/distant-leaf-surface`) reduced leaf geometry but lost canopy coverage and collapsed part of its trunk. Neither is included in this release. Existing source-shaped tree meshes and far canopy volumes remain intact.

Next: build a distance level that preserves leaf-mask coverage and validated woody geometry, or reduce repeated shadow geometry work during gameplay. Compare silhouettes and frame times before integrating it. Continue Vancouver outdoor fidelity; interiors remain out of scope.
