# Gallery rear pediment and cornice relief

2026-11-16. Bounded original exterior interpretation, integrated by `addGalleryFacade`. It corrects the blank rear pediment seen in the ordinary third-person native image `artifacts/local/gallery-crown-final.jpg`. It does not establish overall scene realism parity with the GTA VI reference.

## Observed architecture and source diagnosis

The cached Jason Vanderhill **4 May 2006** photograph, `artifacts/local/robson-realism-reference/vanderhill-robson-gallery-2006.jpg`, shows a layered triangular stone border surrounding a recessed plain tympanum, with a projecting horizontal cornice and small repeated blocks beneath it. [Commons provenance/public-domain declaration](https://commons.wikimedia.org/wiki/File:Vancouver_Art_Gallery_Robson_Square_from_third_floor.jpg). The central pediment is approximately original pixels x495–930/y550–685; tree branches obscure some of its lower detail.

The gallery's [official exterior photograph](https://www.vanartgallery.bc.ca/wp-content/uploads/2025/07/VAG_exterior_2023_15-5-edited-1.jpg), cached as `vag-official-robson-exterior.jpg`, independently confirms the layered raking moulding, horizontal corona, dentil rhythm and solid stone returns. The image filename indicates 2023, rather than a verified exposure date. Original image region x260–560/y260–440 shows the profile clearly in oblique daylight. No open image licence was established: it is research reference only, never a runtime image/texture. Its elaborate capital carving and exhibition artwork are outside this pass.

The existing [Codriver source kit](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/vancouver-art-gallery/vancouver-art-gallery-kit.js) generates the rear triangular pediment with its two rim bars at `z - depth / 2 - .10`. That convention faces the Georgia portico, but the repaired Robson-facing rear is viewed from **positive v**. Thus those original bars are behind the rear triangle. The blank visible face is a source-side geometry issue, not something a stone tint would fix.

Independent actual-GLB audit, recorded in `artifacts/local/robson-next-source-audit.md` / `robson-next-source-probe.json`, identifies visible stone triangle17261, vertex IDs19237–19239:

- u/y/v approximately `[7.15052,14.05122,23.86071]`, `[-1.90027,16.74965,23.85903]`, `[-10.94929,14.05122,23.85915]`.
- Hidden raking bars occupy v22.5992–22.9205.
- Original horizontal cornice triangles17292–17303, IDs19300–19323, occupy u−10.84990..7.05092, y13.54983..14.05122, v22.84966..24.05063.

All source vertices and triangles remain. Existing source attribution stays Codriver CC BY4.0 and geographic placement ©OpenStreetMap contributors; no photograph or new surface map ships.

## New physical profile

`src/world/gallery-entry-cornice.ts` exports shared dimensions, the perpendicular-inset triangle calculation and `addGalleryEntryCornice`. `gallery-facade.ts` calls it inside the existing architectural stone batch before finishing. No loader, material, source asset, roof, stair, floor, collision or support provider changes.

The front moulding follows the existing u−10.95..7.15, spring14.05m, crest16.75m triangle. Its ring uses true perpendicular insets and shared apex vertices, giving mitred corners rather than crossed bars. Three stepped faces progress from the source plane to v24.30 and back into the tympanum; the greatest projection is **0.44m**. The normal border width is **0.36m**. The outer silhouette stays on the existing triangle; the source backing still closes the inner tympanum.

The 17.9m horizontal cornice follows the retained source box. Its closed y/v profile spans y13.48–14.05, with a forward lip at v24.34, a recessed frieze face at24.075 and complete end caps/soffit. Even its recessed visible face clears the source front24.05063 by24mm. Its back at23.83 penetrates the source cornice; the triangular profile back at23.84 penetrates the source pediment by about19mm, avoiding detached strips or coplanar overlays. It remains connected to the existing four column capitals and adjoining stonework.

Thirty-nine small physical dentils, estimated at450mm pitch and230mm width, project from the frieze. Their tops intersect the upper corona and backs intersect the frieze; the spaces between them expose the closed recessed stone face. Exact dentil count, section shape and projection depths are authored photographic estimates, not measured restoration dimensions. Plain coarse relief is used; no invented sculpture or fine carving.

## Verification and cost

Seven focused tests pass (`gallery-entry-cornice.test.ts` and `gallery-facade.test.ts`), and TypeScript passes. Checks cover both outward-facing rakes, recessed tympanum, measurable alternating dentil relief, exposed end caps, downward-facing soffit, finite unit normals, paired oppositely oriented edges on every added closed solid, unchanged crest and actual-GLB source preservation. Independent source-owner review found no attachment conflict and recommends no source cut.

The addition is **542 triangles**, reusing the existing stone draw. Complete facade assembly is now5,670 triangles in the same four material batches, versus5,128 previously. No new textures, material, probe, light, per-frame calculation or gameplay footprint. Every added vertex lies above y13.48; entrance banners stop at12.70.

Native rendered acceptance remains pending. Use the existing ordinary Robson approach; the source audit verifies a clear close viewing line at local U−7..4,V30 (world approximately−59.42,30.85 to−51.58,38.57). Compare the front-facing moulding and its underside at normal camera height, then move laterally to check mitred ends, connection to the retained cornice and whether relief reads as stone rather than a floating frame. Overall gallery massing, larger forecourt geometry and detailed sculpture remain separate limitations.

## 2026-11-16 portico proportion correction

The prior four-shaft reading and shallow horizontal entablature are superseded by the source-registered five-shaft/four-banner assembly in [gallery-portico.md](gallery-portico.md). Both rear photographs resolve the count. Original outer plinths and pediment remain; only the two obsolete upper shafts/heads are explicitly removed. The new shared capital bearing is12.05m under the retained14.05m spring. Historical validation above describes the earlier version; current source preservation, geometry budget and the necessary natural sidestep around real columns are documented in that correction.
