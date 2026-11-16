# Gallery rear-window environment

Native `982a753` terrace inspection found the restored sash windows reading as
flat blue panels (`artifacts/local/gallery-terrace-access-native.png`). Their
existing material saw only the global HDR environment, despite the surrounding
Robson trees, square and buildings.

The replacement rear facade now owns a clone of its existing glass material.
A single 256 px static cube capture, registered with the existing reflection
system, sits 2.5 m outside the actual decoded rear facade at local height 7 m.
The facade's rotated source frame and landmark translation determine its world
position. Other elevations retain their original material/environment. The
reflection system excludes the receiving panes and moving actors, and refreshes
the capture when nearby after lighting changes.

This adds no geometry or external texture source. It does allocate one cube
target and its filtered environment; it is an approximate shared local capture,
not ray tracing or per-window parallax correction. The existing pane colour,
roughness and metalness remain unchanged for a controlled visual comparison.

Actual-source facade tests verify independent rear-pane ownership, outside-face
capture position and landmark translation, alongside the existing aperture,
geometry and support checks. Four tests pass.

Native `0c5dad7` review confirmed a valid 256 px capture and inspected its raw
faces. The visual gain is modest: the panes still read dark at terrace distance.
With exactly unchanged player and camera, a South → Southeast → South daylight
cycle returned a 138 × 88 px window crop pixel-identically (MAE 0). Evidence:
`artifacts/local/gallery-reflection-{after-profile,cycle-profile,cycle-pixels}.json`
and the accompanying native images. This verifies daylight refresh, not a
night-weather cycle or a major realism improvement. Further material and
architectural work is still needed.
