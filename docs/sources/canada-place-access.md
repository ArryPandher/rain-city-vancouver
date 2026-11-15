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

## Entrance evidence added November 14

The [Vancouver Convention Centre Outdoor Plazas Operating Guidelines](https://www.vancouverconventioncentre.com/fullpdf/outdoor-plaza-guidelines),
dated April 15, 2025, page 22 / Appendix B, supplies an identifiable **East
Convention Level Plaza** plan. It shows the street curb beside a continuous
front plaza, Pan Pacific ground-floor entrance, East Lobby doors and northwest
Flyover/Canada Place kiosk approach. It does not show a giant exterior stair
separating that whole frontage from the street. The plan was directly inspected;
it contains no surveyed spot elevations.

[City FOI 2022-067](https://vancouver.ca/files/cov/2022-067-release.pdf),
NHC/VFPA Central Waterfront District Topographic Surveys report section 1.3,
printed page 6 / PDF page 9, describes Canada Place street and the northern ends
of Howe/Burrard as elevated decking over lower Waterfront Road. This text was
available through the search index; direct PDF retrieval was blocked. Current
[Flyover directions](https://www.experienceflyover.com/vancouver/plan-your-visit/location-parking/)
likewise separate the public front plaza from the underneath-building parkade.

The source-backed problem is therefore missing elevated street/plaza
integration. The model's local 7.88 m is not established as an absolute surveyed
datum. A game-grade reconstruction may explicitly use an estimated local datum,
but must join the actual street network, public deck and neighbouring ground
continuously, with shared render/collision support. Preserve the lower service
route separately. No such repair is implemented in this checkpoint.

Local research records and the inspected plan are in
`artifacts/local/canada-place-entry-research/`; source PDF SHA-256 is
`f072a0805834c9a05e3eae73206741745916b734cd84a4fcca662afc449ad75a`.
Reference documents are not distributed as game textures.

A [bounded implementation plan](canada-place-grade-plan.md) now quantifies an
explicitly approximate solution: keep the source deck fixed, grade the actual
115.8 m Howe approach from Cordova, and connect the front plaza and west public
route. That can be authored without a civil-survey claim. Neighbouring facade
contacts, overhead wires and the western VCC seam must be handled in the same
pass; raising road ribbons alone would create new floating or buried geometry.
