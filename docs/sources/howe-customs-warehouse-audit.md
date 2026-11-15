# Howe next-building source audit — 2026-11-15

## Exact target

The repeated arched-photo corner ahead/right of the station is **Customs Examining Warehouse, 326 Howe Street**, part of Sinclair Centre: **OSM `w1363485360`**. It is distinct from the adjacent Federal Building, former Post Office and Winch Building.

- Runtime footprint, world X/Z metres: `(418.5486,-360.1300)`, `(441.0486,-382.6300)`, `(468.0486,-356.1300)`, `(445.5486,-334.1300)`.
- Centroid: `(443.2986,-358.2550)`; geographic centroid approximately **49.28624095, -123.11389406**.
- Visible Cordova face: second to third point, length **37.8319 m**. Howe return: first to second point, length **31.8198 m**.
- Cached full OSM source: `artifacts/local/canada-approach-buildings-reference/osm-map.xml`, way 1363485360. It explicitly records address, name, David Ewart and 1913. Its full outline has six distinct nodes; runtime uses the simplified four-corner outline above.

Identification was checked against `howe-ground-final-public.png` (1021×839) and its saved ordinary camera. Reconstructing only the camera projection, rays through screenshot pixels `(640,220)`, `(690,220)` and `(750,200)` first intersect this building's Cordova footprint edge, at world `(448.9436,-374.8812)`, `(445.3925,-378.3665)` and `(441.4905,-382.1963)` respectively. No browser/rendering was used for this check.

## Why the current facade is wrong

`src/world/architecture.ts` generic dispatch classifies this 1913 building as heritage. Its mapped nine levels currently give a **28.8 m authored body height**. The actual seeded material selection is photo index **4, `gastown-lofts`**, not `gastown-arches` (hash 1363616562; first random draw chooses style, second chooses photo).

`src/world/materials.ts` assigns this unrelated photograph a **16 m × 13 m** repeat. `walls()` in `src/world/geometry.ts` produces one flat quad per edge with repeating UVs. The Cordova wall repeats the photograph **2.364 times horizontally and 2.215 times vertically**, cutting and duplicating its baked architectural features. Bump from a roughness image cannot supply the missing openings, pilasters or cornice depth. Generic storefront generation in `architecture.ts` also adds shop glass/signage; the visible “PACIFIC COFFEE” is not a verified tenant.

The photo atlas source is Xicotencatl's unrelated Gastown view, cropped/perspective-corrected under CC BY-SA 4.0: <https://commons.wikimedia.org/wiki/File:Gastown-19.JPG>. Provenance is in `public/textures/vancouver/SOURCES.json`.

## Reliable building-specific references

1. **Street-corner photograph, Bobanny, 20 April 2007.** Inspected the actual image by small public HTTP request. Although the filename is misleading, its description and visible building identify the Customs Examining Warehouse. Commons records the author's public-domain release.
   - Page: <https://commons.wikimedia.org/wiki/File:OldPostOffice.jpg>
   - Image: <https://upload.wikimedia.org/wikipedia/commons/4/46/OldPostOffice.jpg> (2250×1688, about 275 KB; inspected in memory, not installed as an asset).
   - Shows a rough-faced granite base on the sloping site; three principal upper brick window bands, with rectangular openings below one segmental-arched top band; shallow broad brick pilasters; pale stone trim/arch keystones; and a heavy projecting cornice. Lower exposed stone openings vary with grade. The photo's awnings/tenant signs are dated evidence, not current tenant authority.
2. **Library and Archives Canada building history and historic photograph.** Confirms the rusticated stone base, rectangular windows, ornamental brick pilasters and heavy cornice. The photo is useful for original opening/corner hierarchy, not today's street grade or tenants.
   - Article: <https://thediscoverblog.com/2021/12/20/breaking-ground-150-years-of-federal-infrastructure-in-british-columbia-lower-mainland-region-customs-examining-warehouse/>
   - Inspected image: <https://thediscoverblog.com/wp-content/uploads/2021/12/a046650-v8.jpg?w=584>; archive identifier **a046650-v8**. Reuse license not established; use as a reference only.

Official identity/character corroboration:

- Parks Canada, 326 Howe Street, built 1911–1913: <https://www.pc.gc.ca/apps/dfhd/page_fhbro_eng.aspx?id=2339>
- Historic Places record: <https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=4153>
- FHBRO 83-26 character statement, 1997-11-13: <https://www.historicplaces.ca/media/9178/1983-026%28e%29customsexaminingwarehouse.pdf>. Describes granite ashlar, red clay brick, sandstone trim, shallow pilasters, top segmental arches, cornice and a base anchoring the sloping site; explicitly notes that facades differ.
- Owner history identifies Howe/Cordova: <https://www.sinclaircentre.com/?page_id=14>.

Rejected reference: the TourByTransit Sinclair Centre image captioned “Customs Examining Building” actually shows the pale-stone adjacent **Federal Building**. Do not model from that mislabel. The similarly named Commons `Customs_Examining_warehouse.jpg` is in Calgary, also unsuitable.

## Bounded next implementation

Add exact-ID architecture dispatch for **this one warehouse**, replacing its photo walls and generic coffee/storefront treatment. Retain the mapped collision footprint and established shared ground conversion. Author both visible Cordova and Howe faces as a connected volume: granite base with source-supported punched openings, recessed paired windows with closed backing, brick pilasters and stone bands, a single upper segmental-arch band, and a genuinely projecting cornice. Use material-scale brick/stone response and restrained glass instead of another whole-building photograph. Do not rebuild all Sinclair Centre or add gameplay interiors.

Before setting the vertical bands, resolve the current **28.8 m/nine-level** metadata against the photographed facade and any available City roof control. Parks Canada's summary calls the building four-storey while the character PDF refers to sixth-floor windows; the site exposes different amounts of basement. Thus neither four times a default storey height nor the current nine times 3.2 m is defensible as a surveyed total. Preserve horizontal floor/cornice relationships and fit the observed brick/base proportions explicitly, documenting the inferred total. The current shared terrain is not proof of a historical basement datum.

Acceptance should use the same ordinary station/car approach: distinct base and upper wall hierarchy, no repeated/cut arches, deep openings and cornice on both faces, coherent corner and ground contact, no invented tenant branding. This is a meaningful whole-view correction; remaining nearby placeholders and lighting/material limitations still prevent a photorealistic scene.

No implementation, builds/tests, browser activity, runtime imagery downloads or production writes were performed for this audit.
