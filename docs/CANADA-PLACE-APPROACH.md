# Canada Place connected approach

The Howe Street arrival previously faced an inaccessible pier wall: the licensed
landmark's public deck is at 7.88 m, while the adjoining roads were near zero.
This change connects the mapped Howe/Canada Place approach to a bounded front
plaza entrance and the western Canadian Trail. The hotel, exhibition halls,
private terraces and lower solid pier remain closed.

The fixed model deck is an explicitly estimated local datum. The official VCC
plaza plan and visitor directions establish the connected public route, but do
not establish surveyed street grades. See the [grade plan](sources/canada-place-grade-plan.md),
[deck sources](sources/canada-place-deck.md) and
[rendering notes](sources/canada-place-approach-rendering.md).

The approach uses a shared, eased height profile, real mapped building holes,
supported pavement, retaining walls, crossing openings and perimeter guards.
The western endpoint matches the existing VCC approach across its full width.
Buildings retain their prior bases; generated ground-floor shopfronts buried by
the new decking are omitted. Four mapped service/driveway stubs retain their
previous rendering height throughout, avoiding spurious ramps where they cross
the new support boundary. Their exact levels and real entrance positions remain
unverified; no new access into those properties is claimed.

The entrance opens one source railing component and removes two posts, with
source-count/bounds guards and a closed rail end. Other rails, masts and model
surfaces remain. Generic pedestrian ribbons are cut at the source pier so they
cannot overlay the deck or enclosed masses. Actual GLB rays verify the public
surface; the collision exception is restricted to the coarse whole-pier ID,
the supported public mask and actors already near deck level. Low actors cannot
climb retaining walls by crossing their plan footprint. Vehicle exits now choose
a nearby clear position on the same level, including an opposite-side exit when
the preferred door faces a drop.

Automated validation: 230 tests and the production build pass. New checks cover
source GLB support, entry clearance, untouched source steel, building exclusion,
grade continuity, retaining walls/UVs, guard placement, driveway render heights,
the complete sampled public route, lower-pier solidity and vehicle exits. A
native driving check also found the initial bicycle projecting into the car's
path. Startup placement now rechecks spacing after projection; contact response
allows separating vehicles to back away and excludes vehicles on another level.

Native local walking reached (530.81, 7.88, -616.48) along the Canadian Trail,
fired the pistol (14/180 rounds remaining), and returned through the same entry
to (429.89, 7.73, -524.19). No ocean reset or closed-mass traversal was needed.
Saved views: `artifacts/local/canada-deck-entry-local.jpg` and
`canada-trail-walk-local.jpg`. These captures precede only the startup bicycle
and contact-response correction; the approach/deck geometry is the same.

This is a connectivity and physical-coherence checkpoint. The source terminal
and hotel remain approximate, with large plain facades, generic neighbouring
architecture and limited street activity. Neither real-photo correspondence nor
GTA VI / AAA visual quality is achieved. Daylight gameplay and sustained frame
time remain the acceptance standard.
