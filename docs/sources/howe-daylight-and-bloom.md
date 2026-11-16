# Howe daylight and highlight response

2026-11-15. A bounded ordinary-gameplay lighting revision, not an AAA or photographic-fidelity claim.

## One southeast sun

The former east sun gave 325 Howe's two perpendicular faces almost equal direct incidence. Actual geometry rays also found PwC blocking most of that street frontage. Daylight now uses azimuth135° and elevation28.288107°: the Howe face has direct incidence0.8806 while the Cordova return has0.0187. This creates a more legible lit face and shaded return. Those values describe surface orientation, not a promise that every surface is unoccluded.

The HDR sky and distant environment rotate together around vertical. Sun and water direction remain aligned. Source pixels, solar-disc elevation, light intensity3.4, hemisphere1.15, environment0.8 and exposure1.08 are unchanged. This is a fixed authored daylight composition, not a solar simulation of the HUD08:30 clock. [Source measurement, license and history](afternoon-daylight.json).

Local CPU ray checks use actual PwC/325 Howe geometry, not the whole rendered world: six upper Howe samples at17/23m clear those two buildings, while six lower2/10m samples remain blocked by the warehouse. Fairmont's three tested exterior planes retain positive incidence, but receive less direct illumination than with the former east sun. The west concourse remains backfacing. Native route review is therefore required alongside those calculations.

## Preserve the glint, reduce the veil

At the Howe corner, the sun reflects almost exactly toward the camera from Terminal City Club tower glazing (`w143683933`), not PwC. A geometry ray hit found a0.093° reflected-sun/camera angle. The actual Three.js material parameters predict roughly324 linear luminance from direct sunlight alone; this is a CPU BRDF estimate assuming an unshadowed smooth pane, not a GPU radiance readback.

The original bloom high-pass sends the entire HDR highlight through five blur levels. A fixed-camera native comparison of stock bloom, bloom off and filtered bloom showed that this spreads a white veil across adjacent architecture. The filter changes only the radiance sent into that existing bloom extraction shader. Original scene HDR, threshold gate, hue, alpha, radius, exposure and materials remain unchanged. The final daylight-only bloom strength is0.04, down from0.12; night/golden/rain retain their previous strength. No additional pass, render target, texture or material is allocated.

For source luminanceY above8, extracted luminance becomes `8 + 8 * (1 - exp(-(Y - 8) / 8))`, approaching16. Below8 it is unchanged, with continuous unit slope at the knee. RGB is scaled uniformly; the threshold still uses originalY. The filter is active only in daylight. Other weather retains its existing bloom response. This is an authored optical response, not a measured lens or physically complete light-transport model.

An initial ceiling32 reduced the narrow Howe glare but left excessive bloom across the Fairmont view. That candidate was superseded by ceiling16. The broader Fairmont review still showed a large halo at strength0.12, so daylight strength was reduced to0.04: the installed Three.js compatibility factor and five weighted blur levels otherwise amplify broad bright fields. This changes the optical glow, not the reflecting material or underlying light. The bloom constructor uses the same daylight strength as weather restoration, including a fresh visit without a saved weather preference. Debug-only checkboxes and a daylight-strength selector allow native comparisons without changing the player or camera. They are not player-facing graphics controls.

## Verification and remaining work

The three initial Howe comparison profiles have exactly identical player and camera data. Their screenshots are saved locally as `howe-daylight-bloom-{off,stock,filtered}.png`; these depict the historical ceiling32 comparison. The final Fairmont strength0.04/0.12/bloom-off comparison also has exactly identical camera/player profiles. Independent visual review accepts0.04: the reflected-sun patch remains, while sky, tree, mullions and canopy/column edges stay clearer. The final Howe corner retains the narrow glint without its former broad veil. Local screenshots/profiles use the `howe-daylight-fairmont-final*`, `howe-daylight-fairmont-strength12*` and `howe-daylight-final-*` names.

All604 local tests pass. TypeScript and the final production build pass (the subsequent daylight-strength/UI change is also built and will run through full release CI). Focused tests verify HDR hash/solar alignment, actual façade orientation, startup/follow/water agreement, shadow-volume agreement with Three's real frustum, and bloom continuity/hue/threshold/disabled/resource behavior. Historical fixed-geometry batching and Fairmont shadow fixtures explicitly retain their original sun, so changing authored daylight does not silently redefine their golden assertions.

Native third-person walking reached Fairmont and the west concourse; the final corner pistol test reduced ammunition15→14. Day/night/day restores sun/water direction and bloom0.04/filter-on versus night0.21/filter-off. Reflection errors and captured warning/error logs are empty. A separate window-colour difference after weather cycling is being investigated; this does not establish complete visual weather restoration. No performance improvement or full Fairmont driveway traverse is claimed.

A return drive also exposed an existing vehicle collision gap: a summoned car can interpenetrate the parked starter. That is a separate gameplay defect, not fixed by this rendering revision. The local diagnosis and reproduction are retained in `artifacts/local/howe-daylight-vehicle-contact-audit.md`.

325 Howe's street-level plinth/pier relief, repeated soft window reflections, simplified neighbouring facades, pavement construction/wear, sparse street activity, and character animation remain visible limitations. The current scene is substantially below the GTA6/AAA realism reference. The renderer still uses shadow maps and reflection probes, not hardware ray tracing.
