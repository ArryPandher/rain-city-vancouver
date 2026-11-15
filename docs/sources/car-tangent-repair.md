# Car tangent import repair

2026-11-15. Repairs the runtime import of the existing `car-concept.glb` and
`car-traffic.glb`; neither asset was changed or downloaded.

## Verified defect

The committed painted-body primitives supply Float32 vertex normals and tangents.
GLTFLoader therefore leaves their normal-map scale at `(0.3, 0.3)`. The old car
body path deleted `tangent` after loading, and the general `normalizeGeometry`
helper also removed it. Three then rendered the body using derivative tangents,
without the normal-map Y inversion that this installed GLTFLoader applies when
it initially loads a primitive without authored tangents.

The audit found finite, unit-length paint normals and positive source transform
determinants, with essentially all paint vertex normals facing consistently with
their triangles. It did not establish a need to regenerate the car's normals.
The observed reflective/creased body appearance is not, by itself, proof that
this import mismatch explains every visual defect.

## Repair and limits

`car-body-geometry.ts` clones and transforms static car primitives while retaining
their authored tangent and UV attributes. Existing normals remain intact; only
missing normals use the previous fallback calculation. A reflected bake reverses
triangle winding and tangent W so that the transformed bitangent keeps its
physical orientation. Current assets have no such reflected primitive; an actual
paint primitive with a test reflection exercises that case.

`detailed-car.ts` groups by source material and compatible attribute layout before
merging. A primitive without tangents stays without them and retains GLTFLoader's
separate derivative material convention. Mixed UV layouts remain separate draws;
they do not lose attributes or entire primitives to a failed merge. A failed merge
retains the unmerged geometries. Successful merges pack even single primitives,
avoiding excess stride from the traffic asset's interleaved source buffers.

UV1 is retained along with tangents, restoring the coordinate channel referenced
by imported AO maps. Paint 1's source AO intensity is zero, so UV1 does not add AO
darkening to that paint. Other source materials keep their existing AO settings.
The tangent repair itself leaves the general world `normalizeGeometry`, GLB
files, paint/clearcoat/normal-map parameters, wheel geometry/materials, wheel
motion, and LOD thresholds unchanged. No global normal-scale inversion is
applied. The subsequent, separate rim finish calibration is described below.

## Measured resource impact

Final body attribute plus index arrays, measured from the actual loaded assets:

| Template | Before | After | Added | Tangent vertices | UV1 vertices |
| --- | ---: | ---: | ---: | ---: | ---: |
| Concept / near | 3,328,642 B | 4,820,306 B | 1,491,664 B | 55,354 | 75,750 |
| Traffic / distant | 1,034,710 B | 1,528,102 B | 493,392 B | 17,886 | 25,902 |

The increase is exactly 16 bytes per retained Float32 tangent plus 8 bytes per
retained Float32 UV1. Runtime creates one concept and two separately normalized
traffic-derived templates, so their combined additional body arrays are
2,478,448 bytes. Cloned cars share their template geometries; this cost does not
repeat for every car. GPU attribute uploads carry corresponding extra data when
each template is used; driver allocation and GPU memory were not measured.

Both current assets still have 16 body meshes and 16 body materials. Their body
triangle counts remain 120,139 and 28,489. Wheel geometry, the six optional wheel
batches, texture allocations/downloads, and material-clone counts are unchanged.
The authored-tangent shader path carries tangent/bitangent varyings instead of
reconstructing that basis with fragment derivatives. This is a shader change,
not evidence of a frame-rate improvement. There is no added per-frame CPU work.

## Validation

`npx tsx --test tests/car-tangents.test.ts tests/vehicle-wheels.test.ts tests/wheel-batching.test.ts tests/car-lod.test.ts`
passes all 11 focused tests. TypeScript passes.

The new tests parse both real GLBs with GLTFLoader, stubbing only image decoding.
They compare every retained body normal/tangent against the source's transformed
basis, verify tangent W and loader normal-scale conventions, check UV1 values,
triangle/draw counts and buffer bytes, and confirm geometry sharing across car
clones. A modified in-memory copy of the near GLB removes a tangent declaration
from one paint primitive and UV1 from another: the loader's two material variants
and three compatible layout groups retain every triangle. A reflected actual
paint primitive verifies winding and bitangent handedness. Existing actual-asset
tests verify steering/spin, grounded tyres, fixed calipers, wheel batch materials
and shared buffers, and near/far transitions.

