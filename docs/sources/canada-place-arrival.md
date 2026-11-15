# Canada Place practical arrival

2026-11-14. The shared landmark spawn moves to the northbound Howe Street
approach to Canada Place, rather than West Cordova behind the intervening blocks.
It is an ordinary mapped-road arrival, not an elevated camera viewpoint.

- Game position: `(486.65, 0, -453.35)`; collision ground is 0 m locally.
- Latitude/longitude: `49.28710123032386, -123.11329693981561`.
- Heading: `2.4443631020289107` radians, following the mapped northbound segment.
- Source: `public/data/vancouver-roads.json`, OSM way `w1255990033`, Howe Street,
  tertiary, two-way,3 lanes (2 forward/1 backward), asphalt, `foot=true`.
- Segment: `(478.4,-443.5)` to `(494.9,-463.2)`; arrival is its midpoint.

`spawnPoint()` continues using the existing nearestRoad/safe path and road
heading. Both initial creation and map travel already consume that result;
`start()` resets mouse yaw from heading and travel resets both heading/yaw.
No camera override, view mode, fast-travel special case or main.ts edit is needed.

## Checks and limits

The actual mapped CollisionWorld returns the exact point from `safe(r=1.2)`;
a 2.8 m collision circle is clear. A 4.9×2.9 m vehicle footprint sampled at corners,
edges and centre is dry/unblocked, as are both 2.3 m exit offsets. The source-backed
arrival test and TypeScript pass. This does not certify live traffic clearance;
actors and dynamically added street props still need native gameplay review.

Using decoded committed Canada Place geometry (including its hotel/concrete,
glass, trim and steel),164 of 535 sampled fabric-triangle targets above 21 m were
first hit on sail fabric. Other rays hit Canada Place's own facade/structure.
This means partial sails and facade are available, not all five sails unobstructed.
A separate raycast against the actual procedural Convention Centre geometry
blocked zero of 54 representative sail-region rays. These are sample counts,
not pixel coverage percentages or a complete final-scene visibility proof.

The sail-region centre is about 214 m away and 2.8 degrees off the road heading,
compared with about 282 m at the previous West Cordova arrival. Native camera
height/pitch, trees, street props, traffic and building lighting may change the
view. Check car and foot arrivals and make a brief approach before acceptance.

The earlier western Canada Place street candidates were rejected: despite clear
collision, the procedural Convention Centre glazing, foyer and concrete blocked
most tested sail rays. Do not reuse the scenic-looking elevated 210 m candidate
without solving that actual line-of-sight obstruction.
