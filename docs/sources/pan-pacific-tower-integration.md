# Pan Pacific tower integration and walking view

The complete hotel tower replaces 3,140 guarded source triangles. The original scene is validated before any edits. Paving and independently guarded podium/concourse cuts run first; all five source tower primitive buffers then change atomically. Their existing meshes retain those same buffers. The replacement is installed only after the complete transaction succeeds.

Four opaque material roles share merged geometry; the glass mesh contains its attenuation/reflection pair in adjacent ordered groups. One 256px reflection capture sits five metres outside the middle of the broad southwest curtain face at local `[-154.744568,52,92.026581]`. The existing group adds 0.08 m to its vertical datum. Roof and exposed podium cap ownership remain separate; the tower adds no duplicate base floor.

The architecture and materials use licensed source geometry, a cached aerial, Handford street photographs and a historic floor plan as references. Photographs are not distributed as runtime textures. Plan parallax correction, metric roof heights, terrace depths and unseen crest depth remain inferred; this is not a surveyed reconstruction. See the tower source, architecture and materials notes for provenance.

Ordinary third-person walking now supports natural upward looking. The existing collision-resolved camera boom, ground clearance and interpolation remain in use. Positive pitch retains its exact existing look target; negative pitch smoothly transitions to an angular target, reaching about 50 degrees upward. Aiming, vehicle and first-person branches retain their prior behavior.

## Verification

- Actual decoded source contact tests cover complete concave footprint subtraction, perimeter support, base skin/frame projections and preserved exposed cap.
- Camera tests cover unchanged normal framing, continuity and upward viewing with shortened or raised camera booms.
- Camera-only native baseline uses mode 0, FOV 62, player `(486.0637613931,8.2599527647,-436.3726305676)`, camera `(484.8559004144,10.3299527647,-432.2457586461)`, yaw `2.8568631020`, pitch `-0.43775`. The replacement was compared at exactly the same camera.
- Initial candidate native walk, reverse at 24 km/h, brake to 0, exit and pistol ammo 15→14 succeeded. Console warnings/errors were empty. Native images/profile JSON remain in `artifacts/local/tower-*`.

The new silhouette and facade hierarchy are substantially closer to the references, but the scene remains below the GTA 6/AAA target. Lower surrounding architecture, material/reflection richness, street activity and smoothness need further work. This pass makes no sustained frame-rate improvement claim.
