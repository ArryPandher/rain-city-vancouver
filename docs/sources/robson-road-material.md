# Robson / Hornby asphalt aggregate

2026-11-16. Material-only candidate for the four existing asphalt approaches to the Robson/Hornby crossing. Native acceptance remains separate.

## Visible defect and source limits

The normal gameplay view `artifacts/local/robson-tree-shadow-lod-native.png` at approximately[−139.60,0.09,43.93] shows broad, dark diagonal fissures recurring across the road. `World.roads` assigns world X/Z divided by5 as asphalt UVs, while the original `asphalt_02` sampler repeats once. Thus the entire source photograph, including its conspicuous fissures, repeats every5 m. These are baked image features, not independently registered road damage.

The cached [Nick Milkovich Architects completed Robson Plaza photos](https://milkovicharchitects.com/robson-plaza) and [29 March2021 opening photos](https://dailyhive.com/vancouver/800-robson-square-plaza-open-design) establish the permanent pale mineral plaza and its distinct street crossing. Relevant files are `artifacts/local/robson-street-reference/architect0.jpg`, `architect4.jpg`, `opening13.jpg`, `opening14.jpg` and `opening15.jpg`, with original URLs in `image-sources.json`. They do **not** resolve the Hornby asphalt aggregate closely enough to derive a millimetre scale or a present-day crack map. The correction therefore removes an obvious synthetic repeating feature and uses a restrained asphalt material; it does not claim a photographic resurfacing date or a measured pavement reconstruction. No new repair seams, painted dirt or arbitrary weathering are invented.

The actual mapped source records distinguish the road from the pale plaza and protected cycleways. Selection requires the exact ID, `kind:secondary` and `surface:asphalt`:

| Road ID     | Source name   | Whole-way length |
| ----------- | ------------- | ---------------: |
| w543495974  | Hornby Street |         165.97 m |
| w476504051  | Hornby Street |         101.48 m |
| w1255620279 | Robson Street |          48.24 m |
| w74366445   | Robson Street |          53.60 m |

These four approved contiguous ways retain their full source extents. This is an identity-bounded finish change, not a claim that only the81×53m custom curb domain is recoloured. All other roads, sidewalks, cycleways, plaza paving, lane markings and crossing paint retain their materials and geometry.

## Existing licensed maps and physical scale

The factory reuses the existing `textures/cordova-pavement/{color,normal,roughness}.webp` triplet through `createCordovaPavementMaterial`. Its [Poly Haven asphalt_02](https://polyhaven.com/a/asphalt_02) source is **CC0-1.0**. The committed `public/textures/cordova-pavement/SOURCES.json` records source URLs, hashes, matched crop coordinates and existing processing. That crop excludes the original full-height cracks, removes broad source gradients before mirroring and preserves fine aggregate at unity gain. Its decoded linear albedo and roughness means match the original full source within1%; no new processing, asset or download is added here.

The existing **1.2 m** repeat is retained as an authored visual estimate; the original photographic manifest has no surveyed scale. World road UVs stay X/Z÷5. Each independent sampler repeats5/1.2 with the existing45° rotation, so a1.2m world displacement spans exactly one texture period in either road direction. All three maps have matching transforms. Color remains sRGB; normal and roughness remain linear data.

The material clones the original asphalt response: tint, normal strength and roughness/metalness values are unchanged. The local World weather hook copies the same asphalt roughness and metalness after existing day/rain/night changes. It does not repaint the road lighter to conceal cracks or alter global lighting.

Materials' existing URL cache shares three image Sources with the Cordova finish while returning independent sampler wrappers. The measured factory pair makes6 requests and3 source loads, not6 independent image Sources; disposal or repeat changes on a Robson wrapper leave Cordova's wrappers intact. This is source reuse, not a GPU-memory measurement. Runtime adds one local material and at most two road-material chunks, no triangles or shader passes.

## Verification and next native check

Focused tests execute actual `World.roads` with the real nearby road/building/tree source records and CollisionWorld; only image allocation is stubbed. Before the material hook was edited, all **341 emitted geometry records**, including paint and the final world UV rewrite, were captured as a sorted SHA256 signature. The candidate matches that signature exactly:

`06073369f97ab9b14fdcd7bd66fee62d9f75ccc5bb6c5c7e627a862520821144`

The check covers position, normal, UV and index buffers. Material assignment checks select exactly the four approved road IDs and reject every paint/curb/footway/cycleway record. Source road records remain unchanged. Separate tests verify the CC0 manifest,1.2m sampler scale, shared Sources, independent wrappers and unchanged asphalt response. The existing crossing regression checks actual rendered floor/contact parity and stable rebuilds. All four focused tests, scoped strict TypeScript and diff checks pass.

Root should compare the same normal Robson crossing view, looking across the foreground and along Hornby, then walk through the existing crosswalk. The intended visible change is fine aggregate without the repeated wide black fissures. Markings, bike lanes, curb transitions and character foot contact must remain identical. No browser, build, publish or FPS claim belongs to this material candidate.
