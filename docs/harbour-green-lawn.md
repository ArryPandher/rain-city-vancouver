# Harbour Green maintained lawn material

2026-11-14: scoped surface refinement; the mapped lawn, paths, terrain, stairs,
fountain, gardens and open sightlines remain unchanged.

Reference inspected: `artifacts/local/harbour-green-reference/contact.jpg`,
particularly Darwin photos 3 and 6, and the stored source manifest. Photo 3 shows
close-cut open turf beside a narrow worn paving edge; photo 6 shows continuous
open lawn around established trees, not a meadow or scattered shrub planting.

- https://www.darwinconstruction.ca/projects/development/harbour-green-park-1
- https://www.darwinconstruction.ca/assets/Projects/harbour_green/harbour_2_840x520.jpg
- https://www.darwinconstruction.ca/assets/Projects/harbour_green/harbour_5_840x520.jpg

The existing grass scan retains its documented 2.51m repeat. Subtle multiscale
albedo variation reduces conspicuous repetition. A high roughness floor and
reduced normal strength avoid wet-looking highlights on mown turf. Sparse
7–16cm triangle needles were removed: they read as isolated luminous spikes at
night, not dense short grass. No additional models or image assets were added.

A local 1024×768 RedFormat mask (768KiB CPU/GPU base level each, no mipmaps)
softens the lawn/path boundary with a narrow, irregular soil/turf blend and local
trunk margins. It uses mapped path widths, lawn rings and reconciled tree
positions. The wear distribution and colour are restrained visual
interpretations, not a survey of actual damage. The mask is generated once with
spatial buckets and adds one fragment texture sample; removed instanced grass
reduces geometry/draw overhead. Fine and broad shader noise add arithmetic cost.

Validation: `tsx --test tests/harbour-lawn-material.test.ts tests/harbour-green.test.ts`
(8 pass), `npm run check` (pass). This establishes mask bounds, fading, tree
locality, finite geometry, surface coverage and existing collision parity.
Browser shader compilation and day/night appearance require the parent agent's
render review; these tests do not certify appearance or performance.
