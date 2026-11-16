import { Vector3 } from "three";
import type { CollisionWorld } from "../world/collision";
import { chaseCharacterHidden, shortenChaseBoom } from "./chase-camera";

/** Existing gallery comparison pose, verified in ordinary third-person gameplay.
 * This is a public forecourt arrival, not the road/car landmark spawn. */
export const ROBSON_WALKING_ARRIVAL = Object.freeze({
  x: -68.78511329120707,
  z: 51.52276041041648,
  heading: 2.3554594283507932,
  pitch: -0.1583,
  fov: 62,
});

type ArrivalCollision = Pick<
  CollisionWorld,
  "walkingHeight" | "height" | "blocked" | "water" | "cameraBlocked"
>;

/** Fail back to the existing landmark road placement if source support changes.
 * No queries or overrides apply to vehicles or other destinations. */
export function robsonWalkingArrival(
  id: string,
  onFoot: boolean,
  collision: ArrivalCollision,
) {
  if (id !== "robson" || !onFoot) return;
  const pose = ROBSON_WALKING_ARRIVAL;
  const y = collision.walkingHeight(pose.x, pose.z);
  if (
    !Number.isFinite(y) ||
    collision.blocked(pose.x, pose.z, 0.36, y) ||
    collision.water(pose.x, pose.z, y)
  )
    return;
  // The complete foot capsule needs a supported landing, not a ledge centre.
  for (let i = 0; i < 8; i++) {
    const x = pose.x + Math.cos((i * Math.PI) / 4) * 0.36;
    const z = pose.z + Math.sin((i * Math.PI) / 4) * 0.36;
    const footY = collision.walkingHeight(x, z, y);
    if (
      !Number.isFinite(footY) ||
      Math.abs(footY - y) > 0.18 ||
      collision.water(x, z, footY)
    )
      return;
  }
  // Same ordinary 4.3m boom/25cm clearance as Game.setCamera. Require its full
  // length so arrival never depends on hiding the character against a wall.
  const feet = new Vector3(pose.x, y, pose.z);
  const focus = feet.clone().add(new Vector3(0, 1.52, 0));
  const camera = focus
    .clone()
    .add(
      new Vector3(
        -Math.sin(pose.heading) * 4.3,
        Math.max(0.25, Math.sin(pose.pitch) * 4.3) + 0.3,
        -Math.cos(pose.heading) * 4.3,
      ),
    );
  if (
    shortenChaseBoom(focus, camera, (p) =>
      collision.cameraBlocked(p.x, p.z, 0.25, p.y),
    ) !== 1
  )
    return;
  const floor = collision.height(camera.x, camera.z, y);
  if (!Number.isFinite(floor)) return;
  camera.y = Math.max(floor + 0.5, camera.y);
  if (
    collision.cameraBlocked(camera.x, camera.z, 0.25, camera.y) ||
    chaseCharacterHidden(camera, feet, 0.35, false)
  )
    return;
  return { ...pose, y };
}
