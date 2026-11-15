# Gallery cross-wing clerestory and eave reconstruction

Original bounded exterior geometry, 2026-11-15. Source asset/coordinates remain Codriver CC-BY-4.0 and ©OpenStreetMap contributors. No runtime reference images, changed circulation or whole-building rescale.

## Evidence and fixed anchors

Jason Vanderhill's4May2006 Robson/Howe rear photograph, [Commons/public-domain provenance](https://commons.wikimedia.org/wiki/File:Vancouver_Art_Gallery_Robson_Square_from_third_floor.jpg), shows short glazed clerestories beneath green copper cross-wing roofs, substantial layered eaves and connected horizontal rear stone courses. Cached source used for inspection: `/tmp/gallery-rear-reference.jpg`; independently recached at `artifacts/local/robson-realism-reference/vanderhill-robson-gallery-2006.jpg`. This historical photograph establishes architecture, **not today's plaza/traffic layout or exhibition banners**.

[Codriver geometry](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/vancouver-art-gallery/geometry.js) builds source parts361964117/361964119 with13.15–14m stone plinths and plain14–18m gables. The source kit supplies two copper slope quads and two stone triangles per roof, with no clerestory. Their original bounds are retained: east X6.909..28.249,Z−11.6...528; west X−32.475..−11.21,Z−12.192...282. Source rotation.7769452205671321 radians remains baked once. Existing18m crests,26.5m dome, all lower walls, rear nine-bay facade and repaired entrance remain.

## Geometry and selection

`galleryRoofCompatible` checks original stone19388/52020 and copper3177/5952 primitive counts. `replaceGalleryRoofFaces` works on baked source geometry after existing entry/facade repairs, removing only triangles on the two original roof slopes or original gable end planes at14–18m. Exactly8copper+4stone triangles are removed; all source vertices stay unchanged. The13.15–14m supporting plinth is deliberately retained. A changed source must fail preflight before both cut and addition; the loader owns this atomic gate.

New clerestory stone base14–14.24m bears on that plinth; windows14.30–15.59m are recessed360mm ahead of a continuous dark backing at420mm. Six grouped bays per long side have dark narrow sash and physical jamb/head/sill returns. End walls and source plinth close the cavity. Layered eave courses occupy15.65–16.06m; copper slopes rise to the unchanged18m ridge. Their350mm overhangs have solid stone gable ends, and restrained copper seams follow the shallow slopes. Exact opening count, member sections, profile offsets and clerestory height are photographic estimates, not measured restoration dimensions. No interior or rooftop access is added.

The rear entablature adds three connected courses over the exposed east wing from sourceU7.15 to19.452 and the separate existing far-west rear segment(−32.449,23.818)→(−28.102,23.869). The east courses terminate at the protected original central entry cornice/pediment; no new band crosses or doubles it. Existing roof-terrace balustrades remain unmodified. This is a connected silhouette treatment within supported source edges, not a claim to replace the entire rear elevation.

Source stone/glass are reused. Cross-wing copper uses `materials.get('wing-copper') ?? materials.get('copper')`, letting the parent calibrate the photograph's lighter green wing roofs independently of the dark central dome. One new shared dark sash material; final surface UVs remain metric. No new probe, animation or per-pane materials.

## Validation and budget

5,100 added triangles in four batched materials;12 old triangles removed, net5,088. Actual quantized-GLB tests run the existing repair/cut sequence, verify exact removals, unchanged source positions and every protected translated entry triangle, and raycast new glazing ahead of the former roof, oblique closure, closed gable ends, eave undersides and attached rear cornice. Added positions/normals remain finite/unit length; maximum18m crest is preserved. Focused tests and TypeScript pass; parent owns production build/native whole-scene acceptance.

Required ordinary-view comparisons: existing Robson stair viewpoint(−145.65,1.68,128.41) looking toward gallery; closer rear approach(−55.78,34.43); lateral view across both raised wing ends. Reject apparent floating eaves, doubled roof slopes, lost clerestory depth, obstruction of the existing stair landing or changed central dome appearance. At this distance the courtyard landscape remains an independent large fidelity limitation.

## Material separation

The gallery-specific mineral palette now uses warm grey upper stone and trim,
with a slightly darker grey-green granite base. The existing metric CC0 mineral
maps and procedural courses remain shared. The values are visual interpretations
under the game's fixed daylight, not sampled albedo or a colour-calibrated survey.
Other landmarks retain their prior palettes.

`galleryWingCopperMaterial` clones the existing patina material/maps with a
muted green cross-wing tint, roughness0.82 and metallic fraction0.12. This makes
the shallow wing roofs distinct from the unchanged darker central cupola, as
seen in the documented photograph. It adds no image download, transparency,
lighting or shader variant. The patina texture remains the previously credited
CC0 weathered-metal approximation, not a copper scan.

## Native sky-bar attribution and repair correction

The close candidate `gallery-crown-after.jpg` showed two pale bars above the pediment. Reconstructing its saved actual camera (`gallery-crown-after-profile.json`) and raycasting the integrated quantized GLB identified original stone vertices12896–12898 and12872/12874/12875 at localY≈16,V≈23.07. They were **not new roof geometry**: the older entrance manifest had mistakenly included the core windows' six meeting rails and six sill-reveal quads in its broad component bounds, translating them11.33m away from the core with the real entrance.

The preparation script now excludes those twelve4-vertex stationary core-window components before generating the manifest. All48 vertices remain at their exact original source coordinates; no triangles/materials are removed or hidden. The corrected entrance translation selects882 vertices (244 foundation,90 stone,548 trim), retaining the complete correct pediment, shafts, cornice and stairs. Exact native pixel rays393/153 and445/154 now hit no gallery geometry; independent focused rays confirm the rails remain attached at the original core windows. Tests explicitly pin those48 unshifted vertices independently of the manifest and retain all prior staircase/entry tests. This corrects the historical930-vertex claim; source GLB and attribution remain unchanged.
