import { Vector3 } from "three";

/** A conservative capsule around the 1.84m protagonist, expanded by the
 * camera's near plane. Use the actual interpolated camera, not its desired
 * endpoint: otherwise the body can reappear while the boom is still inside it.
 * The 20cm release margin avoids flickering as a wall-shortened boom jitters.
 * This only controls body visibility; it never moves a camera through a wall. */
export function chaseCharacterHidden(
  camera: Vector3,
  feet: Vector3,
  near: number,
  previouslyHidden: boolean,
) {
  const bodyY = Math.max(feet.y + 0.25, Math.min(feet.y + 1.65, camera.y));
  const distance = Math.hypot(
    camera.x - feet.x,
    camera.y - bodyY,
    camera.z - feet.z,
  );
  return distance < 0.35 + near + (previouslyHidden ? 0.2 : 0);
}

/** Shorten a camera boom without overwriting the endpoint we interpolate from. */
export function shortenChaseBoom(
  focus: Vector3,
  desired: Vector3,
  blocked: (point: Vector3) => boolean,
) {
  const point = new Vector3();
  const length = focus.distanceTo(desired);
  // Sample more finely than the camera's 25 cm collision radius, including the
  // endpoint. A fixed fraction can skip a thin wall on the longer car boom.
  const steps = Math.max(1, Math.ceil(length / 0.2));
  let clear = 0;
  for (let step = 1; step <= steps; step++) {
    let hit = step / steps;
    point.lerpVectors(focus, desired, hit);
    if (!blocked(point)) {
      clear = hit;
      continue;
    }
    // Resolve the first contact, then leave 5 cm of additional clearance. Never
    // force a minimum boom length that places the camera through a nearby wall.
    for (let i = 0; i < 6; i++) {
      const middle = (clear + hit) / 2;
      point.lerpVectors(focus, desired, middle);
      if (blocked(point)) hit = middle;
      else clear = middle;
    }
    const fraction = Math.max(0, clear - 0.05 / Math.max(length, 0.001));
    desired.lerp(focus, 1 - fraction);
    return fraction;
  }
  return 1;
}
