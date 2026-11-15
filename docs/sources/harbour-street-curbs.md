# Bounded Harbour street curb interpretation

2026-11-14. Uses the committed [OSM road layer](vancouver-roads.md), including mapped carriageway widths, sidewalks and crossing ways. Checked against the existing Harbour towers screenshot and the road/collision implementation. This is a procedural street-depth pass, **not surveyed curb locations or a claim of reference-photo accuracy**.

Only complete Canada Place, West Cordova, Bute and Thurlow street ways wholly inside x −295…495, z −815…−490 are eligible. The generated cross-section is kept inside the larger x −310…510, z −830…−475 waterfront region. No changes to terrain, road routing, collision, interiors or other districts.

A 38cm gutter meets a 14cm vertical face and 18cm crown, with a 60cm apron toward separately mapped sidewalks. Where the source calls for a generated sidewalk, that apron extends to 2.5m. Normals face the road and sky, and every vertex samples existing road/terrain height. The crown tapers down over 1.8m at cuts and way ends; there are no vertical end caps floating across junctions. Interior OSM geometry nodes no longer receive arbitrary seven metre sidewalk gaps.

Cross-section samples reserve neighbouring carriageways, service roads and marked **and unmarked** mapped crossing ways, even without shared OSM nodes. A conservative clearance margin accounts for the one metre longitudinal sampling. Three material groups enter the existing spatial batcher, with no per-curb meshes, textures or runtime updates.

Limits: returns are conservative tapered terminations rather than surveyed corner radii. OSM way ends taper even at some collinear joins, so this does not yet supply seamless intersection topology. The apron blends toward existing paving height; different authored plaza elevations and actual mapped sidewalk offsets still require street-level review. Full street/profile collision height remains unchanged, consistent with the pre-existing cosmetic sidewalks. Elevation discontinuities in the authored base are not repaired by this pass.

Validation: street-curbs tests check bounded mapped scope and geometry count, finite sloped geometry and outward face normals, open cross streets/service entrances/unmarked crossings without shared nodes, and continuous densely sampled paths. Browser visual review belongs to the parent session.

## Harbour approach grade repair

A subsequent parent street-level check exposed a pre-existing roughly four metre cliff at the mapped park land-use boundary, immediately in front of the Cordova spawn (−143.43, −685.41). `seedHeight()` used incompatible inside/outside formulas. At x −150, the old terrain jumped from 1.62m at z −695 to 5.40m at z −700. Delaunay triangulation faithfully rendered that discontinuity as a steep jagged pavement bank; decorative curbs amplified it.

The landward apron now continuously extends the park grade toward the outer city datum, using distances to the park and outer boundary. The decorative lawn mound fades at the park edge instead of adding another discontinuity. Existing stair, fountain, upper-path and Jack Poole seam controls remain authoritative. Heights in that same sample now run 4.63→4.94m. Ground height at the former low spawn becomes approximately 4.17m.

New grade tests sample the affected 50×50m frontage every 0.5m: maximum local gradient is 8.4%, below the 10% regression limit, and road collision agrees with the terrain triangle surface. A 0.25m-sampled approach from the street point to the Bute upper landing remains below 12% grade and reaches its existing 6.14m datum. All original Harbour terrain/stair/seam tests still pass. These remain authored game elevations, not surveyed street grades. Visual acceptance is still the parent browser session's responsibility.
