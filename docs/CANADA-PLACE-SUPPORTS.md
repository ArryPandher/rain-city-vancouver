# Canada Place depth and reflection checkpoint

2026-11-15. Five joined primary supports now give the central west concourse a separate, deeper structural layer behind its curved framing. Ordinary daylight glass reflections retain more cloud detail. Non-AI concept cars use their existing source-derived low-detail geometry at long distance. This remains incremental progress, visibly below photographic or GTA VI/AAA quality.

## Architecture and material

The Rayner west section supports a floor-to-roof stem with a wider lower pedestal, collar and roof bearing inward of the highest glazing tier. One joined support was checked in gameplay before extending to five stations at approximately39.11,46.22,53.33,60.44 and67.55m. Their7.11m rhythm is a bounded reconstruction choice informed by SACO and official west views, not a surveyed column count. Dimensions and square section details remain estimates. The group adds1,040 triangles in one opaque batch and retains the existing route/collision/envelope.

An on-demand debug tool reads the already-captured128px cube faces. These contain distinct clouds, mast lines and facades. Reducing only the RGB reflection pass roughness from0.21 to0.12 produces narrower reflected cloud detail while preserving the visible columns. Probe position/resolution, intensity, IOR and transmission remain fixed. Native front, oblique and both along-building views showed no obvious open joins, new clipping or tier sorting gaps. Grazing sunlight is brighter locally; the surface still reveals structure. One shared probe and repeated curved tiers continue to produce repeated bands and imperfect parallax.

## Vehicle rendering and verification

Non-AI concept cars switch from185,379 to47,077 triangles beyond240m and restore near geometry within200m. The driven car remains near; existing AI traffic retains its prior fidelity. Canonical normalization, wheel centers, axle frames and tyre radii are shared with the concept model. The source-derived far level adds approximately2.80MB of shared CPU geometry and wheel packing, plus per-car objects; it is a GPU-work optimization, not a RAM-saving claim.

All330 tests passed, followed by final focused support/readback/glass checks and the production build. Source-GLB tests cover all five support volumes and floor/roof contact; actual-car tests cover geometry, transforms, wheel state, hysteresis and driven override. The debug readback handles unsupported/uninitialized targets and restores the current framebuffer on failure.

Only the existing Codex game tab was used. Native checks included the driven approach with steering/braking/exit, connected road-to-pier walking, front/oblique/both along-facade views, pistol selection/aim input/fire(14/180) and holstering. The combined candidate before the final glass-only adjustment also drove south past the sail supports and passed close broadside wheel inspection. A control-tool timeout prolonged one walk; input was released and the comparison position was recovered through native movement. That interrupted segment is not counted as a controlled route measurement. No captured final local warning/error messages.

The final fixed20-second sample at750×670, pixel ratio1.35, Balanced/day averaged39.67fps: median31.5ms,p9533.6ms,p9935.2ms,max50ms, no frames over50ms. This short sample does not establish a sustained frame-rate improvement, five-minute smoothness or1080p performance.

The final front profile reports779 beauty calls/1,542,848 triangles and80 shadow calls/491,763 triangles. Static-batch memory remains104batches/9,105records with328,620,606 historical released source bytes and zero retained source buffers. Actual car signatures confirm cheaper geometry at distance, but actor populations differ between captures; whole-frame changes are not a clean LOD A/B. A separate shadow increase in the earlier combined candidate was fully accounted for by five additional NPCs plus the five columns, with no car-shadow duplication. A dedicated visible200–240m threshold sweep remains unverified.

## Next work

Keep this chat as coordinator for architecture, material/art and performance specialists, using one Codex browser tab. Compare the complete Canada Place walking/driving view against real photographs: refine thin framing, exterior concrete/metal surfaces, repeated reflection bands and surrounding asset quality. Check a visible car-detail transition and longer frame pacing before claiming smoothness. Retain Robson Square/Art Gallery, Granville theatre blocks and Stanley seawall as the other priority regions. The browser-only GTA VI/AAA ordinary-gameplay goal remains active and unachieved.

## Evidence

- [Primary supports and source registration](sources/canada-place-primary-supports.md)
- [Glass and raw reflection inspection](sources/canada-place-concourse-glass.md)
- [Car distance LOD and actual geometry accounting](sources/car-distance-lod.md)
- Local artifacts: `canada-support-{before,preview-front,preview-oblique,five-front,five-oblique,sharp-front,final-oblique,final-along-north,final-along-south,near-wheels,probe-faces}.jpg`; `canada-support-final-{profile,frame-sample,local-browser}.json`; corresponding build and test logs.

References remain research-only. No new assets, excluded scan, purchases, external messages, photo mode or playable interiors were added. Existing source licences/attribution remain in force. Public release identity and live verification are recorded in the project note and active work-board card.
