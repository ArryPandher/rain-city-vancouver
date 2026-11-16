/** The ordinary walking boom remains above the pavement when looking upward.
 * Its old two-metre target offset limited upward viewing to about eight degrees.
 * Blend into an angular look target without moving the collision-resolved camera.
 * Positive pitch retains the existing everyday framing exactly. */
export function walkingCameraLookHeight(
  legacyHeight: number,
  cameraHeight: number,
  horizontalDistance: number,
  pitch: number,
): number {
  if (
    pitch >= 0 ||
    !Number.isFinite(pitch) ||
    !Number.isFinite(cameraHeight) ||
    !Number.isFinite(horizontalDistance) ||
    horizontalDistance <= 0
  )
    return legacyHeight;
  // Neutral walking boom: 4.3m behind focus, target 3m ahead, camera .55m up.
  // Match its neutral direction; ease out of the old target near zero pitch.
  const neutralDownwardAngle = Math.atan2(0.55, 7.3);
  const elevation = Math.min(-pitch, 0.95) - neutralDownwardAngle;
  const angularHeight = cameraHeight + horizontalDistance * Math.tan(elevation);
  const t = Math.min(1, -pitch / 0.15);
  const blend = t * t * (3 - 2 * t);
  return legacyHeight + (angularHeight - legacyHeight) * blend;
}
