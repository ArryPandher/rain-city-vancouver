# Granville Square Howe wing: source audit and reconstruction

The ordinary parked-car view at `artifacts/local/rim-satin-before.jpg` exposes a
large chopped/repeating brick facade behind the car. This is a whole-scene
architectural error, not a texture-seam problem. The 2026-11-15 source candidate
replaces that building's generic architecture. Native acceptance is separate.

## Identified source and current error

The mapped building is **w208599553**, centred approximately at world
**(518.05, -427.30)** / **49.286866, -123.112864**, between PwC and Granville
Square. The saved camera's horizontal centre ray intersects its Howe edge,
[(516.049,-456.630),(497.549,-437.130)], at (501.273,-441.056), about 25.7 m away.
The generic architecture fallback receives `building=yes` without reliable
height/date/type metadata, invents a 12.8 m heritage block, selects
`gastown-arches`, repeats that photograph every 15 by 6 m and adds fictional
shop signs. The footprint is useful; the inferred architecture is wrong.

[A matching 2015 Howe photograph and author context](https://vanasitwas.wordpress.com/2015/08/09/waterfront-station-howe-street-entry/)
([direct photograph](https://vanasitwas.wordpress.com/wp-content/uploads/2015/08/img_0368.jpg))
shows a modern concrete office wing with deep rectangular window bands,
strongly splayed/cantilevered concrete sections, a tall pale vertical sign
volume and the separate curved-glass Waterfront Station entry in front.
The photograph is historical reference only, with no runtime redistribution
permission established. It is not a source for a texture asset.

[The property owner's aerial](https://assets.cadillacfairview.com/transform/f5d7a51c-9cdf-44b1-9d3f-aac40189536a/200-Granville-Aerial)
also shows the connected modern complex. Existing cached OSM and City source
parts locate the same wing. City parts 161153 and 162139 cover approximately
71.5% and 24.3% of its footprint; their recorded top elevations are 34.4 and
30.12 m. PwC's existing normalization subtracts 19.32 m, giving provisional
15.08/10.80 m relative values, **not surveyed heights above this street**.
Register the datum and levels against the sloping street/photo before adopting
them. The figures must not be blindly used for a new extrusion.

## Implemented ownership and source registration

`granville-square-howe.ts` is dispatched by exact ID before the generic fallback
in `architecture.ts`. Its own site, parts and materials modules replace the
invented brick facade, shops, parapet and roof equipment. Granville Square tower
**w128409618**, parkade **w116527978** and PwC **w138256216** retain their separate
renderers and collision ownership. The six-point live footprint is unchanged;
the vertex order is reversed to give inward-facing façade coordinates. No
entrance, road, support-surface or gameplay collision override is added.

`granville-square-howe-parts.json` retains the two raw City part rings and
attributes beside the registered roof polygons. The common boundary's two end
points move **0.399 m and 0.298 m** onto the enclosing retained map edges. The
interior kink is unchanged. The lower polygon follows that shared boundary;
the higher polygon is its complement inside the mapped outline. This closes
the map/source generalization gaps, with no thin high-roof strips, overlapping
caps or unfilled plan area. The roof-height difference remains **4.28 m**.

Sources and rights: © OpenStreetMap contributors,
[ODbL](https://www.openstreetmap.org/copyright).
[City of Vancouver building footprints 2009](https://opendata.vancouver.ca/explore/dataset/building-footprints-2009/),
group 150928, parts 161153/162139: contains information licensed under the
Open Government Licence – Vancouver. The broad group also covers other
buildings; its maximum height is not this wing's height. Part 162139 is labelled
pitched with median slope 30; ridge direction and section are unresolved. The
candidate uses a flat lower closure at its recorded upper envelope rather than
inventing a pitched roof from one scalar.

## Datum and photo-proportional fit

The source elevations are not heights above Howe Street. The provisional
**19.32 m subtraction** is shared with the adjacent accepted PwC reconstruction,
giving a main roof at **15.08 m** and lower roof at **10.80 m**, above the caller's
building datum. This is an integration hypothesis, not a surveyed datum.

The active mapped support sampler returns **0 m** just outside this wing and at
its centroid, whereas the saved ordinary parked-car position
(484.887, -454.827) has ground around **4.68 m**. The wing sits beyond the supported
Howe ribbon. Zero is legacy/missing ground evidence; it does not establish the
real building's ground level. Therefore the candidate does not lift or tilt
individual floors to that sampler. Its window courses, belt and roofs remain
horizontal, and its lower wall closes to the retained datum. A visible detached
base, overly exposed plinth or empty land between street and building must be
judged in the full native scene and cannot be accepted on the basis of this zero.

| Component | Candidate section in metres | Evidence strength |
| --- | --- | --- |
| Howe-facing length | 26.879 | Retained mapped edge |
| Chamfer/sign width | 8.276 | Retained mapped chamfer; sign association photo-fit |
| Lower glazing | 1.35–4.70, recess 0.70 | Photo-inspired bounded estimate |
| Middle glazing | 6.35–8.25, recess 1.10 | Photo-inspired bounded estimate |
| Splayed concrete belt | y 8.25 at depth 1.10 to y 10.35 at depth 0.08; straight head to 11.25 | Visible sloping section; dimensions inferred |
| Upper glazing | 11.25–13.95, recess 1.05 | Photo-inspired bounded estimate |
| Sign | top 15.90, depth 2.00; eleven horizontal panel courses | Volume/pale material/name photo-supported; exact dimensions and course count inferred |
| Main window modules | Eight across Howe edge, nominal 3.3 m pitch, 0.46 m piers | Rhythm inferred, not an as-built count |

For the adjoining PwC comparison, its existing nominal lobby top is **8.20 m**:
this wing's middle window head is **0.05 m above it** and the underside of the
splayed belt begins there. The upper wing roof is **6.88 m above** that PwC datum;
the sign rises another **0.82 m**. From the saved 4.68 m street, the wing roof is
about **10.40 m** above the player's ground and the main visible window courses
are the middle and upper rows. This matches the photo's low modern wing beside
PwC better than a three-level block planted on the elevated roadway, but the
historical photograph alone does not certify the absolute heights. The candidate
must still be assessed against PwC, the street and the full ordinary view.

## Physical section and material response

The façade has actual concrete jambs, upward sills and downward soffits, with
recessed glazing at 0.70–1.10 m. The upper belt has a physical sloped surface,
narrow recessed construction joints and closed end returns. All vertices stay
inside the existing collision footprint; the projection is expressed by
recessing adjacent surfaces, not by putting invisible collision-free masses
over the sidewalk. The sign has front, sides, top and exposed rear closure,
panel recesses and narrow vertical strips. Its name uses a locally generated
alpha-tested text mask. There are no fictional shops or tenants.

Concrete uses the already-shipped `canada-place-plinth` CC0 mineral set with
independent sampler clones, metric face UVs and a **1.6 m** repeat. The base colour
is sRGB **#b5b1a4**, metalness 0, roughness 0.91, normal scale 0.13. This is a
generic exposed-aggregate approximation, not a scan of the actual concrete.
Sign panels are sRGB **#b8c2c5**, metalness 0, roughness 0.52. Windows use an opaque
coated-glass exterior proxy, sRGB **#62706e**, metalness 0.32, roughness 0.16,
clearcoat 0.70 with roughness 0.13. Their metre-deep geometry supplies the visible
recess. This does not model optical transmission or a gameplay interior. There
is no emissive fill, new reflection capture, light, exposure change or source
photograph in the runtime assets. Material appearance still needs native review.

## Resources and validation

The assembled candidate, including the name, contains **2,910 triangles,
5,816 vertices and 203,572 bytes** of position/normal/UV/index buffers in **six
material batches**. These are new assembly totals, not the net whole-scene delta:
the previous generic shell, shops and equipment are removed from this ID.
The single 1024×384 name-mask canvas is 1,572,864 bytes at RGBA8 before mipmaps,
approximately 2,097,148 bytes with a full mip chain. This is an allocation
estimate, not a GPU/process memory measurement. Mineral images are already
shipped and their pixel sources are shared; sampler state is isolated. No new
network media payload or transparency/refraction pass is introduced.

Nine focused Granville tests cover the retained real map registration and
neighbour dispatch, source roof partition/height difference, one roof closure
per part and the shared vertical wall, first-hit glass depths and physical
reveals, splay normals/joints/end closures, the closed sign and upright text UVs,
all-vertex footprint containment, finite normals/metric UVs, material sampler
ownership, and caller datum offsets. The adjacent ten PwC tests also pass.
TypeScript checking and `git diff --check` pass on the combined worktree.
Native movement, full-scene ground contact and cosmetic acceptance remain the
parent review's responsibility; these source tests do not demonstrate AAA
fidelity or a solved street scene.

The station entry has separate OSM node 3633792226 at approximately
(479.749,-428.519); its glass pavilion is supported by the photograph, but its
roof footprint remains unresolved. Do not invent an entrance polygon or move
it onto the wing merely to fill the view.

The next review is the saved car pose, the wider driving approach and a close
oblique walking view. Check concrete scale, readable recesses, sign/PwC
proportions and particularly the disconnected ground-strip risk described above.

## First native review and sign correction

`artifacts/local/howe-wing-native-first.jpg` shows the intended substantial
improvement from invented brick shops to the modern concrete wing. It also
confirms that the lower window row is hidden behind the raised roadway. Its
head is y=4.70, while the matched player is on the road at y=4.772. The photograph
shows exposed lower frontage and a terrace/pavilion relationship; the candidate
does not reconstruct that relationship. This is a remaining whole-scene visual
defect, not evidence of a surveyed below-street floor in this building.

There is insufficient independent elevation evidence to justify lifting the
whole wing by the current road height. The 19.32 m subtraction and PwC's 8.20 m
lobby top are authored reconstruction choices, not two independent surveyed
control points. A global uplift would preserve the 4.28 m roof difference but
change the adjacent PwC relationship and could expose a large unsupported base
on the lower side. No vertical correction is made in this pass. The next site
correction must reconcile the source-visible lower frontage/terrace with the
raised road and adjoining PwC floor together; zero in the unsupported terrain
sampler cannot settle that choice. No missing station roof or staircase is
invented to conceal the gap. Upper glazing also remains a fairly uniform
blue-grey proxy in this view, rather than the reference's varied dark glazing.

The first native sign text was horizontally mirrored. The original test checked
only the façade-local along axis, which points toward an outside observer's
left. The lettering quad now starts at physical viewer-left and maps increasing
U toward viewer-right. A perspective camera outside the actual sign casts two
rays at screen-left/right positions; interpolated UVs must be U=0.25 and U=0.75.
This catches the visible failure instead of merely repeating local indexing.
Nine focused tests and typecheck pass after the correction. The resource counts
are unchanged; native confirmation of the corrected lettering follows separately.

## Source-dark ribbon glazing candidate, 2026-11-15

The normal driving view `artifacts/local/howe-final-driving.png` exposes the
Howe wing behind the separate station pavilion. The cached 2015 source image
`artifacts/local/granville-howe-reference.jpg` shows distinctly dark window
ribbons under the concrete splay; the prior light opaque metallic/clearcoat
proxy made those openings read as pale panels. This pass supersedes only the
old glazing response described above. Source geometry, concrete, roof,
lettering, mapped footprint, datum and all 0.70–1.10 m reveals remain unchanged.

The existing `createExteriorLobbyGlass` two-interface dielectric sheet now
replaces the opaque painted-window proxy. It has neutral white incident tint,
IOR 1.5, roughness 0.12, throughput 0.82, metalness 0 and no clearcoat/diffuse
paint contribution. These are restrained exterior fit values, not surveyed
optical properties. It exposes the existing dark frame closure only 6 mm behind
the pane; this is deliberately not a claim of a modeled room. No new backing,
interior, refraction render, reflection image or runtime texture is added.

`granvilleHoweReflection` supplies one 256px static street capture, 1.2 m outside
the main Howe facade (ring edge 3) at its midpoint. Capture height is caller
datum +9.75 m, between the middle and upper window bands. Day/night environment
intensity remains 0.9. The shared reflection system excludes all panes using
this unique receiver and moving actors while retaining neighboring surfaces,
concrete and the original closed backings. Weather invalidation retains the
existing fallback/lifecycle behavior. A single cube for this small building is
still an approximation; it does not supply exact per-pane reflection parallax.

The assembly retains 2,910 triangles and six material batches. There is one
additional dirty-only six-face capture and approximately 10 MiB of raw cube
plus filtered color storage before depth/driver overhead. No downloadable
asset, asset license, texture memory or geometry buffer changes occurred.

Focused verification passes 23 tests across the wing, dielectric optics and
reflection lifecycle; targeted TypeScript diagnostics and scoped diff checks
pass. Actual mesh rays verify all three main ribbon courses still hit glass
first and the original closure 6 mm later. Capture tests check the owning
receiver's exclusion, retained neighboring glass/backings, omitted actors,
scene restoration and invalidation. These tests establish integration and
bounded optics, not the appearance of a rendered GPU image.

Native acceptance remains pending: compare the exact saved driving camera with
`granville-howe-reference.jpg`, with both builds settled in the same daylight.
Keep the candidate only if the window ribbons read darker/deeper while local
reflections remain plausible and bounded; inspect the raw cube if the result
is uniformly black or mirror-bright. Recheck ordinary station-front walking
and report capture/steady-state cost separately. No AAA-quality claim follows
from this scoped material change.
