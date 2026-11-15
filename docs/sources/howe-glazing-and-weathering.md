# Howe glazing and masonry revision

2026-11-15. Focal buildings: 325 Howe / P. Angela Webster Building and the Customs Examining Warehouse at 326 Howe. Uses the existing reference photographs and generic CC0 material scans; no additional image, asset purchase or texture allocation.

## Window clarity and depth

325 Howe has a single physical reflection/attenuation sheet over closed 0.878m cavities. Back, floor, ceiling and side returns give visible parallax. Upper paired sashes have varying open or partially lowered blinds; exact blind positions are a visual interpretation. No rooms are accessible. The first clear-glass candidate was too dark in native street views. The revised effective IOR2.3 preserves reflection/transmission energy consistency while increasing visible reflected contrast; it does not establish the real coating or refractive index. Other lobby-glass defaults remain unchanged.

Two fixed reflection cubes grow from128 to256px. The installed Three0.182 renderer automatically converts material environment cubes to PMREM. At the0.0525 native roughness floor, a128 cube already samples its sharpest level: lowering roughness further cannot recover missing spatial detail. From the saved prior public corner camera, the whole central first-row paired pane spans only about5.6×4.6 source texels at128, approximately doubled at256. These are geometric estimates, not GPU or screenshot pixel measurements. A512 cube would mostly sample its256-size mip at that roughness and costs substantially more.

Approximate added half-float raw-cube/mipmap plus PMREM colour storage for both upgrades is15MiB. This excludes depth, scratch textures, driver allocation and JS overhead; it is not a process-memory measurement. Capture sizes remain fixed at construction and weather reuses those targets. Generation validity, failure fallback, target restoration and material-identity receiver exclusions are preserved. No runtime resizing or second explicit PMREM conversion is introduced. The car's128px lobby borrowers remain unchanged.

A single capture still has no receiver-position correction. It cannot exactly align the opposite building across a32m facade or multiple floor heights. An arbitrary correction box was deferred because it would misrepresent the open sky, buildings at different distances and nonorthogonal mapped facades. A later positional refinement must validate actual opposite-wall edges from at least two walking viewpoints.

## Restrained masonry aging

World-position masks apply only to each building's two known street planes. Base exposure follows interpolated actual sidewalk samples. Narrow runoff lies below source-window edges, and cap exposure below the authored ledges. Darkening is bounded at14% for325 Howe and12% for the warehouse; roughness can rise by0.055. These are source-guided visual interpretations, not a scan of present-day dirt.

The mask does not alter normals, displacement, lighting/shadow calculations, UV scale, existing maps or geometry. Materials correctly remain outside the existing custom-shader static-batching gate. Each building's individual material geometry is still premerged by Batcher. No texture is added. Negative mapped coordinates are parenthesized in generated GLSL and covered by a regression test using the actual325 Howe ring; the initial invalid negative-Z expression was corrected before acceptance.

## Verification scope

Focused tests exercise the actual scalar shader arithmetic, architectural registration and bounded exposure; they do not claim GPU compilation. Geometry tests ray through the glass opening into the back and all four returns, check blinds behind the unchanged panes and retain the source-fitted footprint/height tests. Reflection tests verify fixed target sizes, reuse on invalidation and raw-target disposal. Blend tests verify bounded reflected/transmitted energy across angles for both the unchanged lobby default and the effective architectural fit.

Native gameplay, final CI and release outcomes are recorded with the checkpoint evidence. GTA6/AAA fidelity and sustained smoothness remain unachieved. No performance gain follows from these changes.
