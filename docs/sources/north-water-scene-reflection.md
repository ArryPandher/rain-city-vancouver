# Debug Canada North static water reflection

## Source gap and bounded location

Native `water-north-horizon-revision-native.png` and `water-directional-waves-native.png` still show mostly sky in water below the visible North Shore. Changing wave normals cannot supply those missing reflected objects. The existing west-concourse cube is at `[589.8143,11.58,-650.1731]`, 108 m from the north public standing point and 167 m from the east apron. Its 900 m far plane cannot include the existing photo horizon at `[400,480,-7000]`.

This independent debug candidate uses one fixed water-height capture at `[700,0.365,-780]`, outside the decoded Canada Place PIER. It is about 84 m from the reached north standing point `[686.698,7.88,-697.34]` and 6.23 km from the photo plane. Only this cube's far plane is 15,000 m; ordinary architectural probes retain their original 900 m range and ownership. Local normal/detail chunks keep the existing 1,000/250 m capture visibility policy. The actual existing root photo plane and nearby static structures are rendered into the cube; there is no invented terrain, moved shoreline or new photograph.

Sources remain the project's already attributed North Shore panorama (`NORTH_SHORE_PHOTO_HORIZON`, existing third-party credit) and its CC0 Poly Haven daylight HDR. The panorama is display-referred photography on an approximate plane, not measured HDR scene radiance. Capturing it supplies a reflection of what the scene visibly contains; it does not turn the photo into a surveyed coast.

A water-fragment displacement of 260 m relative to the probe can shift the distant photo bearing by roughly 2.4 degrees. Near ship/terminal parallax can be tens of degrees and is unacceptable as a general harbour solution. Therefore camera weight is full within 90 m of Canada NorthPoint and smoothly zero by 170 m. Water-fragment weight is full within 120 m of the cube and zero by 260 m. Reflected directions fade from northward component0.25 to0.55; southern berth directions retain the prior water response. Ironworkers, the east arrival apron and other gameplay locations retain the prior material. The candidate does not claim accurate east-berth ship reflections.

## Capture, feedback and shader ownership

The separate checkbox is **Local north-harbour reflection (day only)**. It is available only in the existing debug UI. `World.setDebugWaterScene`, `updateDebugWaterScene`, `waterSceneDiagnostics` and `withoutDebugWaterSceneFeedback` own the bounded control. Preparation yields one render frame after enable; a capture is deferred if an ordinary architectural probe captured that frame. It runs once near the point and after day/weather/orientation invalidation, never continuously. Outside the camera region it only updates a scalar. Failed captures do not retry every frame.

All meshes using the shared water material are hidden during the dedicated capture, as are dynamic scene actors through the existing SceneReflections implementation. While this diagnostic is enabled, ordinary local-probe capture is also wrapped with water hidden, preventing its reflected water result from feeding back through later glass captures. Prior material/source geometry is untouched. The dedicated cube has no architectural receiver materials and never borrows or disposes another probe.

The temporary capture background uses the already tested upper-horizon-continuation HDR input. This prevents the raw asset's mirrored lower solar image appearing where hidden water exposes background. Scene environment lighting, background intensity and rotation are unchanged. The visible horizon photo must have image data before capture; otherwise diagnostics report `waiting for photo` and no sky-only result is published.

The cube records world radiance, including the background's existing orientation. Its PMREM is sampled in the world reflected direction with **no additional HDR rotation or intensity multiplier**. It replaces a convex portion of the complete prior reflection-plus-sun alternative, before unchanged additive noise/fog/tone mapping. The sun is not added a second time. HDR reflection and directional waves remain separate options; HDR roughness stays0.1. Default water remains unchanged.

A water-only compile-layer registry allows wave and scene hooks to be removed in either order. The final removal restores the original compile callback/cache-key function by identity. The HDR option continues to own only its base fragment-source modification and its own target. Pagehide/material disposal clears borrower uniforms before freeing targets and removing hooks.

## Resource budget and restoration

Retained new color textures after capture:
- 128×128×6 RGBA16F cube, including mips: **1,048,560 bytes**.
- 384×512 RGBA16F PMREM: **1,572,864 bytes**.
- Total: **2,621,424 bytes (~2.5 MiB)**, plus roughly0.375 MiB cube depth renderbuffers, assuming32-bit storage.

Temporary texture storage includes a1 MiB 512×256 HDR input, Three's256-face background conversion (~3 MiB without mips), and~1.5 MiB PMREM scratch. Approximate new texture peak is8 MiB; background conversion may also have~1.5 MiB temporary depth storage. These are format/dimension estimates excluding driver overhead, filter meshes/programs and any independently enabled HDR option. Source disposal triggers Three's documented conversion-cache disposal path; the shared source HDR/photo is never disposed.

No extra steady-state scene pass is added. Preparation requires six static scene faces, background conversion/filter work, and one PMREM generation. Native submission/frame cost is not yet measured. `lighting.waterScene` exposes status, capture count, preparation wall time, camera weight, target sizes and retained texture-byte accounting. This is not a GPU-duration measurement.

Capture restoration covers water/actor/chunk visibility, chunk shadow flags, sun and target, scene background, renderer target/cube face/mip, XR, tone mapping and autoClear. Existing SceneReflections deliberately marks the viewer shadow map dirty after temporary probe shadows so the next ordinary render restores it. A failed CubeCamera render also restores cube mip-generation state. Failed/invalid filtered targets cannot remain bound.

## Validation and native acceptance

Seventeen focused water tests pass, including actual installed CubeCamera's six render dispatches and a third-face failure, source PIER exclusion/photo far-plane clipping, pending photo readiness, no continuous capture/retry, invalid target disposal, and all36 combinations of HDR/wave/scene enable and disable orders. The test renderer records dispatch/state rather than running WebGL; the PMREM target factory is substituted. Native shader compilation, photo-reflection registration and memory/frame timings still require review.

At the reached north point, keep camera/lighting fixed and compare scene off/on, first with HDR/waves held constant. Verify a recognisable reflected North Shore, plausible contact/direction, no ghost terminal or dark ring at the spatial fade, no mirrored lower sun, stable small camera pans, and restoration after leaving the region. Reject if parallax or blending looks like a floating projected image. This is a bounded static-probe experiment, not general planar water reflection or default acceptance.
