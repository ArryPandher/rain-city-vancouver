# Canada Place concourse glazing

## Current implementation

Upper glazing is divided into three curved tier meshes. Each has two ordered full-range geometry groups: RGB attenuation, then physical reflection. `createCanadaPlaceConcourseRgbMesh(indexedGeometry)` clones its input geometry and creates the pair. The mesh and reflection material retain `canada-west-glass`; attenuation is named `canada-west-glass-attenuation`. The loader assigns the existing harbour probe to the reflection material. No additional scene capture or physical-transmission render pass is introduced.

The reviewed calibration uses **linear RGB throughput (0.62, 0.88, 0.76)** before Fresnel loss. These are authored experimental values, not measured glass properties. They attenuate the background more strongly in red than green; reflected light remains untinted. At normal incidence with IOR 1.5, destination weights are approximately (0.5952, 0.8448, 0.7296).

The glazing looks into a **deep, closed concourse lining** bounded by the existing source envelope, with physical frame geometry. The former close, curved backing sheets have been removed. No furnished or playable interior is implied. See [glazing depth](canada-place-glazing-depth.md) for closure geometry and remaining architectural uncertainty.

## Compositing and runtime contract

Attenuation writes raw linear throughput multiplied by `(1-F)`, with scalar Schlick Fresnel F. Its RGB blend factors are Zero/SrcColor: the existing scene color is multiplied channel by channel. The second draw outputs only `totalSpecular` from Three's physical lighting shader and adds it using One/One. Diffuse surface paint is excluded. Both passes preserve destination alpha with separate Zero/One alpha blending.

Both materials use FrontSide, depth testing and no depth writes. Shadow casting is disabled at mesh and material levels; the wrapper preserves the shadow opt-out metadata. Attenuation contains no lighting, fog, tone mapping or color-space conversion. Reflection also disables material fog: adding standard fogColor independently would double-count atmospheric scattering already present in the destination.

The project renders its scene into a HalfFloat HDR target, then applies postprocessing and OutputPass. Installed Three renders ordinary offscreen targets in linear space without per-material output tone mapping. The multiplication and addition therefore occur before final tone mapping. Direct-to-screen rendering is not an equivalent supported compositing path.

The existing probe intensity remains 0.8. Physical reflection uses zero metalness, IOR 1.5 and roughness 0.21. The rough BRDF and the scalar Schlick transmission approximation are not an exact thin-sheet optical solution: internal multiple reflections, thickness-dependent path absorption and refraction are omitted. Neutral attenuation was an earlier control; current RGB attenuation supplies colored extinction without recoloring the reflected environment.

## Group ordering and cost

Installed Three pushes geometry groups in array order. Its transparent comparator uses group order, render order, object depth and object ID. The two groups of one object tie, so stable sorting keeps attenuation immediately before reflection. Tests exercise the installed `WebGLRenderList` rather than a replacement comparator.

This guarantees pair ordering, **not correct per-pixel ordering between long curved tiers**. Three sorts each tier by an object-level depth. Front, oblique and both along-building views must be checked for overlap artifacts, especially around bends and opaque returns. Material-array groups must not be flattened into separate global attenuation and reflection batches.

Three tiers require six glass draws, five more than the former single glass mesh. The source geometry is cloned by the wrapper; callers should dispose temporary input geometry once it is no longer needed. There is no extra full-scene capture. Fog treatment is a bounded near-building approximation and is not correct for arbitrary distant or multiply overlapping sheets.

## Independent reference basis

- Juan Tanus's daylight west-concourse photograph in *Roundup*, Fall 2012, p21: https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf . It supports green glazing with pale framing and visible architectural depth, not a measured optical specification.
- SACO Canada Place project views: https://saco.com/wp-content/uploads/2016/09/SACO-Canada-Place.pdf . These reveal framed concourse space and the separated opaque/glazed regions. Their nighttime brightness is not used as daylight albedo or emission.
- Official west-side photograph, 2011: https://www.flickr.com/photos/canadaplace/5973727240/ . This corroborates orientation and major facade organization.
- Michael Rayner's architectural west section: https://www.architects.nsw.gov.au/download/BHTS/Rayner%2C%20Michael_BHTS_Urban%20Waterfront%20Renewal_low%20res.pdf . It establishes concourse volume and envelope relationships, not a pane-by-pane material schedule.

No excluded scan imagery informs this material work. Hotel conservatory photographs are not treated as a hall interior specification.

## Observed validation and limits

Targeted tests cover blend factors, linear throughput, reflection/transmission energy intent, alpha preservation, source-group preservation, shadow semantics and installed sorting. They do not establish GPU appearance or photographic fidelity.

Native views of the earlier weak RGB candidate, with throughput (0.82, 0.90, 0.86), were inspected from the front and both along-building directions. The scene remained closed with no reported rendering errors, but the glass still appeared mostly grey-blue; correct compositing math did not establish a convincing green-glass match.

The full central framing and stronger throughput (0.62, 0.88, 0.76) were reviewed locally from the front, obliquely and along both directions. Frames and ties read more clearly behind the panes, with a modest greener transmission. No obvious gaps or tier-compositing defects appeared, and opaque surroundings remained closed. This is accepted as incremental progress, not photographic or GTA-level fidelity: broad reflection bands and sparse deeper support geometry remain prominent. See [checkpoint evidence](../CANADA-PLACE-OPTICS.md).

## Historical comparison helpers

`createCanadaPlaceConcourseGlass()` retains the earlier 42% alpha, diffuse dielectric appearance for comparison and as a base for opaque end materials. It is not the active upper-pane solution. That model produced a colored diffuse veil and attenuated reflected light again through ordinary alpha blending.

`createCanadaPlaceConcourseReflectionCandidate()` retains the neutral, single-pass reflection-only control. It removed diffuse paint and used custom One/OneMinusSrcAlpha blending, but could not supply per-channel background absorption. It is also not the current paired-pane solution.

Opaque end-cap clones must explicitly restore NormalBlending, premultipliedAlpha false, transparent false, opacity 1 and depthWrite true, with their intended shadow flag and default opaque shader callbacks. Reset separate blend-alpha overrides when deriving a canonical opaque state. Cloning a material copies custom blending even when custom shader callbacks are not copied; opaque end caps must never inherit the active attenuation/additive pair behavior.


## Raw capture and reflection sharpness — 2026-11-15

An on-demand debug preview now reads the existing 128px HalfFloat cube faces without recapturing the scene. Native readback shows distinct clouds, mast lines and surrounding facades before PMREM filtering, so the broad rendered bands are not solely missing source detail. CPU ACES/current exposure and sRGB conversion aid inspection; it excludes PMREM, bloom and final grading and is not a final-screen match. Side-face orientation follows Three's deliberately negative-FOV cube-camera convention; the actual cube texture is not rotated. Failure paths restore the current logical framebuffer/face/mip and reject uninitialized targets. The helper loads only when the debug button is clicked.

The current RGB reflection pass uses roughness0.12, changed from0.21 while holding probe resolution/position, environment intensity0.8, transmission, IOR and geometry fixed. Matched front and oblique daylight views retain visible deeper structure and narrower cloud reflections. This is an authored material calibration, not a measured roughness. Curved tiers still stretch repeated environment bands, and one shared probe cannot supply correct parallax along the full facade. No extra cube capture or resolution increase was introduced.
