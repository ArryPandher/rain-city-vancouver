# Bounded gameplay review controls

The existing debug-only scene controls now include a Canada Place north approach
checkpoint at source-local [42, -75], the last point of the already tested west
promenade route. It uses the normal live support/obstruction/water checks and
ordinary third-person camera. It allows repeatable inspection of the new North
Point seating without adding a production fast-travel location or bypassing
collision. Subsequent movement remains normal walking.

The debug-only “Compact canopy shadows (experimental)” checkbox starts disabled
and has no persistence. It wraps final gameplay rendering with the source-plane
shadow representation described in `broadleaf-shadow-geometry.md`. A change ends
the current frame sample, resets the live shadow cache, changes the ordinary
shadow cache revision, and marks renderer/light shadow maps dirty. Reflection
captures keep their existing path. Diagnostics report both the toggle and the
scoped policy counters. TypeScript verification passed after integration.

Neither this toggle nor the existing experimental fence/terrain controls is a
claim that the corresponding rendering approach is ready for normal gameplay.
