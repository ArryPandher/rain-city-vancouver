# 325 Howe: original gameplay exterior

2026-11-15. Exact-building replacement for `w143683962`, the P. Angela Webster Building, historically the Pacific Coast Fire Building, at Howe and Cordova. It replaces the unrelated repeated Gastown arch photograph and invented coffee frontage. [Identification](howe-325-howe-audit.md) and [photographic/City source fit](howe-325-howe-source-fit.md) preserve the evidence and uncertainty.

## Architecture and street contact

The modern photographic reference has **three Cordova bays and seven Howe bays**, with six upper rows plus the current street floor. The seven-bay count corrects the earlier approximate six. Cordova has pale stone spandrels; warm brick panels belong to Howe. Modeled details include continuous pale piers, grey base courses, paired rectangular sash windows, 0.34m upper/0.52m lower reveals, sash rails, projecting sills, closed entry doors, small handles and a modest present-day parapet. The lost heavy historical cornice is not restored.

Both public faces use the unchanged map footprint and horizontal building datum. The masonry base extends to local -1.3m to close against the shared sloping sidewalk. Two closed Howe entrance thresholds are sampled from the actual terrain plus 40mm, rather than sitting a metre above the street. This is exterior scenery, not a playable interior.

The main roof is flat, with one small inset plant enclosure following the source's 50.268m² rooftop part, plus restrained low service equipment. Native reference review raised the street base to 4.65m (belt 4.95m), tightened the six upper rows to 3.15m spacing and left a 1.39m top frieze. The inferred roof/parapet elevations are local 24.3m/24.792m at centroid datum 9.257773m. The historic 27.652m small-element maximum is an upper source control, not a building-wide solid roof. Source age, approximate map registration and the inferred `City - 7.52` vertical conversion are documented in the source-fit report. Floor proportions, current material condition and fine door details remain visual interpretations.

Geometry totals **10,742 triangles, 21,484 vertices and seven static material batches**. The runtime generator does not replace or enlarge building collision. Exact-ID dispatch precedes generic heritage/storefront generation and owns its below-grade masonry base.

## Materials

Six existing CC0 images supply metric brick and joint-free mineral color/normal/roughness maps. Rob Tuytel's Red Brick and Charlotte Baglioni's Granite Tile processing and provenance remain in `public/textures/landmarks/SOURCES.json`. These are generic material scans, not scans of the real building. Texture sampler clones prevent changing neighboring materials. Windows use an opaque, non-emissive physical-material proxy behind real recess geometry and one static 128px street reflection capture. The first diffuse-dominant glazing candidate read as dark paint despite a healthy capture. The revised neutral proxy uses a 0.70 metalness blend and 0.045 roughness to emphasize reflected surroundings; this parameter is an optical stand-in, not a claim that glass is metallic or a measured coating. This is an approximation, not ray tracing or exact window-by-window reflection transport.

Owner and Changing Vancouver photographs were inspected as architectural references only; neither is distributed as a runtime asset. The City 2022 aerial was used to distinguish the flat roof and small raised enclosure. No paid asset or external image-generation service was used.

## Verification

Eleven focused checks cover mapped footprint and bay hierarchy, every upper window recess and sash pair, reveal normals/UVs, lower openings and door clearances, closed roof/parapet, finite geometry and bounded projections, datum translation, actual sloping street contact, threshold-to-sidewalk heights, external reflection-probe placement and exact dispatch. TypeScript and the production build pass.

Native review in the sole Codex browser tab rejected the first short-base/diffuse-glass candidate. The revised build was checked from the approach, corner and closer Cordova view. Walking reached (439.35, 8.42, -404.72); pistol ammunition changed 15→14; summoned-car entry, driving to 44km/h and braking to exactly 0 passed. The diagnostic car stopped at (426.274, 8.313, -421.844), with 31 valid street reflection captures, null reflection/car error fields, empty captured warnings/errors and the static shadow cache off. This was a short Cordova drive, not a complete Fairmont driveway loop. Final local focused checks pass 11/11 and the production build passes; the earlier full suite passed 590 tests before the last proportional/material revision. Final CI and public verification are recorded in the release history.

[Ordinary corner gameplay](../screenshots/howe-325-corner.webp) and [closer shooting view](../screenshots/howe-325-close.webp) are actual native captures. They show a more accurate building, but the glazing remains soft and uniform, mineral walls lack convincing age, neighboring buildings and street activity still vary in quality. GTA6/AAA parity and sustained performance improvement remain substantially unachieved.
