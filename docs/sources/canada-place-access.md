# Canada Place promenade access gap

Identified during native daylight review, November 14, 2026. This is an open
defect, not an implemented access repair.

The new Howe Street arrival provides a visible Canada Place facade/sails view
and supports a normal car start, braking and exit. Walking farther toward the
terminal revealed a large blank base wall. Source inspection explains it:

- The committed Canada Place GLB has a pier prism from y=0 to 7.8m. Its runtime
  group adds0.08m, placing the modeled public promenade at y=7.88m.
- `CollisionWorld` still treats OSM building `w223635729` as a solid whole-pier
  footprint. Hiding the duplicate generic building render does not remove that
  collision polygon.
- There is no Canada Place public-deck height override or connected entrance
  route. The outer east terminal strip is classified as ocean, including the
  mapped service-road segment from(536.5,-522.6) to(694.5,-607.6).

The resulting model can be viewed from the street, but the public promenade
cannot yet be honestly described as a walkable gameplay route. The native car
approach ended on foot at(499.91,0,-472.76). Read-only map/collision sampling found
the street/shore route through(522,-477) to(531,-489) clear; those latter segments
were not traversed in native gameplay. A view toward(640,-630), yaw~2.48, is a
candidate exterior inspection point. Do not continue northeast into the ocean
strip as a workaround.

Next: establish the real lower/upper promenade and street-entry relationship
from architectural site/photographic references, then author bounded public
deck support and its connected approach. Replace whole-pier blocking with actual
terminal/hotel obstacles while keeping interiors closed. Check player/car/bike
contact, street transitions, the sea boundary and camera clearance against the
rendered geometry. Do not simply shift the entire landmark down7.8m or add an
arbitrary ramp without resolving the site datum and source-visible entrance.

Geometry/material sources remain those in `canada-place.json` and
`canada-place-rigging.md`. The blank base, simple facade detail and inaccessible
promenade are substantial remaining fidelity gaps, regardless of passing mast
geometry or arrival-clearance tests.
