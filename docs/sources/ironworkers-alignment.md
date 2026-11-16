# Ironworkers road-aligned deck and support

The four mapped motorway strips drift east of the previous straight bridge centre. Their actual rendered widths reach signedside−25.4485m against a deck ending at−18m, leaving as much as7.4485m of road outside the visible deck. This was independently measured from source segments; a recorded high-speed W-only departure is separate evidence and is not treated as proof that an on-road driver must fall.

## Source and bounded registration

`ironworkers-alignment-data.json` records the unmodified source `public/data/vancouver-roads.json`, SHA256 `490e30c13ab588ce6ced5e514898006f5bff89b11d11a7513fe0ca744f2a0d2d`, and road IDsw23795563,w48608388,w1059700345,w1275279652. Each remains three lanes/11.4m under the existing width function. Road coordinates, lane marks, names and travel headings are untouched. OpenStreetMap attribution and the underlying road-data licence remain documented in `docs/sources/vancouver-roads.md`.

The new centre follows the midpoint of the combined road-strip envelope at fixed original baseline chainage. The envelope includes each segment’s cross-section angle. Sixteen controls simplify201 sampled sections within10cm in plan. Two bounded6m endpoint extensions cover the source way-end mismatch and vehicle footprints while returning to the original clamped approach grade. Total rendered plan length including those ties is1,329.84757m; the old1,316.34190m straight line remains only the **grade reference**, not the visible deck centre. Width remains36m.

This is registration to the committed OSM-derived roads, not a new claim of surveyed bridge/pier geometry. Source engineering/photo dimensions and limits remain in `ironworkers-bridge.md`. The road envelope is20.096–23.385m wide, so the corrected deck contains the complete six-lane footprint without widening the road or introducing a broad invisible support area.

## Shared geometry/support contract

`ironworkersFrame(t)` and `ironworkersPoint(t,side)` use the same centre and mitered cross-section at every bend. `ironworkersTAtDistance` maps true plan distance to original gradeT; truss span lengths and bearing stations use plan distance. `ironworkersGradeT(x,z)` projects onto the untouched old grade anchors and clamps the approach heights exactly as before. The grade function and BRIDGES endpoint data do not change.

The asphalt top, concrete underside/fascia, existing rails and all below-deck trusses/piers consume these frames. The top and underside share187 longitudinal stations, including every bend and1m refinement near the clamped approach-grade transitions;2m cross-deck cells prevent a broad flat triangle from floating over the endpoint grade. Rail vertices evaluate grade at their actual lateral position. No duplicate top was added.

Ironworkers-only branches in `bridgePoint`, `bridgeSample` and `CollisionWorld.bridgeAt` replace the old18.72m straight-distance test with the exact rendered deck polygon. An outside-bounds fast rejection occurs before curve projection. The grade-reference t is intentionally distinct from distance along the curved plan. All other bridge paths, width rules and grade code retain their existing branches. This changes no fence or generic collision behavior; the existing sparse rails still await a separate physical-boundary pass.

The required `world.ts` integration is owned by root: `isIronworkersCarriageway(r.id)` enables the existing road subdivision/edge-following path only for the four source ways. This lets unchanged road strips sample the same corrected support/grade at their actual vertices. It must ship with the alignment; a deck-only change would not guarantee road-surface parity.

## Verification

Eight focused bridge/alignment tests pass:

- 9,373 vertices from actual generated source road strips lie inside the deck;11,160 complete4.9×2.86m lane-car corners are contained, including approach ends.
- 1,725 live collision samples on all source lane centres have the original grade and remain dry. Original travel spawn[6814.47,−945.94] and recovered point[6820.17,−1098.83] are supported.
- Every generated deck triangle has upward winding; all centroid heights agree with analytic support within10.91mm. Bends and approach interiors have no ray gaps. Tests allow only a13mm inboard terminal probe for Float32 world-coordinate edge rounding; named road ends are6m inside that terminal.
- Deck thickness, below-road steel, documented335/142/142m plan spans, bearing contact and open driving sky remain verified. Other bridges retain tested point/grade behavior.

The W-only recorded point[6829.47,−1087.27] is about9.8m outside the actual northbound road edge and remains outside the corrected deck. No invisible widening or autosteering was added. `main.ts` still uses explicit−3.1188 when travelling to Ironworkers with a car; V summon still uses nearestRoad.heading. Native retest should follow the curved carriageway with steering.

Geometry cost: corrected asphalt top6,696 triangles; underside/steel/pier structure41,796 triangles in two merged meshes,96 truss panels and14 bearings. Root owns current integrated build, ordinary northbound/southbound drive and quiet-frame performance acceptance. No full suite, build, browser or push was performed in this scoped change.
