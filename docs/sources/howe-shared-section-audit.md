# Howe / Granville Square / PwC shared-section audit

2026-11-15. Read-only follow-up to checkpoint 825fa45. No implementation, browser,
build or test changes. Sources establish a multilevel site and a useful existing
street-level constraint, but not a complete surveyed Howe section.

## Finding and next decision

The buried lower wing cannot be resolved reliably by lifting that building alone.
The current road profile and per-building roof normalization do not share a
verified elevation conversion. Establish a common street/terrace datum, then
change supported ground, retaining faces and lower frontages together. Keep the
wing's sourced 4.28 m roof difference and separate station ownership.

## Stronger elevation evidence

1. **City Central Waterfront Hub Framework, Figure 18, printed page 17.**
   [Official framework](https://guidelines.vancouver.ca/policy-plan-central-waterfront-hub-framework.pdf)
   and [lower-resolution copy actually read/rendered](https://vancouverwaterfront.org/wp-content/uploads/2015/05/cov-hub-plan-low-resolution.pdf).
   The black existing-network labels show **15.4 m at Canada Place / Howe** and
   **12.3 m at Granville / Cordova**. The latter is not the Howe/Cordova junction:
   do not turn their 3.1 m difference into a surveyed Howe longitudinal grade.
   Figure 18 was visually inspected to distinguish those labels from the red
   proposed A/B/C/D locations. The accompanying text identifies existing Granville
   Square parkade P1 at **14.9 m**. Proposed street levels 15.6 m and 13 m and the
   proposed 11.5 m below-street walkway are feasibility parameters, not built
   entrance elevations. Figure 19 concerns intersection constraints, not a
   dimensioned station section. This is planning evidence, not an as-built survey.
   [June 2009 endorsement record](https://council.vancouver.ca/20090707/documents/penv20090611min.pdf).

2. **City report, 30 March 2006, Appendix A page 1 (PDF page 5).**
   [Central Waterfront Hub & Rail Lands Study](https://vancouver.ca/ctyclerk/cclerk/20060418/documents/p1.pdf)
   describes Granville Square's front door/plaza about **18 ft / 5.49 m above
   adjacent Cordova Street**, formerly reached by an elevated pedestrian bridge.
   This supports a distinct upper plaza; it does not put the Howe station
   entrance, every wing floor, or all adjacent ground at that elevation.

3. **City 2009 LiDAR footprint metadata is explicit about the height fields.**
   [Dataset metadata API](https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/building-footprints-2009)
   defines TOPELEV_M as the highest geodetic elevation of an element and
   BASEELEV_M as its **lowest** geodetic elevation. HGT_AGL is essentially their
   difference. BASE_M is the shared building-group base. Therefore a part's base
   is not automatically its public entrance floor or adjoining curb height.
   The dataset warns its generalized 2009 records are approximate and best used
   for comparison. Cached group 150928 contains:

   | Part | Top | Lowest element elevation | Reported AGL |
   | --- | ---: | ---: | ---: |
   | Wing 161153 | 34.40 | 5.00 | 29.40 |
   | Wing 162139 | 30.12 | 7.17 | 22.94 |
   | PwC 161154 | 93.74 | 12.50 | 81.24 |
   | PwC 161155 | 97.64 | 15.14 | 82.50 |
   | PwC 162140 | 102.32 | 14.25 | 88.07 |

   Do not use the group's shared 1.8 m base or lowest wing sample as the street.

## Exact current discrepancies

- `canada-place-site.ts` authors Howe from Cordova baseline 0 to baseline 7.73,
  with 15 m slope easements over roughly 115.8 m. The end pedestrian finish is 7.88.
  The rise was a local integration estimate, not geodetic data.
- The wing/PwC roof conversion subtracts 19.32 from City elevations. If that were
  also a universal site conversion, Canada/Howe baseline 7.73 would imply
  geodetic 27.05 m, **11.65 m above Figure 18's15.4 m label** (road finishing offsets
  add about0.09 m). This conditional inconsistency is the reason to reconcile
  datums; it is **not** a recommendation to lift the wing11.65 m.
- The native profile `howe-wing-native-first-profile.json` puts the player at
  y 4.772 near(484.887, -454.827). The wing lower glazing ends at y 4.70, so the
  roadway visually hides that row. Immediately outside the wing the current
  support sampler returns 0 because the Howe ribbon/PwC apron does not cover it.
  Zero here is missing/legacy support, not an observed real-world depression.
- `createPwcApronSite` only joins PwC's first three footprint vertices to mapped
  Howe w232195213. It does not close the Granville-wing/station forecourt.
  `createPwcLobbySite` grades its floor from that apron while retaining its
  ceiling at 7.75. The wing's floors are fixed at their original datum. These
  are different integration contracts adjoining the same raised street.
- PwC's 83 m registry height and the City crown's 88.07 m above its lowest element
  remain inconsistent. Neither is an independent proof that 19.32 is the correct
  street datum; do not force them to agree by moving the surrounding site.

## Station plan: what is actually registered

Cached `canada-approach-buildings-reference/osm-map.xml` contains more useful
entrance topology than just the point:

- Entrance node **3633792226**, Howe Street, level 0, wheelchair=no:
  **(479.74852,-428.51936)** /49.2868766,-123.1133920.
- Sidewalk**w338228126** runs past it. The approach spur**w358462237** is 10.422 m:
  (487.76369,-433.02940) → (484.85964,-433.86950) → entrance.
- Stair run**w379737506** is 13.634 m in plan, from the entrance to
  **(470.76776,-418.26125)**. Tags: steps, incline=down, tunnel=yes, layer=-1,
  handrail=yes, ramp=no. This establishes a descending direction and connection,
  not its vertical drop, width or glass-roof extent.
- [Official TransLink entrance map](https://www.translink.ca/-/media/translink/documents/schedules-and-maps/skytrain-accessible-entrance-maps/waterfront_station_elevator_map.pdf),
  visually inspected, confirms Howe's Expo-only entrance without an elevator and
  below-street connections. It is schematic: no scale, landing elevations or
  dimensioned pavilion outline. The existing Codriver Waterfront Station asset
  describes the separate 1914 Cordova building and is not this glass pavilion.
- No pavilion footprint was found in the reviewed cached OSM ways or 37 City
  parts in group 150928. That limited search does not prove none exists elsewhere.

## Exact next footprint source and bounded correction

The [City 2022 orthophoto dataset](https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/)
is licensed under the Open Government Licence–Vancouver, captured June 6–July 1,
2022 at 7.5 cm source resolution. The entrance falls in facet **O7**. Large MrSID/ECW
ZIP links returned 403 to HEAD; no ZIP was downloaded. A public tiled service was
verified through [City portal item 89af6990b7334aeab8792b50351287a6](https://maps.vancouver.ca/portal/home/item.html?id=89af6990b7334aeab8792b50351287a6):

`https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer`

It supports TilesOnly, with actual levels 11–21. Tiles are 256 px, Web Mercator;
level 20 resolution 0.14929107082380833 projected m/px. The request pattern is
`.../tile/20/{row}/{column}`. Metadata was verified; tiles/roof tracing were not
performed in this audit. This offers a small georeferenced crop rather than a
large imagery download or another unsupported photo estimate.

Next work, in order:

1. Read a small ortho crop around the mapped entrance and trace the pavilion and
   adjacent terrace edges against the known sidewalk/spur/stair centreline;
   cross-check the 2015 photograph. Record aerial occlusion/roof-displacement
   uncertainty. Keep this research imagery out of runtime textures.
2. Obtain one actual Howe/Cordova or entrance-landing elevation control (road
   engineering/spot level or appropriate LiDAR surface), and reconcile it with
   the Figure 18 Canada/Howe constraint. Choose and document one common conversion
   for streets, terraces, wing and PwC; do not independently normalize each roof
   to a preferred registry height. Check the fixed Canada Place deck anchor too.
3. Author the mapped sidewalk/spur support and retaining closure, wing lower
   frontage/terrace and PwC floor as one section. The station's closed exterior
   can be reconstructed once its roof/landing bounds are registered; a playable
   underground interior is unnecessary. Native acceptance must include the
   ordinary car view, both walking directions and lower-side ground contacts.

This leaves a concrete source-backed next action while keeping today's datum
uncertainty visible. It does not establish a surveyed or complete street scene.
