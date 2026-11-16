# Canada Place daylight and shadow coverage

2026-11-15. This is a bounded lighting improvement for ordinary gameplay, not an AAA or photographic-fidelity claim.

The prior day sun was southwest at49.89° elevation, behind the accepted northwest-facing hotel wall (azimuth331.74°). The facade's normalized direct-light dot was−0.1057. Its flat shading was therefore not evidence of broken normals. The water highlight and two photographic environments also used unrelated directions.

Day now uses one southeast sun at azimuth135° and elevation28.288107°, matching the measured solar-disc elevation in the CC0 Rustig Koppie Pure Sky2K HDR. This supersedes the initial westward and later eastward compositions; see [the Howe daylight review](howe-daylight-and-bloom.md). Sky and distant reflections use that same texture and vertical-axis rotation; the photographic horizon stays level. Direct light, initial/follow updates and water highlights share the direction. Local probes retain and restore the direction during capture and invalidate on weather changes. Intensity3.4, hemisphere1.15, environment0.8 and exposure1.08 remain unchanged. The North Shore photographic backdrop is unchanged. Other weather retains its previous direct-light offsets and environment rotations.

An initial28.512° misty-sky candidate was rejected in native review: it introduced credible tower shade but made the sky featureless and glazing milky. The accepted clearer sky preserves blue/white/green material separation. [Exact source, measured direction and hash](afternoon-daylight.json); reproduce with `node scripts/fetch-afternoon-sky.mjs`, or verify locally with `--verify`.

## Shadow correction

The previous210m cell-centre rule could omit a nearby caster. For example, the Fairmont tower's geometry lies roughly175–205m from the promenade entry while its270m batch-cell centre is334.8m away. Initial ray/envelope checks established that its taller sections can block the west sun at the entry. Geometry bounds, not a mapped pier envelope, determine eligibility.

A shared `ShadowCasterVolume` now classifies retained world/instance bounds against the existing finite directional shadow camera in gameplay and probe capture. Map4096², light-plane±80m, near1/far650, bias and visibility limits are unchanged. Material and ground shadow opt-outs remain authoritative. Static batching mirrors source flags and retains only bounds; released source vertex buffers are not restored. Frozen transforms and reusable query scratch avoid recursive parent updates and per-chunk allocations. Bounds are conservative, so GPU frustum culling remains relevant. Other distant-caster and detail-visibility limitations still exist.

## Historical local verification: initial westward checkpoint

- Twelve focused tests pass: actual HDR hash and solar-disc measurement, startup/follow/water agreement, weather transition/rotation restoration, source Fairmont bounds, irrelevant far geometry, ground opt-out, live/instance transforms, translated probe volume, and successful/failed capture state restoration. TypeScript and production build pass. Release CI runs the full suite separately.
- Native Codex browser, one reused tab: drive, brake, exit, connected pier walk, whole-frontage view, first-person oblique/lateral movement, pistol14/180 and holstering pass. The clearer entry view has a readable tower-shade boundary and distinct white sails/blue sky; close glazing retains dark blue-green response. Independent visual review accepts this bounded revision.
- Near comparison pose(472.094,7.88,−586.200), yaw0.5030/pitch−0.51495/FOV62:961 frame calls/3,525,275 submitted triangles, including274 shadow calls/1,257,114 triangles. Dynamic population and lighting differ from the prior checkpoint; this is not an isolated performance comparison.
- Quiet20.0165s stationary sample, diagnostic panel collapsed and no concurrent inspection:725frames,36.22fps average; median33.3ms, p9534.8ms, p9935.4ms, maximum64.7ms;2frames>50ms,0>100ms.723×670 CSS pixels, ratio1.35, Balanced/day. This does not establish sustained or1080p performance. Captured warning/error list empty;22 local captures and no reflection error.

Local evidence is retained under `artifacts/local/canada-daylight-*`, including before, rejected mist, accepted entry/whole/oblique, final profile and sample. Reference photos and rejected HDR candidates are not distributed with the game.

Pavement construction/material variation, facade surface detail, sparse public-space activity, character animation/materials and other landmark scenes remain substantial work. The renderer uses shadow maps and reflection probes, not hardware ray tracing. Next: increase convincing surface and public-space detail along this playable route before extending the strongest treatment to Robson Square/Art Gallery, Granville and Stanley seawall.
