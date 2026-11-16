# Ironworkers south scene: bridge and hillside registration

Source audit and uninstalled profile checkpoint, 2026-11-16 UTC. This corrects the previous assumption that the southern rail portal could be finished by adding a small mound to the existing flat scene. No highway, terrain, collision or road runtime hookup is installed by this checkpoint.

## Evidence and datum

BC Ministry of Transportation's [2018 Ironworkers risk assessment](https://www2.gov.bc.ca/assets/gov/driving-and-transportation/reports-and-reference/reports-and-studies/lower-mainland/2018-03-16-ironworkers-risk-assessment.pdf), physical PDF p31/Fig.2.3, supplies printed span dimensions and a plan/elevation. Physical p32 explains Chart Datum; p33/Table2.1 lists HHWLT 5.00m CD and mean water level 3.10m CD. Section3.3 separately gives the bridge's limiting height44.38m. The drawing's42.70m permitted vessel air draft is not the bridge deck height or exact physical clearance.

Cached original: `artifacts/local/second-narrows-rail/ironworkers-official-risk-2018.pdf`; upright research crops `official-plan-elevation-upright.png` and `official-elevation-zoom.png`. These source images are research references, not runtime textures. The new `ironworkers-registered-profile.ts` retains the printed span lengths and measured pixel controls.

The elevation crop's main piers are x905/1604:335.280m /699px=.47965665m/px. The independent red navigation rectangle is approximately89px high:42.689m at this scale, agreeing with its42.70m dimension. There is no evidence for a twofold vertical exaggeration. The drawn HHWLT line is y284. We provisionally align game water0 to mean water, so image heights become `(284-pixelY)*scale +1.90m`. This is an explicit adaptation, not a surveyed game/world datum. Allow roughly±2m height uncertainty from raster line selection, datum conversion and source interpretation.

| Control | Station from P18 | Deck pixel y | Inferred deck above mean water |
|---|---:|---:|---:|
| P18 south abutment |0|191|46.51m|
| P17 south anchor |32.614|185|49.39m|
| P16 south main pier |174.384|171|56.10m|
| Main midpoint |342.024|160|61.38m|
| P15 north main pier |509.664|171|56.10m|
| P14 north anchor |651.815|188|47.95m|
| P13 |738.658|197|43.63m|
| P12 |824.510|204|40.27m|
| P11 |910.362|214|35.48m|

Main-pier lower steel is approximately y267–270, above the concrete bearing/pier. Upper-deck to lower-steel depth is about46–49m, versus the current23m authored depth. Do not measure down to the concrete pier foundation. The trace helper uses y267; it is a control for the overall form, not a fabricated exact structural section.

**Short-span uncertainty remains material:** P18→P17 digitized pixels imply8.82% average and the helper's shape-preserving interpolation reaches9.57%. A2–3px line-selection difference changes this substantially. The uninstalled helper faithfully exposes that issue. Before driving integration, fit a smooth road profile within the±2m source envelope and independently inspect the short span; do not present9.57% as a verified real road grade. No north-tail extrapolation beyond P11 is supplied.

## Plan registration: the current truss is too far north

The retained OSM rail bridge ends provide an independent scale/rotation fit to Fig.2.3. South image[927,121] maps to world[6926.732257,−1081.147524]; north image[172,88] maps to[6945.143913,−1738.783146]. The independent two-point fit is recorded in `ironworkers-independent-plan-fit.json`.

It maps highway P18 to[6811.2167,−952.2187], essentially the current south abutment's longitudinal station. Printed span dimensions should then govern stationing on the existing curved carriageway midpoint. P16/P15 belong174.384/509.664m fromP18. The current centred truss puts those piers about316m farther north. Image registration has roughly5–10m uncertainty: rail-derived image scale predicts330.82m rather than the printed335.280m main span, a1.3% discrepancy.

There are three distinct station systems. The old straight grade axis starts at[6806,−952]. The actual retained curved road plan includes a six-metre south tie. The new helper uses **source station0=P18**, converting to plan distance by `ironworkersFrame(0).distance`; it never substitutes the old straight-axis length. Existing road x/z alignment, lane arrangement and source vertices remain unchanged.

## Southern rail portal and continuous hillside