The native tangent-only comparison used identical player/camera positions,
orientation and light/exposure in ordinary third-person gameplay. Independent
full-frame and body-crop review found no visible gaps, seams, silhouette or
wheel-contact regression, but could not confidently establish a meaningful
cosmetic improvement at that distance. The bright front-fender wash and sharp
rim highlights persisted. The import defect is corrected; the foil-like finish
is not claimed solved. Host load and dynamic scenery differed, so these captures
do not establish a performance effect.

## Separate non-emissive rim finish

After recording the tangent-only comparison, the runtime clones of `Rim1` and
`Rim2` disable their source emissive atlas, emissive colour and intensity. The
source GLB specifies emissive factor `[1,1,1]` and atlas index 3 for both rims.
`Rim2` also has metallic 1 and roughness 0.049 with no roughness texture. Its
runtime roughness at that checkpoint was 0.24, an authored ordinary-metal finish
rather than a measured alloy specification. The darker nonmetallic `Rim1` kept its source
roughness 0.4. Tyres, brakes, lamps, painted body, geometry and rolling behaviour
are unchanged. Shared textures are not disposed or modified.

All 11 actual-asset tangent/wheel/batching/LOD tests and the production build
pass after this material-only calibration. Native rim appearance is documented
in the integrated scene report; neither correction establishes AAA car quality.

## Candidate coherent satin rim coating

The native `car-rims-after.jpg` still shows bright star-like centres. A read-only
audit of clean `cd58776` confirmed that this is source geometry plus material
contrast: neither rim has a normal or bump map, and emission was already disabled.
In the normalized near wheel, `Rim2` is a pointed inner ornament spanning radii
0.0624–0.2003 m, while `Rim1` includes the full annular rim and long radial spokes
out to 0.3411 m. The tyre radius remains 0.4318 m. An in-memory, material-ID-coloured
projection of the actual geometry confirmed that the star shape is authored.
The larger rim's nearly black finish makes the white metallic insert dominate
the gameplay view.

The next candidate changes only the two cloned rim finishes to the same satin
powder-coated alloy interpretation. This is an authored coating choice, not a
measured automotive material or a change to global lighting/exposure.

| Runtime material value | Before: Rim1 | Before: Rim2 | Candidate: both |
| --- | --- | --- | --- |
| Base colour, sRGB hex | `#030303` | `#ffffff` | `#8b9299` |
| Base colour, linear RGB | `[0.000992374261841178, 0.000992374261841178, 0.000992374261841178]` | `[1, 1, 1]` | `[0.25818285291079235, 0.2874408377161099, 0.31854677811435356]` |
| Metalness | 0 | 1 | 0 |
| Roughness | 0.4 | 0.24 | 0.42 |
| Emissive colour / intensity / map | black / 0 / null | black / 0 / null | unchanged |

The exact linear values above come from the loaded source/current Three colour
objects; the hex values are their quantized display-space representation.
Both retain their source AO texture and intensity 0.85. `Rim1` and `Rim2` remain
separate material instances and names, with four wheel parts each. Giving them
one shared material instance would create an eight-part group and make the
existing exact-four wheel batching rule skip it.

Measured cost is zero added triangles, vertex/index bytes, textures, materials
or draws. The source wheel geometry remains 65,240 near / 18,588 traffic triangles;
optional batching remains 24 meshes to six batches, including two rim batches.
Packed wheel buffers remain 2,354,632 near / 881,840 traffic bytes shared across
clones. This candidate changes existing material uniforms and adds no per-frame
work. Tyres, brakes, lamps, body paint, wheel motion, source GLBs and all geometry
remain unchanged.

All 13 focused actual-asset tangent/wheel/batching/LOD tests and TypeScript pass.
The two added real-GLB tests check coherent rim values, distinct material groups,
six-batch eligibility, unchanged non-rim wheel properties/textures, unchanged body
paint/lamp settings, and unmodified source material objects. Existing tests still
cover every batched attribute/index and the wheel transforms. No full suite or
build was run for this candidate by the implementation reviewer.

The star topology is retained. The subsequent native comparison used the same
summoned-car procedure and exact player/camera/light settings. Both rims now
read as a complete wheel with a quieter inner insert; independent review accepts
the improvement while noting a uniformly pale coating and weak brake depth.
The first unmatched title-menu-car frame was excluded. Actual driving and
braking preserve the rolling/contact presentation. Body clearcoat/reflections
remain a separate issue and are not altered here. See the integrated
[arrival-court checkpoint](../HOWE-ARRIVAL-COURT.md) for movement and timing limits.
