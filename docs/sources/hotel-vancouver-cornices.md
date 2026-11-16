# Hotel Vancouver stone cornice hierarchy

The Gallery approach already contains the licensed Hotel Vancouver landmark, including its copper roof and dormers. This pass corrects its overly simple stone tier bands. It does not replace the building, raise its roof, move it, alter contact, recolor the facade or add another ashlar texture.

## Evidence and scope

- Exact mapped hotel: [OSM way 139571554](https://www.openstreetmap.org/way/139571554). Catalog origin is `[-123.12096,49.28384]`; the existing 112.47 m tip and all tier plans/heights remain unchanged.
- [Official Fairmont page](https://www.fairmont.com/en/hotels/vancouver/fairmont-hotel-vancouver.html) and its [exterior photograph](https://m.ahstatic.com/is/image/accorhotels/aja_p_7171-02?wid=1200&fmt=jpg&qlt=85) show strong layered stone ledges, projecting cornices and a hierarchy of upper and lower stone masses. The dusk image supports shape, not noon lighting or color calibration.
- The retained official Gallery daytime photo, `artifacts/local/robson-realism-reference/vag-official-robson-exterior.jpg`, corroborates the Hotel’s stone course shadows and its relationship to the Gallery. Both official photographs are research references only: no image, crop or derivative texture ships in the scene.
- Current native `cathedral-clear-street-native.png` shows part of the Hotel’s pale punched-window wall at the left edge; `gallery-wide-public-8e873c6.png` is another cropped framing. Neither provides a full, photo-matched Hotel roof comparison. This work does not claim a missing roof or a proven silhouette/height error.

The existing [Codriver source](https://github.com/codriver-io/codriver-3d-assets/blob/main/src/peregrine/landmarks/top-cities/fairmont-hotel-vancouver/geometry.js) builds one nominal .55 m square bar per tier edge. In the actual decoded asset, the bars’ rolled cross-section spans about .778 m vertically. The three major tier contours at 40, 60 and 80 m contain 26, 20 and 10 bars respectively. The 15, 45 and 50 m tiers, dormers, carved frontispieces, roof, original .24 m window recesses and every window triangle are preserved.

## Implementation

`hotel-vancouver-cornice-source.json` retains the mapped three-tier contour unions and the exact 672 original bar triangle offsets. The complete baked stone fingerprint is 37,069 vertices / 59,718 indices, position FNV fingerprint 2046381364 (millimetre rounding) and ordered-index fingerprint 1894454015. The source must match fully before any edit. These offsets are pinned source metadata, not a broad height-band deletion that might remove adjacent facade triangles.

`replaceHotelVancouverCornices()` builds the replacement first, then removes the 56 original closed bars atomically. All retained source attributes and ordered triangles stay unchanged. A source mismatch, wrong material, partial draw range or repeated call returns null without adding geometry. The loader calls this only for `fairmont-hotel-vancouver` and its stone material.

The new closed profiles have a lower fillet, projecting fascia, recessed intermediate strip and capped upper moulding. Maximum projection is .572 m at 40 m, .507 m at 60 m and .65 m at 80 m; their downward depth is approximately 1.19, 1.05 and 1.35 m respectively. These are authored, photo-constrained moulding proportions, not measured construction profiles. The back of each profile embeds slightly in the wall, avoiding exposed seams; the original bar surfaces are removed rather than overlaid. Mitred plan corners share vertices, and the complete profiles close on all sides.

New geometry uses metric one-metre UVs and the *same material object* as the retained Hotel stone. Existing licensed mineral maps, subtle ashlar joints, hue, roughness and daylight response are reused. No new texture, material, reflection probe or light is created. No additional window dressings were added: this pass stays with the single major cornice correction.

Cost: remove 672 triangles, add 1,568, net **+896 triangles**. Hotel total becomes **24,028 triangles / seven batches / six distinct materials**, compared with 23,132 / six / six. This is a geometry cost, not a performance improvement claim.

## Verification and native gate

Three focused tests decode the actual shipped GLB and execute the actual landmark loader (only file/network loading is stubbed). They verify the exact cut, full mismatch fallback, repeat-call safety, closed surfaces and outward winding, finite metric UVs, more than 1,000 original window-triangle rays without new obstruction, identical retained roof/glass geometry, exact material reuse and unchanged origin. A real Marine Building asset loaded beside it preserves its geometry and batch count, proving the Hotel ID gate does not alter another landmark. TypeScript checking passes.

Native review remains required. Use the ordinary Gallery arrival, turn toward the Hotel enough to include the main stone upper body and copper crown, and compare identical camera and S180 daylight. Repeat the existing Cathedral street framing to inspect the Hotel at the left edge. Pass requires stronger but restrained tier shadows, clean re-entrant corners and no duplicate bands, blocked windows, black painted occlusion or altered roof. The current cropped screenshots do not establish a measured before/after visual gain.

Source provenance: existing original model ©2026 Codriver, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); contour data ©OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Retained public research and decoded component audit are in `artifacts/local/hotel-vancouver-review/`. Runtime source metadata is committed; restricted official photographs remain local research only.