Retained OSM open rail approach w210638531 runs16.69m from bridge endpoint[6926.732257,−1081.147524] to Thornton Tunnel mouth[6926.340211,−1064.467038]. Tunnel w40701731 has `tunnel=yes`, `layer=-1`, and an OSM `source=CN blueprints` tag. **That tag is provenance metadata; no CN blueprint was obtained or inspected.**

The [Daily Hive July2024 article](https://dailyhive.com/vancouver/thornton-tunnel-burnaby-fake-house-canadian-national-cn-railway) includes an aerial credited GoogleMaps and an exterior credited sophiecat/Shutterstock. Cached research images `thornton-north-dailyhive-google.jpg`, `thornton-north-dailyhive-sophiecat.jpg`, and `thornton-portal-research-crop.png` show a rounded concrete mouth set into the wooded Bates Park hillside, with service apron beside it. They do not justify a freestanding portal or a closed rectangular box. Parallel shore railway lines pass below the approach and must remain clear. The interior is outside scope.

Cached Terrarium terrain pixels are approximately50m, insufficient to resolve a single track, tunnel cut, retaining wall or trail. They do establish the broad continuous hill. At x6926.34, elevations rise from13.58m atz−1081 to18.34m atmouthz−1064.47,27.94m at−1040,43.57m at−1000 and58.04m at−960. Along the highway abutment at[6810,−952], the coarse value43.24m independently supports a high south endpoint, rather than the current0m.

The actual highway turns west inland: w23795653/w507979055 reach source DEM~46–57m around[6753..6812,−953..−820], then w106475084 falls toward34m at[6495.4,−497.8]. Following the straight x6810 ridge inland would incorrectly follow terrain near70m. Source DEM must inform a constrained roadway profile, not be sampled independently for every road vertex across crossfall.

## Smallest coherent implementation scope

The source core should include the highway south abutment, shoreline-facing Bates Park slope, rail mouth and mapped footpaths, then follow the curved highway approaches west. A preliminary core bounding inventory x6600..7100/z−1110..−790 intersects57 building bounding boxes and55 road bounding boxes. This is an audit envelope, **not an approved rectangular terrain mask**. It requires exact polygon intersections and pads before integration. A blind broader rectangle catches1280 buildings/617 roads and is rejected as an implementation strategy.

Prioritize these exact approach roads: w23795653,w507979055,w106475084,w154979982,w384320087,w406706701, with lane-level source plan preserved. The Bates Park source core must reconcile service w86484229; Trans Canada Trail w210638528/w210638530; lower paths w1033931584/w49742844; upper path w409159127; footway w75573893; cycleway w41840546; and residential edge w706831758/w30479690. The residential plateau cannot be truncated into an abrupt0m wall at Fellowes/Edinburgh.

Proposed next boundary is a **curved road-and-catchment mask**, exact shoreline at north, source hillside/park core east of the highway, and a bounded road approach/terrain transition westward. Select transition endpoints at real road junctions with continuous grades; flatten source buildings to shared local pads only where the actual mask intersects. An explicit outer adaptation toward the existing flat city will be necessary. Its length must be chosen from grade constraints, not a small decorative mound. That final mask and affected-ID list are still under audit.

Use one shared field for visible soil, source ground cuts, building pads, road cross-sections, trails, feet, cars and camera support. Highway deck/truss/light/fence helpers must consume one registered bridge profile. Preserve the rail main/lift13m datum, completed north fixed approach/context, shore railway clearances, exact ocean polygon, downtown scene masks, and elevated providers. Do not install the corrected highway profile before both approach/contact transitions are ready.

## Observable payoff and verification

From ordinary highway driving, the main truss would occupy its real navigational crossing, with deep bearing webs rather than a shallow structure shifted inland. The south endpoint would join a wooded hill and a credible tunnel approach rather than terminate above a flat field. The tunnel mouth itself is small at highway distance; hillside, roadway and truss coherence provide the meaningful scene improvement.

Three focused profile tests verify printed span lengths on curved arc length, independent mapped pier controls within10m, explicit water-datum/pixel conversion, deck/steel depths, continuous bounded interpolation and no extrapolation beyond measured coverage. This checkpoint is source/data work only and is not native visual acceptance.
