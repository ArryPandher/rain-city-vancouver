# Prospect Point retaining bank and coastal planting

The close photograph on [Destination Vancouver's lighthouse listing](https://www.destinationvancouver.com/things-to-do/listings/prospect-point-lighthouse) and angled [Wikimedia Commons views](https://commons.wikimedia.org/wiki/Category:Prospect_Point_Lighthouse) show dense green planting behind a low concrete retaining edge and herringbone paving around the tower. Those images are reference only and are not distributed.

## Original geometry and shared ground

Two original retaining edges follow interpreted points between the mapped lighthouse footprint and nearby seawall paths. They have a battered lower profile, thin coping, drain openings and construction joints. Their collision remains height-aware and does not occupy eligible walking/cycling centrelines. Existing CC0 **Painted Plaster Wall**, **Amal Kumar**, Poly Haven, supplies subdued concrete grain.

The forecourt is a small authored polygon between the mapped outer wall, lighthouse and interpreted bank. It has one continuous herringbone surface at 2.085 m, over a shared 2 m movement surface. The contour mesh is clipped underneath it. This avoids independently triangulated paving strips intersecting at different heights. Adjoining wall-to-path infill follows path height, rather than the ungraded terrain below it. The original contour data file is unchanged; the local grade override and polygon are explicit in `src/world/prospect-site.ts`. The plaza outline and grade are gameplay/visual interpretations, not surveyed construction data.

## Broadleaf clusters and leaf cover

**Shrub 04**, **Rico Cilliers**, [Poly Haven](https://polyhaven.com/a/shrub_04), CC0-1.0, supplies leaf photography, alpha and normal/material maps. The shipped coastal cluster is original Rain City geometry: 240 individually folded leaf surfaces and eighteen thin stems, 1,320 triangles total. It uses seven leaf regions from the existing source atlas. Original geometry/code is MIT; source photography/material maps remain CC0. The model is not a downloaded Vancouver bush or a surveyed species.

`node scripts/prepare-coastal-shrub.mjs` reproduces the GLB from the already-committed licensed Shrub 04 model. [Asset source record](coastal-plant-assets.json) distinguishes original geometry from third-party photography. Runtime placement samples terrain triangle surface area, tilts clusters toward the slope normal, and leaves broad rock windows. Each complete cluster, including its wind envelope, stays outside mapped road/path widths and blocking footprints. Small shader wind also moves the shadow silhouette. Instances use 24 m spatial cells and a 420 m distance bound. Performance mode hides the 3D clusters while retaining the leaf-cover surface; Balanced and High restore them.

`node scripts/prepare-coastal-cover.mjs` layers six licensed leaf crops into a periodic 1K color tile and estimates a shallow normal map from image gradients. These image derivatives are CC0; their preparation code is MIT. The continuous leaf-cover surface uses triplanar projection with an interpreted geographic mask, fading away from water, buildings, mapped routes and planting boundaries. [Exact texture records](../../public/textures/coastal/SOURCES.json). It complements the separately shaded 3D clusters and keeps distant banks from appearing as isolated stems against bare rock.

## Limits

The bank outline, plant distribution, vegetation species, drainage details and retaining profile are estimated. The 2002 contour base now has a shared one-metre interpreted detail patch, rock windows and closed forecourt cuts; see [local geology refinement](prospect-geology.md). It still does not reproduce overhangs. Repeated plants and tree forms remain visible, and broad seaward views are costly on laptop hardware. These are improvements to the playable prototype; they do not establish AAA fidelity or a current survey of Prospect Point.
