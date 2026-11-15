# Next conspicuous Howe facade: exact target audit — 2026-11-15

Research only. The 325 Howe exterior is not implemented in the Customs Warehouse release.

## Exact target and proof

The repeated brick/arched **PACIFIC COFFEE** building on the RIGHT of `warehouse-candidate-close.png` is **OSM w143683962, 325 Howe Street**. Current owner page calls it the **P. Angela Webster Building**; historically it is the Pacific Coast / Pacific Coast Fire Building, originally the National Finance Corporation building. It is not one of Sinclair Centre's warehouse/Post Office/Federal/Winch buildings.

Authoritative mapped address is in the already-cached full OSM `artifacts/local/canada-approach-buildings-reference/osm-map.xml`: way143683962 tags addr:housenumber325, addr:streetHoweStreet, building:levels8. Runtime footprint:

```
P0 [416.0485985561,-407.1300000001]
P1 [427.5485985561,-395.1300000001]
P2 [405.0485985561,-372.6300000001]
P3 [393.0485985561,-384.6300000001]
```

Centroid `[410.4235985561,-389.8800000001]`, geographical49.2865270490,-123.1143468734. Edge0 (P0→P1) is the narrow Cordova-facing end; edge1 (P1→P2) the longer Howe frontage. Edge0 length16.621m, edge1 length31.820m.

CPU-only camera reconstruction used the actual saved `warehouse-candidate-profile.json`: viewport1021×839, camera position `[454.8457071211,10.6575281633,-411.1280923504]`, FOV62°, yaw−0.786336898, pitch0.12, third-person mode0; player `[451.8022950241,8.3227656719,-408.0903888085]`. It recreates the code's lookAt target and projects source-derived nearby wall meshes. No renderer or browser was launched. Three independent right-side image rays first hit w143683962:

| Pixel   | First hit X,Y,Z            | Distance |
| ------- | -------------------------- | -------- |
| 850,170 | 423.1983,16.8327,−399.6695 | 34.2198m |
| 950,220 | 420.2045,14.7848,−402.7934 | 35.8680m |
| 750,220 | 426.0143,14.8080,−396.7310 | 32.4924m |

The ray through200,180 first hits the warehouse w1363485360 on the left, agreeing with the image. The diagnostic walls use a8.7m vertical offset rather than rebuilding every authored ground surface: these rays establish footprint identity and wall intersection, not exact final pixel shading or terrain. The selected hits are comfortably inside the target's actual visible-height band.

## Why it is wrong now

No startYear in the loaded target metadata, height25.6m and default heritage classification produce seeded photo index3 (`gastown-arches`,15×6m tile). Seed hash4062880061 first chooses style11, then photoindex3. The photo repeats about1.11× across the narrow end,2.12× across the long face and4.27× vertically. Generic shop generation adds unsupported Pacific Coffee branding and a panoramic storefront. Actual reference is pale masonry, strong light vertical piers, regularly paired rectangular windows and warm buff/orange spandrel panels. It is not an all-over red brick arch facade.

## Public photographic references actually viewed

1. **Owner source, P. Angela Webster Building /325HoweStreet:** https://new.equitablerealestate.ca/pacific-coast-building/ . Identifies Thomas Hooper, completed1912, ten original storeys, reinforced-concrete masonry/stone construction. Actual street-level Howe image inspected in memory: https://new.equitablerealestate.ca/wp-content/uploads/2011/03/PPCF-Howe-Street-pic-4.jpg (380×508). Shows pale piers, buff/orange spandrels, rectangular paired windows and pale street base through trees. Directory2011 is upload context, not independently established photo date. No open image licence established; reference only.
2. **Changing Vancouver2013 corner comparison:** https://changingvancouver.wordpress.com/2013/02/19/325-howe-street-2/ . Actual1000×629 comparison image inspected in memory: https://changingvancouver.wordpress.com/wp-content/uploads/2013/02/325-howe-2.jpg . Modern half clearly shows the narrow Cordova end with three broad paired-window bays, longer Howe return with approximately six bays, lost historical cornice, light piers, grey stone base and buff/orange panels. The photograph is dated2013-era evidence; exact current facade condition should be checked before fine signage/tenant details. Historic half is a different old-grade context; do not copy all ten exposed storeys into today's street scene. No open licence established for the comparison; reference only.

Additional grade corroboration: https://changingvancouver.wordpress.com/2011/12/26/325-howe-street/ . It reports that three original lower floors remain beneath today's elevated Cordova street. This affects lower-level exposure and approach edges; it does not justify deleting three storeys from the current above-road model without a roof/grade fit.

## Height/roof follow-up

Original ten-storey count includes lower floors beneath modern streets. The reference shows approximately seven visible levels from current grade; current OSM8 metadata is not visible-course proof. **Do not automatically shrink current25.6m total**: seven substantial office levels could have a similar total height. Reconcile real visible courses against source roof controls and the existing shared street before setting a height.

City2009 candidate group150434 near exactcenter has primary flat roof part166938 highest41.57m, lowest15.69m, groupbase16.56m, and a smaller pitched part165371 highest44.43m/lowest16.15m. Source group dimensions34.63×13.85m differ somewhat from simplified runtime footprint; verify geometric overlap before locking its roof partition. Query: https://opendata.vancouver.ca/api/records/1.0/search/?dataset=building-footprints-2009&q=bldgid%3A150434&rows=100 . TOPELEV_M means highest element elevation, not all facade/eave/ridge heights. Treat2009 generalized source and sharedCity−7.52 conversion as approximate; do not turn a small rooftop element's maximum into a giant solidroof.

## Bounded next work

Exact-ID replacement of325Howeon both visible faces: pale mineral piers/base, realistic buff spandrels, paired recessed rectangular windows, continuous corner and modest present-day roof/parapet. Preserve footprint/road collision and sampled street contact. Reconcile source facade course count/roof height; keep lower-bridge/retaining conditions explicit. Do not copy vanished cornice or unverified tenants. Compare against the same ordinary warehouse-close gameplay pose, plus an oblique Howe walking view. Existing source ownership, source age and material licences remain explicit.
