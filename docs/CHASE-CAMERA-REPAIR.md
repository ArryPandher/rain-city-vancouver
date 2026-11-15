# Daylight gameplay camera repair

The public 0c1bea8 Harbour Green diagnostic placed camera mode 0 directly above
the player. The obstruction branch copied the focus into its desired endpoint,
then interpolated that vector to itself. A bench also triggered the branch even
when the camera was above it, because the collision query omitted sample height.

The chase-boom helper retains its original endpoint while finding contact. It
samples at intervals no longer than 20 cm, refines first contact and leaves 5 cm
of extra clearance, without forcing a minimum distance through a nearby wall.
Main now passes each sample's height to the existing collision query. The player
movement query and authored bench collision are unchanged.

Four focused tests cover clear walking/aiming/car booms, wall shortening without
focus mutation, near/thin/endpoint obstacles, and the actual constructed Harbour
Green scene. The real bench's top is 2.7 m; the recorded first camera sample is
3.237 m high. It clears that bench, while the same position at 2.6 m and a taller
barrier still block. Typecheck and production build pass.

Native local review used the sole existing Codex tab at 127.0.0.1:4178. Walking
from the Harbour Green arrival down the stairs to (-80.173, 1.55, -795.494), then
turning toward the fountain, retained the visible character and the complete
4.3 m horizontal camera boom. The resulting camera was
(-77.933, 4.182, -799.165), yaw -0.548, pitch 0.19, mode 0. These are native
keyboard/mouse inputs, not a camera teleport. Evidence is saved locally as
`artifacts/local/chase-camera-bench-local.{jpg,json}`.

The local car accelerated and turned from the Howe Street arrival, braked, and
exited at (504.36, 0, -487.38). A native walk toward the pier wall, short retreat
and mouse turn left the player at (505.133, 0, -494.586), looking away from the
wall. The camera shortened from 4.3 m to about 2.31 m horizontally, at
(505.435, 1.958, -496.878), retaining a visible character and street view. Aiming
and firing inputs were exercised before holstering and pausing; no claim of a
hit is made for that interval. A later DOM read confirmed pistol ammunition
14 / 180 and no captured warning/error. See
`chase-camera-car-exit-local.jpg` and `chase-camera-wall-local.{jpg,json}`.

This fixes camera placement, not the remaining visual/performance gap. The new
view includes more of the scene than the collapsed camera: its roughly 19 fps
HUD is a spot observation, not a controlled comparison or performance gain.
Buildings and tree-trunk obstacles still use conservative 2D footprints; some
short fountain piers also have trunk-style bounds. Height-aware bench queries
do not resolve all possible camera occlusion. Native wall/vehicle and final
publication verification are recorded with the release checkpoint.
