# Canada Place cruise waterline and visual audit

2026-11-16. The implemented correction is limited to the existing cruise ship's vertical placement. Native appearance remains for the parent task to review. No berth movement, rescaling, terminal/podium changes, new reference download or texture is included.

## Confirmed placement defect and correction

`buildLandmarks` used its generic `place()` helper, which samples ground at latitude49.28845/longitude−123.1118, before translating the ship122m sideways and−25m longitudinally over water. The actual fully loaded collision data gives that parent origin y=**1.9643532500m**. Its transformed ship centre is **[717.6731950409, −579.1827398510]** in world x/z, and `collision.water` confirms water there. The ocean geometry in `World.terrain()` is at **y=0.065m**; the procedural hull's lowest ring is localy=0. The old complete ship therefore floated **1.8993532500m** above the water. The initial hypothesis of roughly7.7m was disproved by the actual source execution; the measured gap is1.9m.

The cruise parent now uses y=0.065, anchoring all81 vertices of the modeled waterline ring to the rendered ocean. The hull has no modeled underwater keel: this correction anchors its existing lowest ring and does not claim a physical draught simulation. Small boats and other landmarks retain the original ground-placement helper.

Unchanged registration: parent x/z=[595.3295793602,−602.4429999996], rotationy=−0.39rad; child offset=[122,0,−25]; all scales1. The world x/z bounds remain x[656.3271312085,779.0192588732], z[−696.6350300910,−461.7304496110]. The ship remains240m long in its local axis,34m maximum hull beam and43m from modeled waterline to mast top. Centre-to-source-PIER-edge horizontal distance remains42.0230886135m. This distance verifies unchanged placement; it is not a surveyed berth clearance.

Two focused tests execute the actual cruise branch using the complete local base/east/tags/terrain/road source fixture and loaded Canada Place capabilities. They check every waterline vertex against the owning ocean-plane expression, unchanged x/z/heading/scale/bounds/dock distance, and unchanged placement of the following landmark. Geometry cost is unchanged:695 construction meshes and30,040 triangles. These are **not695 runtime draw calls**: `World.mergeStatic(landmarkRoot)` subsequently bakes world transforms and merges by material/cell.

Before evidence: `artifacts/local/canada-cruise-source-audit.mts` and `.json`. The original measured JSON retains the pre-correction bounds/gap. The source photo comparison sheet is `artifacts/local/canada-ship-reference-contact.png`.

## Source-supported forward correction

The subsequent bounded [forward superstructure pass](canada-cruise-forward.md) implements this proposal. The remaining text records its source basis and the separate terminal scope; historical construction counts above describe the waterline-only checkpoint.

The retained [MCM Canada Place project](https://www.mcmparchitects.com/projects/canada-place/) photograph [Handford01](https://www.mcmparchitects.com/wp-content/uploads/2025/09/Handford-MCM-CanadaPlace-01-WEB.jpg) shows a bow facing the viewer beside the east operational quay. Its ship has a prominent layered forward superstructure: a broad projecting bridge with sloped glazing, a separate glazed observation level above, solid lower forward decks with rounded rectangular windows, and two separated radar domes. This gives the ship recognisable depth even before small railings. The source is a reference photograph only; its upload path does not establish capture date, and it is not a reusable runtime texture licence.

The current procedural ship is an unnamed generic approximation. It has five nearly identical rounded white deck boxes (length199−13k,width30−0.7k,height2.8m), repeated thin ledges and long **side-only** glass strips. Its forward and aft end faces remain white. The deck sides have surface strips rather than recessed balconies; its orange lifeboats and two domes already supply some layering. The existing forecourt native images show this vessel partly occluded by the terminal and nearby buildings, so a ship correction should not be oversold as the whole Howe-scene solution.

After the waterline native check, the best bounded vessel study is **one coherent forward bridge/observation-deck assembly**: trace the visible front tier ordering, project glazed wings and sloped bridge panes, and terminate that assembly into the existing side deck bands with closed reveals. Preserve current waterline, total length/beam, berth and unchanged hull until a named ship's plan/dimensions justify a broader reconstruction. Do not copy the photographed NCL livery or invent a vessel identity. This is stronger evidence than arbitrary extra windows on every deck. A preliminary budget is≤3,000 added/replacement triangles in the existing white/glass/dark material families; exact metric depths and correspondence to the present generic ship remain to be established before implementation.

## Terminal findings and scope boundary

Handford01 also explains some missing terminal layering: the **east operational quay** includes a deeply recessed lower service level behind columns, glazing above, a sloping intermediate canopy, opaque upper wall/parapet and separate public promenade. Its lower quayside is visibly close to the water, beneath the public deck. These are distinct from the already rebuilt curved **west** conservatory described in `canada-place-west-facade.md`; the west module must not be copied around the whole terminal.

The retained georegistered `aerial-reference.jpg` corroborates the east shoreline strip and overall terminal plan, but does not establish lower-floor elevations, column spacing or public access. A later east-quay assembly needs an exact decoded source-face removal audit and independently registered floor/support datum. It must not open the operational service level as a public walking route or turn the PIER solid into arbitrary negative space. This is larger than the waterline correction and overlaps neither the accepted hotel/tower nor the architecture agent's current promenade props/edge composition. No terminal source triangles were changed in this pass.

The current scene remains an interpretation, not a surveyed ship/terminal reconstruction. The cited photographs stay research-only; existing project model and OpenStreetMap credits are unchanged.
