# Daylight landmark and wheel checkpoint

November 14, 2026, Vancouver. The target remains GTA 6–level, AAA world-class
realism; this checkpoint does not meet it. The updated goal is recorded in
`DAYLIGHT-LANDMARKS.md`, with Rockstar's official visual reference in
`VISUAL-REFERENCE.md`.

## Changes

- Corrected source car front-wheel axes, caliper parenting, measured rolling
  radius and excessive root lift. Both committed car assets retain their source
  tyres, rims and materials. See `sources/car-wheel-repair.md`.
- Canada Place has tapered mast shafts, fittings and attached tension stays.
  The original ten thin mast boxes are removed; sails and other geometry remain.
  Two additional batched draws and fewer than4,000 triangles.
- Canada Place arrival now uses the mapped two-way Howe Street approach and
  naturally faces the facade and visible sails. Initial driving, braking and
  normal exit were checked in the sole Codex tab.
- Robson's gallery-facing lower terrace has a ten-step concrete flight, with
  matching collision and the existing continuous side route retained.
- The Art Gallery source model buried its rear entrance inside its own wall.
  A source-pinned repair moves only930 identified vertices to the actual rear
  facade. All25,193 triangles, materials, other walls, dome and front portico
  remain. The exposed12-step flight now supports the player.
- Generic footpath triangles crossing the repaired stair footprint are clipped;
  both ground-level approach portions remain. This fixes the sloped path ribbon
  found during native inspection.

This release also includes the earlier saved Harbour Green fountain, stone,
frontage,1199 West Hastings, tree-detail streaming and tree-submission work in
`harbour-fountain-pass.md`.

## Validation

All **193 tests and the production build pass**. Final JavaScript is
`index-4_pYhdmP.js`. Source-asset tests establish preserved geometry, exact mast
replacement, wheel contact/rotation, stair/collision correspondence and path
clipping. These checks establish implementation behavior, not photographic
resemblance.

Native local review used only the existing Codex tab. The initial Howe Street
car arrival was(486.65,0,-453.35), heading2.444; forward input, braking and exit
finished on foot at(499.91,0,-472.76), with sails visible from the approach.
Robson lower-stair ascent/descent traversed(-130.79,0,112.08) to
(-146.56,1.68,127.88) and back to(-130.88,0,112.16).

At the repaired gallery entrance, the final generic path no longer covers the
treads. Native ascent reached(-51.32,3.01,30.28), with the historic facade still
closed. Backing down returned to ground at(-65.96,0,45.20). Ordinary camera views
show the exposed columns/stairs; the source facade remains visibly simplified.

Ignored local evidence includes `canada-daylight-driving-arrival.jpg`,
`robson-daylight-stair-approach.jpg`, `robson-gallery-daylight-view.jpg` (before
entrance repair), `gallery-stair-path-overlap.jpg` (rejected intermediate),
`gallery-stairs-final-daylight.jpg`, `gallery-entry-final-daylight.jpg` and
`daylight-landmarks-tests.txt`. A planned wheel pedestrian capture caught a
development loading screen and is explicitly excluded in the wheel notes.

## Open quality and access work

Canada Place's upper promenade remains inaccessible: whole-pier collision,
missing y=7.88m deck support/entry and an ocean-classified outer strip need a
source-grounded site repair. See `sources/canada-place-access.md`. Do not call the
promenade playable on the strength of the street arrival or rigging tests.

Gallery stone, windows, doors, side-wing shapes and garden planting remain
approximate. Harbour Green's background buildings, material response and
animation remain below the real-photo benchmark. The earlier20-second Harbour
samples averaged14.11fps stationary and24.68fps walking at903×670/DPR1.35, on
different workloads. This pass did not establish a new performance benchmark or
the sustained30fps/1080p five-minute gate. Later HUD values are spot observations.

No new night-mode work, photo mode, interiors, paid assets, extra browser/game
instance or remote GPU was introduced. Existing source licenses/attributions are
retained; user-supplied and Rockstar reference images are not game textures.
