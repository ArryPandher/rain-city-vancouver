# Prospect Point basalt and local terrain detail

The **Stanley Park GeoTour**, MineralsEd and Geological Survey of Canada, Bob Turner, Marianne Quat and Chris Loewen (October 2011), page 11 / PDF page 10, shows the seaward cliff beside the lighthouse, an elevated view of the forested rim, and a close photograph of column-like fractures in the basalt. The photographed cliff has exposed rock faces, vegetation pockets and a planted lower bank. [Original guide](https://mineralsed.ca/site/assets/files/3451/stanleyparkgeotour2011web_me.pdf). These photos were visually reviewed as reference only; they are not included in the game or repository.

## Shared local surface

`src/world/prospect-geology.ts` adds a one-metre detail grid inside an explicit 256 × 184 metre rectangle around Prospect Point. It interpolates the existing City of Vancouver 2002 contour-derived grid, adding at most 1.45 m of original, interpreted rib/fracture relief on sloping faces. This is not a newer survey or a reconstruction of individual cracks. The source binary and broad contour elevations are unchanged. The relief fades out at the patch boundary, on low/flat ground, within four metres of mapped route edges, at the forecourt, water and blocking footprints. Final heights use the original centimetre quantization (up to 5 mm rounding).

The finer grid replaces the underlying coarse cells; it is not a second overlapping ground mesh. Original rock cut faces close the exposed edge where the level forecourt meets the hillside. Their top edge splits at grid and triangle-diagonal crossings so it matches the terrain exactly. Rendering, actor/collision height and vegetation placement use the same triangle diagonal and fine-grid surface. Chunk dimensions remain 160 metres. Boundary normals use the full shared surface. Tests check replacement area, upward faces, collision agreement, bounded relief, patch boundaries, unaffected outside points, and route grades.

The photographed rock already used by the game remains **Rock Face 03**, Poly Haven CC0; [existing source record](stanley-cliffs.md). No new texture downloads or reference-photo textures are introduced. Original geometry/material code is MIT.

## Rock and planting distribution

Both the leaf-cover mask and 3D shrub placement now use the same interpreted growth field. Low banks retain dense growth, while steeper high faces reveal broad rock windows and vegetation pockets. Slope is evaluated against the source contours so individual small relief facets do not produce alternating strips of plants. Shrub roots and normals follow the finer rendered surface. Complete plant envelopes still stay outside mapped route widths. Existing licensed leaf assets are unchanged; [sources](prospect-bank.md).

## Wooded rim

The smaller woodland extract omits part of the photographed rim inside the broad Stanley Park forest polygon. A small explicit rim polygon joins that gap to the existing forest habitat. Mapped plaza/opening polygons, route corridors, building/water checks, existing-tree spacing and the slope limit still apply. Added conifers use interpreted heights of 14–27 m and the existing licensed rendering assets. This is reference-guided planting, not a tree inventory.

## Limits

The terrain remains a height field: it does not reproduce basalt overhangs or surveyed fracture geometry. The upper rim still needs more accurate lookout architecture and species-specific canopy. Trees and shrubs repeat; material tiling and broad contour shapes remain visible. This is a local improvement to a playable independent prototype, below AAA fidelity.
