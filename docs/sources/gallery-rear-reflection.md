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
geometry and support checks. Four tests pass. Native image comparison, valid
capture confirmation and weather-cycle review remain pending before acceptance.
