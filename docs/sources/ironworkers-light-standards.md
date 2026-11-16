# Ironworkers deck-mounted light standards

The ordinary native view `artifacts/local/ironworkers-fence-filtered-arrival.png`
shows short dark generic street lamps beside the bridge. Two discrepancies are
supported independently: the retained completed-path photograph shows pale
metal bridge standards with long mast arms, and `World.streetDetails()` places
its generic lamps at `CollisionWorld.groundHeight`, which excludes the bridge
profile. Those generic bases remain near zero while the deck rises toward 40 m.
This replacement uses the actual bridge grade, without changing that grade.

## Source observations and estimated dimensions

- [TranBC completed east path, February 2015](https://www.flickr.com/photos/tranbc/16444190361),
  cached `artifacts/local/ironworkers-reference/tranbc-2015-opened.jpg`: pale
  galvanized east-side pole on the traffic separator; repeated braced arms extend
  inward over traffic. Across the road, curved cobra arms are visible. This is
  the completed widened path, not the temporary construction fence.
- [Graham bridge improvements](https://www.grahambuilds.com/ironworkers-memorial-bridge-improvements/),
  cached `artifacts/local/ironworkers-reference/graham-improvements.jpg`: repeated
  pale, narrow standards with a vertical extension above paired triangular arm
  members. The temporary yellow construction brackets are **not** lamp fixtures.

The documented 3 m outer fence and visible people/vehicles provide scale context,
not a survey. A roughly 9–13 m fixture height and 2.5–4.5 m inward reach are
plausible photographic envelopes. This candidate chooses an 11.6 m east mast,
11.3 m luminaire centre and 3.4 m arm reach, measured from the mounting plate.
The west pole has a continuous segmented bend into the same luminaire envelope.
The estimates should be judged in an ordinary native driving view, not presented
as exact manufacturer dimensions or current lamp inventory.

The retained street-detail cadence of 47 m is reused as an authored longitudinal
interval, beginning 25 m from the south end and stopping at least 25 m before the
north end. There are 28 positions on each side, 56 fixtures. Exact pole station,
pairing, housing section and material parameters are approximate. No claim is
made that aerial evidence resolves individual station spacing. The two research
photographs are not redistributed or used as runtime textures.

## Geometry and grounding

`src/world/ironworkers-light-standards.ts` uses the existing aligned plan and
`deckHeight(ironworkersGradeT(x,z))`. The 34 × 36 cm plate and tapered 30 cm mast
base sit within the existing 45 cm separator curb at signed offset ±15.075 m.
The plate is embedded 2 cm in the curb so its level base closes against the
slightly graded top. No sidewalk, lane, curb, rail or source road vertices change.
The 2.5 m clear walkway remains open; no replacement walkable surface or contact
policy is introduced. Tall pole collision above the existing finite separator is
not added by this exterior-only module; unrestricted jumping/photo-camera contact
is not claimed by the ordinary route clearance checks.

Eight-sided tapered tubes, braced east arms, six-segment curved west arms and
closed luminaire housings produce 11,872 triangles. Six longitudinal chunks each
have a metal and diffuser batch: 12 draws before the usual static scene pipeline.
Each mesh has a nearby object origin and computed bounds to avoid the previous
world-origin distance-culling error. Metal casts/receives shadows; the small
underside diffuser receives but does not cast. No shader, sky, exposure, light,
texture download, artificial local glow or reflection capture is added. Both
materials are opaque and non-emissive. Independent night illumination is outside
this geometry pass; the new diffuser currently has no night glow.

## Root-owned World integration

Exports:

- `createIronworkersLightStandards(deckHeight)` returns the group. The caller owns
  geometry and two shared material disposals. Add once before normal static merge
  and culler registration, using the same actual collision `bridgeHeight` callback
  as the deck. Group metadata reports fixture/triangle/draw counts.
- `replacesIronworkersStreetLamp(road)` matches only primary roads with IDs
  `w23795563`, `w48608388`, `w1059700345`, `w1275279652`.
- `ironworkersLightPlacements(deckHeight)` exposes the tested source-aligned bases,
  orientations and stations without allocating mesh geometry.

Inside the existing streetDetails lamp loop, **after** the `count++` side and x/z
calculation but before generic lamp emission/water checks, continue when the
replacement predicate matches. Preserve the count sequence for all other streets.
Do not skip the entire road: signs are emitted outside the lamp loop and remain.
Do not leave the old sunken lamps beneath the new fixtures.

This module does not register new `streetFurniture` points or alter prop collision.
Its poles lie within the existing separator, outside ordinary walk/drive corridors.
Root owns the World hookup; no main, Collision or source data changes are included.

## Verification and native review

Four focused tests verify all four actual source IDs, unchanged horizontal bases
under elevated/sloped callbacks, correct deck-relative crest mounting, plate rays
against actual existing curb boxes, every low fixture vertex inside the separator
footprint, 1,008 ordinary route/camera rays against actual fixture triangles,
localized bounds, material opacity/shadow flags, and absence of lights/emission.
These are geometry tests, not a claim of native acceptance or frame-rate gain.

Root should use the same northbound Map Car arrival and an uphill driving view.
Expect a continuous row of pale, tall road-facing standards instead of black
stubs disappearing into the crest. Check east bracing and west curved arms at
near and medium distance, walkway width, pole-foot contact, and distant aliasing.
No build, browser session or push was performed for this scoped candidate.

## World hookup verification

The root-owned integration is now exercised by two additional focused tests. A
bounded execution of the real World build method stops immediately after the
fixture hook, before streets/terrain/asset construction. It verifies exactly one
group, all 12 children registered once for distance/shadow culling, and rays at
all 56 actual bases under a raised, sloped endpoint grade. Actual World.update
and ShadowCasterVolume keep nearby fixtures visible, cull them from downtown,
restore them on return, and never enable diffuser shadows.

The actual World.streetDetails method is run twice over the four retained bridge
roads interleaved with six nearby source primary roads. The baseline changes only
those four IDs to bypass the replacement predicate; every coordinate/tag remains
the same. Captured material roles and all emitted position/normal/UV/index bytes
show 191 generic bridge lamp parts removed, all four bridge sign parts identical,
and all 43 unrelated parts identical. Input source records remain unchanged. This
checks the owning loop and its global side/count sequence, not a copied loop.
The sign-text canvas is a minimal test fixture; no browser or GPU render is used.
