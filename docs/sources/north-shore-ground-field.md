# Lower North Shore ground field — unattached diagnostic candidate

The existing mountain DEM begins at latitude 49.352. All 44 extracted urban
horizon buildings lie south of it, so the old sampler returns null beneath them.
This candidate supplies a real lower ground field from the **already cached**
Terrarium tiles, without attaching it to the scene, moving buildings, changing
roads or changing normal gameplay. It is the first implementation split of
`artifacts/local/north-shore-dem-review/URBAN-GROUND-PLAN.md`.

## Source and scale

`node scripts/prepare-north-shore-ground.mjs` produces the committed 26,141-byte
JSON; `--verify` reconstructs and compares its exact bytes. Both modes are offline
only. `scripts/lib/cached-terrarium.mjs` checks every tile against the original
manifest SHA256, decodes each once and shares its pending promise among samples.
Missing or changed files fail; there is no download fallback.

Only retained zoom 11 tiles 323/700 and 324/700 are required. The source is Mapzen
Terrain Tiles, including Canadian Open Government Licence information and USGS
fallback; exact tile URLs, hashes, attribution and licence URL are in the data.
Terrarium decoding is R × 256 + G + B / 256 − 32768 metres. Coordinates use
spherical Mercator pixel centres, bilinear source interpolation, then the same
quarter-metre quantization as the original DEM. Game coordinates retain origin
49.283/−123.12, longitude scale cos(49.2935°) × 111320 and latitude scale 110540.
This does not establish a surveyed finished-floor elevation or local tide datum.

The 70 × 83 visible grid is old DEM columns 201–270 and extended rows 208–290,
plus one retained source-cell halo for normal derivatives. The grid spacing is
approximately 79 × 80 metres; source pixels are approximately 50 metres. The
field has 5,810 visible vertices, 11,316 triangles and nine 32-cell chunks. Halo
source elevations range from −2 to 840 metres; no exaggeration, noise or invented
height clamping is applied. All 1,440 overlap/halo samples exactly equal the
previous derivative. Every selected urban footprint lies inside this source field.

## Exported contract

`src/world/north-shore-ground-field.ts` exports:

- `NORTH_SHORE_GROUND` and `NORTH_SHORE_GROUND_BOUNDS`: source and rendered bounds.
- `sampleNorthShoreGroundSource(x,z)`: bilinear inspection of retained grid heights.
- `sampleNorthShoreGroundSurface(x,z)`: exact height on the **actual rendered
  triangles**, including the same Float32 horizontal coordinates and diagonal.
  Both return null outside the bounds or for non-finite input; neither supplies a
  fallback or changes existing support.
- `createNorthShoreGroundGeometry()`: fresh caller-owned geometries with origin,
  source cell extents, position, normal, color and imagery UV attributes. The
  caller owns disposal. Shared module arrays are read-only internal source state.

One common local origin gives identical Float32 coordinates on every repeated
chunk edge. Source-halo derivatives produce the same normals and neutral colors
as the existing DEM on the proposed northern seam, row 208, beyond its old
southern fade. Geometry uses upward FrontSide winding. Attributes reuse the
existing neutral vegetation/rock and geographic imagery UV conventions; no new
material, texture, fog adjustment or color correction is introduced. The current
DNV orthophoto does not cover most lower urban ground. That missing imagery is
not concealed by stretching the mountain photograph or inventing urban texture.

## Integration remains explicit

This is intentionally **not a ready-to-attach rectangle**. It has no vertical
skirts, no invented podiums, no taper to zero and no water/land clipping. Only the
northern seam is already resolved. The western, eastern and southern edges still
need a source-supported land boundary and a reviewed connection to current City
terrain. An abrupt ~100 m edge or a short artificial slope is unacceptable.

Root-owned integration should enable all following under a separate diagnostic
candidate gate, leaving the current default and accepted DEM path unchanged:

1. Resolve the land/sea footprint and side/south transition against current ground;
   audit each crossing road grade and both bridge ties. Replace underlying
   terrain/cityBase/area triangles inside that footprint. Do not stack surfaces.
2. Replace old DEM cells columns 201–269, rows 208–225 within the shared footprint
   (2,484 triangles), retaining its northern seam. Side overlaps are not yet
   resolved. The raw net increase would be 8,832 triangles before clipping.
3. Reuse the finalized triangle sampler for road ribbon edges, overlay surfaces,
   tree bases and collision/player/vehicle/camera support. Outside the footprint
   preserve current values exactly. Road triangles need subdivision at ground
   triangle boundaries for exact contact; vertex-only draping is insufficient.
4. Place source buildings using the same finalized field. The 44 far shells and
   their nearby originals need identical level bases and heights through the
   2.9 km handoff. Maximum ground over each footprint requires perimeter/grid
   intersection and interior vertices, not merely a centroid or coarse samples.
   Close only the shallow local foundation to ground; never extend to y=0.
5. Broader buildings in the same footprint also need coherent bases. The earlier
   audit counted at least 11,313 buildings inside this study rectangle. It is not
   an isolated 44-building correction. Native northwest driving review must
   assess shore seams, ground/fog consistency and unchanged bridge contacts.

No World, Collision, urban-shell or loader hook is included in this commit.
These integration obligations cannot be met by simply adding the nine meshes.

## Verification

Four focused tests check every source overlap value, coverage of all 44 footprints,
all 11,316 triangle windings and barycentric support values, 100 actual Three.js
vertical ray hits, identical repeated chunk attributes, exact northern height /
normal / color parity with the original DEM, and null outside behavior. A
nonplanar-cell check distinguishes surface support from bilinear source sampling.
The existing integration modules are also checked to remain unattached.

No browser, full build, bulk data fetch, default promotion or native acceptance
was performed for this candidate. Native DEM screenshots already show geographic
relief but also pale western ground and urban ground/fog mismatch; this field
supplies missing source geometry for a coherent follow-up, not a claim that those
visible integration defects are already fixed.
