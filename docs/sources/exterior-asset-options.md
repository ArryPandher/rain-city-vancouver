# Exterior asset options for browser Vancouver

2026-11-15. Read-only publisher-page research; no assets downloaded, installed,
purchased or rendered. These are reusable components, not measured Vancouver
buildings. Fit them to registered local references and closed exterior geometry;
do not replace Canada Place surroundings with an unrelated showcase city.

## Three viable openly licensed candidates

All three are covered by [Poly Haven's asset licence](https://polyhaven.com/license):
CC0 applies to models and textures, permits commercial modification and raw
redistribution, and does not require attribution. Retain provenance voluntarily.
Website/example renders are not the runtime assets. Publisher pages offer glTF
alongside Blender, FBX and USD; use glTF directly or export selected Blender
components to GLB with baked standard PBR. No format conversion is inherently
required for Three.js, but arbitrary Blender shader graphs do not transfer.

| Specific asset | Close-range use and verified cost evidence | Practical treatment / unknowns |
| --- | --- | --- |
| [Modular Urban Apartments Facade](https://polyhaven.com/a/modular_urban_apartments_facade), James Ray Cock | Doors, windows, trim and corner pieces; PBR diffuse/normal/ARM and separate objects/plaster/trim map families. Publisher default download display: 663.38 MB, **not** a browser payload estimate. | Already partly used here: `architectural-details.json` records two doors and one window extracted from the 1K glTF, unused data removed and maps converted to 1024 px WebP. Extend selected useful components before acquiring another whole kit. Residential module proportions must not be stamped over hotel/commercial elevations. Publisher page does not establish supplied LOD counts or triangles per piece. |
| [Modular Factory Facade](https://polyhaven.com/a/modular_factory_facade), James Ray Cock | Brick panels, windows, doors and loading-bay modules give physical jambs and service-front depth. Five named texture families: brick, doors, garage, trim and windows; window alpha plus normal/ARM maps. glTF available; 1K/2K/4K/8K listed. Default page display 900.83 MB. | Best new kit for selected service doors/loading bays on source-verified rear/service elevations, not an entire industrial replacement for a polished downtown block. Extract one bay and shared trim; begin with 1K/2K maps. No verified per-module triangle count or supplied LOD chain; do not ship the full source package. |
| [Modular Street Seating](https://polyhaven.com/a/modular_street_seating), Stuart Attenborrow | Straight/curved timber seating modules with physical slats, supports and armrests. Four PBR families: armrests, connectors, supports, timber. glTF available; 1K/2K/4K; default page display 176.91 MB. | Useful for verified plaza seating locations and close contact detail, not a substitute for facade work. Choose one source-compatible module, instance repeats, consolidate shared materials. Counts/LODs unverified; four texture families already imply more cost than a single-material bench. Do not place generic furniture over the source-specific Canada Place fixtures. |

The displayed source download sizes depend on the page selection and are not
GLB-transfer, resident-memory or GPU-cost measurements. Direct API metadata
requests returned HTTP 403 in this environment, so exact file-level bytes,
mesh counts and LOD inventories were not verified. No invented triangle budget
is presented as measured. Existing project source provides stronger evidence
for the first candidate: its selected GLB pipeline and shared textures already
work in Three.js. Scaling those pieces still needs attention to draw grouping
and per-cell bounds; our existing profile shows that instanced detail can remain
expensive when many off-camera members share a cell.

## Relevant but not cleared for this public asset repository

[Quaternius Downtown City MegaKit](https://quaternius.itch.io/downtown-city-megakit)
is unusually relevant: 300+ modular pieces, seven example buildings, shared
texture sets, and FBX/OBJ/glTF. The publisher itch page explicitly labels CC0;
Standard is listed at 223 MB, while the 918 MB Source version is $14.99 and adds
engine projects/custom window, wear and bevel shaders. Those shaders need a
Three.js implementation or a standard-PBR fallback; glTF alone does not carry
the engine appearance. However, the current [publisher licence page](https://quaternius.com/license.html)
is QAL v1.0, dated 2026-08-28, restricting asset redistribution. This conflicts
with the specific itch listing. Do not silently treat all new downloads as CC0:
obtain an unambiguous licence for the exact package/version before putting its
raw/derived models into a public repository. Existing CC0 grants are not thereby
assumed revoked, but no such exact-package grant was inspected here. No LOD or
per-piece triangle claims were verified.

[KitBash3D Storefronts](https://kitbash3d.com/products/storefronts) is the most
direct paid architectural match: 132 models, 44 PBR materials and a publisher
**3.5 million polygon** whole-kit count (not necessarily triangles), including
entryways, awnings and street-level frontages. Listed price was $145 before
licence-tier selection; this is not a checkout quote. Blender/FBX/USD are
supported, not a verified ready-made glTF deliverable. Selective export,
material translation, geometry reduction and LOD work remain necessary.
[Licence guidance](https://kitbash3d.com/pages/licenses) and
[restrictions](https://help.kitbash3d.com/en/articles/7053973-end-user-license-agreement-restrictions)
permit properly licensed larger works but prohibit standalone asset
redistribution. A public repo containing reusable raw/derived GLBs is not
cleared by those standard terms. A private source pipeline and suitably licensed
product distribution—or explicit additional permission—would be needed. It is
not an automatic public-repo upgrade or a reason to buy before a one-frontage
conversion plan. Modern Cities/Every City/City Streets are broader catalog
options, not independently verified purchases in this audit.

## How the suggested showcases fit

[PlayCanvas After the Flood](https://playcanvas.com/project/529572/overview/after-the-flood)
is a public project with a displayed 1.33 GB project size, not a cleared modular
facade kit. Public/editor-accessible does not establish permission to redistribute
all models/textures. Its [maintainer discussion](https://forum.playcanvas.com/t/cant-correctly-build-after-the-flood-project/25634)
notes older private shader/post-processing APIs. Use it as visual/technical
reference, not a drop-in Three.js asset source. Three.js Showcase and PlayCanvas
Explore are portfolios; audit each underlying asset's own licence.

[Fab Standard Licence](https://www.fab.com/eula) permits product use but not
standalone redistribution. Free pricing is not an open licence; a specific CC-BY
listing can be considered separately with its required attribution. No specific
Fab asset met a verified public-source suitability gate in this bounded review.
[Sketchbook](https://github.com/swift502/Sketchbook) advertises MIT code and is
an archived Three.js/cannon.js mechanics reference, not a realistic architectural
kit. Keep its MIT notice when reusing code and check separate asset notices;
mechanics reuse would not solve our facade-depth problem.

## Recommendation

The first actual-mesh study rejected the **already-sourced Urban Apartments
components** for PwC Place: its raised timber door panels, letter slots and
decorative sash window are residential. Scaling or retinting cannot make them
the commercial storefront in the owner's photo. The measured audit is in
[pwc-entrance-kit-study.md](pwc-entrance-kit-study.md). Keep these components for
compatible residential buildings. For PwC, author one complete closed recessed
commercial frontage with shared existing materials and source-fit proportions.
Next evaluate **one Factory Facade service bay** if that topology is present in
the target photographs. Seating is
a separate small prop improvement. For each, report actual selected triangles,
material groups, compressed maps, decoded buffers and native close/far views
before adoption; preserve existing geographic envelope and collision support.
Use 1K/2K selective PBR maps and metric UVs, not full 8K libraries. Distinctive
Vancouver glass/stone frontage still needs authored geometry and site references.
No evaluated catalogue alone demonstrates GTA-level quality or browser speed.
