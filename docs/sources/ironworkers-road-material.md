# Ironworkers carriageway aggregate candidate

The ordinary driving captures `artifacts/local/bridge-middle-lane-arrival.png` and `bridge-route-crest-native.png` expose the same broad, longitudinal crack motif repeated across the entire carriageway at the generic asphalt's 5 m UV scale. This candidate removes that unregistered pattern only on the source-registered Ironworkers asphalt.

## Reference and limits

The [TranBC east-sidewalk opening photograph, 4 February 2015](https://www.flickr.com/photos/tranbc/16444190361), retained at `artifacts/local/ironworkers-reference/tranbc-2015-opened.jpg`, shows fine, comparatively even asphalt in the traffic lanes at left, pale lane paint and a visibly separate concrete shared path. Fine aggregate is resolved nearest the lower-left corner. A transverse road seam is visible; the photograph does not establish that the bridge is crack-free. It gives no support for a large periodic longitudinal fracture pattern. The photo is wet/overcast, so its brightness is not a measured dry-surface albedo target. No photographic pixels are used as textures. This 2015 reference does not establish a 2026 resurfacing date or measured grain dimensions.

## Bounded implementation

`createIronworkersRoadMaterial` reuses the already shipped matched `cordova-pavement/{color,normal,roughness}.webp` triplet. Its [asset manifest](../../public/textures/cordova-pavement/SOURCES.json) records the CC0 Poly Haven [asphalt_02](https://polyhaven.com/a/asphalt_02) source, crop, crack exclusion and low-frequency normalization. There are no new assets, fabricated fractures, independent weathering stamps or painted lane markings.

The exact registered source ways are `w1059700345`, `w1275279652`, `w23795563`, and `w48608388`, from `ironworkers-alignment-data.json`. The predicate additionally requires source kind `primary` and surface `asphalt`. World uses the material only for their road-surface batches. It passes the same material to the optional final `buildLandmarks` argument, which selects it only for the `ironworkers` continuous asphalt deck. Including that deck prevents the old crack motif remaining on asphalt shoulders between source ribbons and the separately rendered concrete path. All other bridge decks, paths, curbs, paint and street surfaces keep their material.

Positions, indices, normals, UVs, collision, grade and shadow flags are unchanged. Road UVs remain world X/5,Z/5; deck UVs remain across/5,station-distance/5. The isotropic triplet uses matched repeat 5/1.2 and rotation pi/4. Thus the 1.2 m repeat is an explicitly authored fine-aggregate scale in both existing coordinate systems, not a photogrammetric measurement. The coordinate phase/orientation can differ at the road/deck boundary; the low-contrast crop is not a registered seam or crack map.

The material preserves the current asphalt colour and normal amplitude. Existing weather supplies roughness 1 in day/golden, .45 overcast and .65 night, with metalness zero. No lighting, exposure or reflection changes are included.

One material and three independent sampler wrappers are shared by the bridge roads and deck. Materials' per-URL cache reuses the three existing Sources already requested for Cordova/Robson. The subset test reports six requests / three source loads when Cordova then Ironworkers are constructed; this is source reuse, not a GPU allocation measurement. No capture or render pass is added. Disposing or adjusting these wrappers does not dispose/change the other surfaces' wrappers or shared Sources. Material disposal alone follows Three's usual semantics and does not automatically dispose its maps.

## Verification

- Five new focused tests cover the actual four source identities/protected surface exclusions, matched metric sampler transforms and licensed Source reuse, actual day/rain/night restoration, actual landmark output equivalence, and actual World road output equivalence.
- Pre-change local World.roads baseline: 765 source/paint geometries, SHA256 `6cd515b3182ddf775bb45ea61a78a4b8641955b9c5d232248b174da3773fa491`. Candidate matches every geometry attribute/index after final UV normalization. Three output road chunks carry the bridge material; no new geometry is created.
- Baseline/candidate buildLandmarks comparison preserves every emitted mesh's geometry, world transform and cast/receive-shadow flags; exactly one deck switches material, within the Ironworkers source extent. Other bridge asphalt remains unchanged.
- Existing three static-origin tests verify retained visible FrontSide deck/path support and world-space batching. Eight focused tests total pass.

Native acceptance remains with the parent: compare the same middle-lane and crest driving cameras in the same weather; confirm quiet fine asphalt, readable paint and unchanged concrete path/rail contrast. Test day/overcast restoration without a material brightness adjustment. No browser, build or publication is part of this candidate commit.
