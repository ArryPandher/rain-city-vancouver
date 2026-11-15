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
runtime roughness is now 0.24, an authored ordinary-metal finish rather than a
measured alloy specification. The darker nonmetallic `Rim1` keeps its source
roughness 0.4. Tyres, brakes, lamps, painted body, geometry and rolling behaviour
are unchanged. Shared textures are not disposed or modified.

All 11 actual-asset tangent/wheel/batching/LOD tests and the production build
pass after this material-only calibration. Native rim appearance is documented
in the integrated scene report; neither correction establishes AAA car quality.
