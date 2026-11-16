# Ironworkers vehicle arrival and ordinary lane-following route

2026-11-17. Bounded vehicle-only fast-travel correction using the current immutable OSM road layer. It does not change traffic flow, bridge geometry, driving physics or steering. Walking arrivals and every other destination retain their existing behavior.

## Diagnosis from full city data

The old map arrival resolves to **[6814.8900443,0,−949.9223529]** on northbound approach **w507979055**, with the hard-coded heading−3.1188. It is not initially in the opposing carriageway. That approach has two one-way lanes, so its source centre is the dividing line between them. Its local heading is3.0358244495; the wrapped heading error is **7.36599°**. `safe()` leaves the centre unchanged because it is unobstructed pavement; it does not select a lane.

The four bridge ways form two separate three-lane one-way chains. Northbound: **w48608388→w1275279652**; southbound: **w23795563→w1059700345**. Their coordinate progress and existing AI placement agree with these directions. No AI reversal is implicated.

The earlier opposing-lane screenshot is a later position. A straight ray from the old arrival at its fixed heading is6.03m from the northbound centre after600m, beyond its5.7m half-width, and inside the southbound strip. After700m it is7.06m from northbound centre and4.61m from southbound centre. This establishes why holding a fixed heading can reach opposing lanes as the road curves; it is a geometric diagnostic, not a simulated driving trace.

Reproducible read-only audit: `artifacts/local/ironworkers-vehicle-arrival-audit.mts`, audit JSON and `ironworkers-vehicle-arrival-route.json`. The earlier crest audit remains in `ironworkers-traffic-direction-audit.md`.

## Corrected arrival

`ironworkersVehicleArrival` selects station **40m from the source start of w48608388**, after the short approach transition. The exact source point is **x6815.707322133344,z−991.851646018485**, segment4, t0.06619847618; heading **−3.1228782611268984**. The source centre is the middle lane of this three-lane carriageway. Current full-data collision grade is2.9081609203m; the asphalt finish is+.092m. The existing vehicle ground/model synchronization supplies the final player/model height, so the collision grade is not a fixed visual spawn elevation.

The helper verifies the exact road ID, motorway source kind, one-way flag and three-lane count. It uses the ordinary driving chassis/corner clearance routine for placement and a12m departure. Source/contact failure falls back to the existing landmark placement. Vehicle heading, mouse yaw and state use the same selected source heading. No special camera mode, forced lane keeping or autopilot is introduced.

Focused tests use full unchanged city data and117 chassis/centre/corner probes over the first12m. Every probe stays inside the3.6m middle lane, has clear body/water contact and hits upward-facing rendered asphalt within5mm of its live grade plus finish. The road surface check uses the same source subdivision, per-edge road height and ribbon generation as `World.roads()`. Nearby northbound AI has exactly the same source heading, offset3.6m into its neighboring lane; southbound AI has the opposite heading on its separate way. Tests execute the actual `travel()` method and preserve non-Ironworkers vehicles, Ironworkers walking and the Robson walking arrival. Source road arrays are not mutated.

## Normal driving acceptance route

Start in a car, open the map and choose Ironworkers. Remain in the **middle of the three northbound lanes**, between the two white dashed dividers. Drive without boost for the comparison. Use short A/D inputs to follow the road markings and release steering after each correction; do not hold W at one fixed heading across the curved deck. The following are source-route reference stations for checking an ordinary drive, not hidden teleport targets or an automated trajectory.

| Distance from new arrival | Source station | Middle-lane x,z | Local heading | Approximate collision grade |
|---:|---:|---|---:|---:|
|0m|40m|6815.707,−991.852|−3.122878|2.908m|
|110m|150m|6813.705,−1101.833|−3.124286|12.272m|
|210m|250m|6811.975,−1201.818|−3.124286|20.655m|
|310m|350m|6810.693,−1301.810|−3.131637|28.041m|
|410m|450m|6808.870,−1401.792|−3.119927|33.827m|
|510m|550m|6807.476,−1501.778|−3.136721|37.570m|
|610m|650m|6806.955,−1601.777|−3.121622|38.991m|
|710m|750m|6804.958,−1701.757|−3.121622|37.984m|
|810m|850m|6802.961,−1801.737|−3.121622|34.624m|
|860m|900m|6802.170,−1851.730|−3.126073|32.133m|

The subtle changes are alternating: slightly right as the heading approaches−π around station350, left around450, right around550, then left into the long near-crest segment650–850. Visual markings take priority over attempting to type exact angles while driving. At station750 the correct middle lane is aroundx6804.96; the older screenshot's x6797.68 was in the separate southbound carriageway. Stop or slow safely within the northbound lane for the east workshop/crest comparison. Native end-to-end driving acceptance remains pending; no completed bridge crossing is claimed by these source and contact checks.
