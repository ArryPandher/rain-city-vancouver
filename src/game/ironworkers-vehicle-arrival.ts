import type { CollisionWorld } from "../world/collision";
import type { Road } from "../world/data";
import { pointOnRoad } from "./road-placement";
import {
  contactMotionClearance,
  type VehicleKind,
  type VehicleFootprint,
} from "./vehicle-contact";

export const IRONWORKERS_VEHICLE_ARRIVAL = {
  roadId: "w48608388",
  station: 40,
} as const;

/** Source-progress station on the northbound three-lane carriageway. Its
 * centre is the middle lane; the preceding two-lane approach centre is a divider. */
export function ironworkersVehicleArrival(
  id: string,
  kind: VehicleKind | undefined,
  roads: readonly Road[],
  collision: Pick<CollisionWorld, "height" | "blocked" | "water" | "move">,
  footprint?: VehicleFootprint,
) {
  if (id !== "ironworkers" || !kind) return;
  const road = roads.find((r) => r.id === IRONWORKERS_VEHICLE_ARRIVAL.roadId);
  if (
    !road ||
    !road.oneway ||
    road.lanes !== 3 ||
    road.sourceKind !== "motorway"
  )
    return;
  let remaining: number = IRONWORKERS_VEHICLE_ARRIVAL.station;
  for (let segment = 0; segment < road.pts.length - 2; segment += 2) {
    const length = Math.hypot(
      road.pts[segment + 2] - road.pts[segment],
      road.pts[segment + 3] - road.pts[segment + 1],
    );
    if (length < 1e-5) continue;
    if (remaining > length) {
      remaining -= length;
      continue;
    }
    const p = pointOnRoad(road, segment, remaining / length, 0);
    const y = collision.height(p.x, p.z);
    if (!Number.isFinite(y)) return;
    const pose = { x: p.x, z: p.z, heading: p.heading, y };
    // Same chassis/corner probes as ordinary driving; also reserve a short
    // departure along this source segment. No autopilot or steering constraint.
    const clear = contactMotionClearance(collision, [], kind, footprint);
    if (
      !clear(pose, pose) ||
      !clear(pose, {
        ...pose,
        x: pose.x + Math.sin(pose.heading) * 12,
        z: pose.z + Math.cos(pose.heading) * 12,
      })
    )
      return;
    return { ...pose, roadId: road.id, segment, t: remaining / length };
  }
}
