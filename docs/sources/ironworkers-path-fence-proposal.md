# Ironworkers sidewalk and safety fence proposal

2026-11-16. **Proposal only, after alignment 48f1e8f.** No live geometry, collision, source roads, alignment or other bridge changes. Root is reviewing the integrated alignment candidate 25549fc natively. The earlier `artifacts/local/ironworkers-fence-alignment-proposal.md` describes the superseded straight-deck baseline; its alignment prerequisite is now implemented.

## Reference and appearance

- [BC Ministry, east sidewalk opened 4 February 2015](https://news.gov.bc.ca/releases/2015TRAN0012-000127):2.5 m shared path and3 m safety fence.
- [BC Ministry, both sides complete 3 September 2015](https://news.gov.bc.ca/releases/2015TRAN0109-001440): widened sidewalks and pathway approaches.
- [TranBC completed east sidewalk photograph, 4 February 2015](https://www.flickr.com/photos/tranbc/16444190361), inspected locally as `artifacts/local/ironworkers-reference/tranbc-2015-opened.jpg`. Original image URL: `https://live.staticflickr.com/8676/16444190361_769dafe438_b.jpg`.
- [Graham construction description](https://www.grahambuilds.com/ironworkers-memorial-bridge-improvements/): lightweight precast sidewalk panels and floor-beam extensions.

The completed photograph resolves a material distinction: the outer fence is galvanized **closely spaced vertical flat pickets**, with a bottom member, intermediate horizontal member and round path-side handrail. It is not chain-link. Beside traffic is a low concrete curb supporting three horizontal steel rails and intermittent vertical posts. The walkway has transverse concrete panel joints. The fence continues above the handrail to its documented3 m height. No new overhead cross-bracing or mesh across the driving sky is justified.

Only overall fence height and clear path width are documented dimensions. Exact picket pitch, thickness, rail section, curb height, panel rise and finish are photographic estimates requiring native review. Photos are research references, not runtime textures; no photo redistribution/licence claim.

## Bounded cross-section using the accepted alignment

All offsets use `ironworkersPoint(t, side)` and the existing shared deck stations. Its miter vectors preserve parallel joins; do not normalize them independently. Signedpositive is west, negative east along the south-to-north alignment. The36 m deck and the four source carriageways remain unchanged.

| Element | Absolute signedside range | Proposed vertical extent | Evidence |
| --- | --- | --- | --- |
| Road separator concrete curb |14.85..15.30m|deck to finishedpath+.40m|position/section estimated; form visible|
| Separator steel |within same45 cm footprint|three rails around path+.65,.95,1.25m|levels/sections estimated; three rails visible|
| Finished clear path |15.30..17.80m|deck+.12m in interior|2.50m clear width documented; rise estimated|
| Outer fence/handrail envelope |17.80..17.90m|finishedpath to finishedpath+3 m|height documented;10 cm depth estimated|
| Remaining exterior deck margin |17.90..18m|existing deck|existing aligned deck|

The entire handrail/post/picket assembly must remain outside the clear path inner plane at17.80m. A handrail projected into the2.5 m clear zone would silently invalidate that dimension. Likewise the curb/steel assembly must remain within its45 cm plan footprint. A larger real member requires moving its centre within these envelopes, not shrinking the path or widening a collider.

Recomputed actual geometry, not a nominal road-centre approximation:

- Source `public/data/vancouver-roads.json`, SHA256 `490e30c13ab588ce6ced5e514898006f5bff89b11d11a7513fe0ca744f2a0d2d`.
- Preserved carriageways `w23795563,w48608388,w1059700345,w1275279652`.
- All 9,373 current rendered strip vertices remain at least **3.1314515m** from the proposed road-facing separator boundary. Minimum at world `[6812.699707,-1599.570801]`, w48608388.
- All 11,160 sampled full lane-car footprint corners (4.9m×2.86 m, all three lanes,≤3 m longitudinal sampling) remain at least **3.7732392m** away. Minimum at `[6812.018006,-1601.974473]`, same way.
- Reproducible read-only script/output: `artifacts/local/ironworkers-path-clearance.mts/.json`. This proves lane clearance, not native impact behavior.

## Approaches need an explicit small finish tie

A sidewalk must connect to the existing cycle/walking routes. Merely leaving its end open is insufficient. Existing bridge cycleways are `w35260598` east and `w62125826` west; they sit farther inboard than the proposed path. Their old ribbons should not remain as a second elevated concrete sidewalk alongside the new one. A future integration needs an explicitly scoped render substitution for only these two bridge cycleway IDs, preserving their source data, direction/foot tags and all carriageway geometry. This is a required review item, not permission to rewrite surrounding paths.

| End/side | Proposed path centre world x,z | Closest external approach | Distance to its centreline |
| --- | --- | --- | --- |
|South/east|6826.184035,−945.555673|w41840546|.728801m|
|South/west|6793.100744,−946.607276|w336869485|3.544916 m|
|North/east|6791.128918,−2278.219559|w62125827|2.750459m|
|North/west|6759.132456,−2269.743924|w336868165|5.734668m|

These centres are at the existing6 m deck ties, t−.0045580863 and1.0045580863. The bridge path-to-path gap is therefore bounded, but a concrete tie polygon still must be traced to the actual approach edges and checked for crossings. Nearest distance alone does not establish that polygon. South/east also connects through w880719215 to w503135269. Keep all external source approaches intact.

Proposed path support rises0→.12m over each existing6 m tie and returns to0 at its end; the interior stays+.12m. Render and support must evaluate this same distance-based ramp plus the original `ironworkersGradeT(x,z)`. Clamp the finish to its exact rendered polygon and ramp it across any approved approach tie. Do not expand `bridgeAt`, water exemptions or driving support. Endpoint samples2m beyond the current path ends are dry in the source collision fixture; the underlying Stanley grid does not cover Ironworkers. Root's native endpoint walk remains required.

Start/stop longitudinal side members at the finite physical posts; no cap spans the path/road opening. Keep the full2.5 m opening between inside faces. End-post radius and actor radius reduce usable centreline clearance naturally. No bollards, gate, invisible transverse wall or automatic steering.

## Proposed integration contract — not implemented

Build one static object from `createIronworkersPathBoundary(deckHeight)` containing:

- `geometries`: merged concrete path/curb, galvanized structural members, instanced pickets, and optional distance-dependent fence representation. It replaces the existing Ironworkers sparse rails only; other bridge rails stay untouched.
- `supportAt(x,z): number | undefined`: exact path/tie finish, with barycentric evaluation of the same triangles as rendering. No source-road elevation change and no support beyond the visible finish. It must be consulted by the existing general height lookup before returning plain Ironworkers deck height.
- `blockedAt(x,z,r,feetOrCentreY,camera): boolean`: finite physical members only. It is installed **before the elevated-bridge early return** in `CollisionWorld.blockedAt`. Adding generic barriers after that return would do nothing over the span.

Build a coarse spatial index once (e.g.16 m cells) for the short nearby boundary segments. All geometry and collision use the same precomputed endpoints, vertical bounds and member envelopes. Avoid scanning the whole bridge or raycasting all triangles per frame. No geometry-loaded fallback barrier: installation is atomic with its visible geometry.

For a camera sphere, use actual sphere-to-member/rounded-segment distance, including vertical distance to tops/bottoms and the finite end caps. Do not combine a horizontal radius check with a separate vertical AABB overlap and call it exact: that blocks diagonal empty space. A camera wholly above the3 m top or below the actual members passes. A low camera that meets a physical rail/picket stops. The roadside rail gaps remain camera-open where a sphere truly fits; the whole1.25m roadside rail envelope must not become a solid camera wall. Actual curb and posts remain solid.

For actors, use the existing feet-based body interval and actual mover radius against the same members (player.36 m,bike.45m,car centre≤1.16 m plus its current full-footprint probes). Closely spaced picket gaps are narrower than these actor diameters, so an analytic continuous actor fence envelope is equivalent there; it is not equivalent for an arbitrarily small camera radius. Either test nearby individual pickets for cameras or prove the camera's actual radius exceeds the largest clear gap before using a continuous envelope. Support never grants passage through a separator, and vehicle exit tests inherit the same boundaries.

Existing movement subdivision≤max(.2m,r×.6) is compatible with narrow barriers but needs focused sweep tests. Check both across-fence motion and oblique end-post contact; a geometry-only collision test does not prove the movement integration.

## Cost and acceptance

A trial5 cm-wide picket at13 cm pitch would create roughly 20,460 pickets across both sides:about 245,520 box triangles. These dimensions are estimates, and naive merged boxes would substantially exceed the current bridge structure+deck cost of 48,492 triangles. Prefer one static instanced near picket batch with real depth, a limited-distance representation, and merged rails/curbs; establish a budget before enabling full-span near geometry. Do not invent random detailed posts to justify a draw call. The screenshot-visible count/spacing must first be calibrated to the TranBC reference.

Before integration approval: define member measurements and exact approach polygons; ray-check every finish triangle against support; check all source road strips/full car corners remain clear; test walk/bike/car sweeps, vehicle exits and approach access; sphere-test low/high/below-deck cameras against members and gaps; confirm other bridges unchanged. Root then drives both directions, walks each approach/path and reviews fence appearance and frame cost. Current lane-clearance results are ready; approach geometry and live collision parity remain planned work.
