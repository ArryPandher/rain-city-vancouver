import type { CollisionWorld } from "../world/collision";
import { isStreet, roadWidth, segmentPoint, type Road } from "../world/data";
import { galleryStairLocal } from "../world/gallery-stair-framing-data";
import {
  vehicleContactCapsules,
  type ContactPose,
  type PedestrianBody,
} from "./vehicle-pedestrian-contact";

/** Slots9–11 of the existing34 rigs, after the six Canada and three Howe walkers. */
export const ROBSON_PEDESTRIAN_SLOTS = 3;
export const ROBSON_PEDESTRIAN_RADIUS = 0.4;
const LANE_RADIUS = 0.48;
const SOURCE_ID = "w749560067";
type Point = { x: number; z: number };
type Ground = Pick<
  CollisionWorld,
  "gallery" | "data" | "walkingHeight" | "blocked" | "water"
>;
export type RobsonPedestrianCircuit = {
  road: Road;
  points: Point[];
  lengths: number[];
  length: number;
  carriageways: Road[];
};
export type RobsonVehicleObstacle = ContactPose & {
  kind: "car" | "bike";
  speed: number;
};

export function robsonPedestrianPoint(
  c: RobsonPedestrianCircuit,
  distance: number,
) {
  let d = ((distance % c.length) + c.length) % c.length;
  for (let i = 0; i < c.points.length; i++) {
    const length = c.lengths[i];
    if (d <= length || i === c.points.length - 1) {
      const a = c.points[i],
        b = c.points[(i + 1) % c.points.length],
        t = d / length;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    d -= length;
  }
  throw new Error("Empty Robson pedestrian circuit");
}

/** Ground-level public circuit only; no elevated terrace, stair or seat snap. */
export function robsonPedestrianHeight(ground: Ground, p: Point) {
  return ground.walkingHeight(p.x, p.z, 0);
}
function sourceDistance(road: Road, p: Point) {
  let nearest = Infinity;
  for (let i = 0; i < road.pts.length - 2; i += 2)
    nearest = Math.min(
      nearest,
      segmentPoint(
        p.x,
        p.z,
        ...(road.pts.slice(i, i + 4) as [number, number, number, number]),
      ).d,
    );
  return nearest;
}
function clear(ground: Ground, c: RobsonPedestrianCircuit, p: Point) {
  const y = robsonPedestrianHeight(ground, p);
  if (
    !ground.gallery ||
    !Number.isFinite(y) ||
    Math.abs(y) > 0.25 ||
    ground.blocked(p.x, p.z, ROBSON_PEDESTRIAN_RADIUS, y) ||
    ground.water(p.x, p.z, y) ||
    sourceDistance(c.road, p) + ROBSON_PEDESTRIAN_RADIUS > roadWidth(c.road) / 2
  )
    return false;
  // Whole body, not just its centre, must have continuous public ground support.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      q = {
        x: p.x + Math.cos(a) * ROBSON_PEDESTRIAN_RADIUS,
        z: p.z + Math.sin(a) * ROBSON_PEDESTRIAN_RADIUS,
      };
    const support = robsonPedestrianHeight(ground, q);
    if (
      !Number.isFinite(support) ||
      Math.abs(support - y) > 0.03 ||
      ground.water(q.x, q.z, y)
    )
      return false;
  }
  return !c.carriageways.some(
    (r) => sourceDistance(r, p) < roadWidth(r) / 2 + ROBSON_PEDESTRIAN_RADIUS,
  );
}

/** Clip one actual straight source segment at localv37/49. Fail closed if the
 * way is rerouted: do not silently bridge a new bend or invent a walking route. */
export function createRobsonPedestrianCircuit(
  ground: Ground,
): RobsonPedestrianCircuit | null {
  const road = ground.data.roads.find((r) => r.id === SOURCE_ID);
  if (
    !ground.gallery ||
    !road ||
    road.kind !== "footway" ||
    road.foot === false ||
    road.pts.length % 2 ||
    !road.pts.every(Number.isFinite) ||
    roadWidth(road) < 1.8
  )
    return null;
  let endpoints: Point[] | undefined;
  for (let i = 0; i < road.pts.length - 2; i += 2) {
    const a = { x: road.pts[i], z: road.pts[i + 1] },
      b = { x: road.pts[i + 2], z: road.pts[i + 3] },
      av = galleryStairLocal(a.x, a.z)[1],
      bv = galleryStairLocal(b.x, b.z)[1];
    if (
      Math.min(av, bv) > 37 ||
      Math.max(av, bv) < 49 ||
      Math.abs(bv - av) < 1e-6
    )
      continue;
    endpoints = [37, 49].map((v) => {
      const t = (v - av) / (bv - av);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    });
    if (endpoints.some((p) => Math.abs(galleryStairLocal(p.x, p.z)[0]) > 1))
      return null;
    break;
  }
  if (!endpoints) return null;
  const [a, b] = endpoints,
    length = Math.hypot(b.x - a.x, b.z - a.z),
    tx = (b.x - a.x) / length,
    tz = (b.z - a.z) / length,
    nx = -tz,
    nz = tx,
    points: Point[] = [];
  const side = (p: Point, s: number) => ({
    x: p.x + nx * s * LANE_RADIUS,
    z: p.z + nz * s * LANE_RADIUS,
  });
  points.push(side(a, 1), side(b, 1));
  for (let i = 1; i <= 16; i++) {
    const angle = (i * Math.PI) / 16;
    points.push({
      x: b.x + LANE_RADIUS * (nx * Math.cos(angle) + tx * Math.sin(angle)),
      z: b.z + LANE_RADIUS * (nz * Math.cos(angle) + tz * Math.sin(angle)),
    });
  }
  points.push(side(a, -1));
  for (let i = 1; i < 16; i++) {
    const angle = (i * Math.PI) / 16;
    points.push({
      x: a.x - LANE_RADIUS * (nx * Math.cos(angle) + tx * Math.sin(angle)),
      z: a.z - LANE_RADIUS * (nz * Math.cos(angle) + tz * Math.sin(angle)),
    });
  }
  const lengths = points.map((p, i) =>
    Math.hypot(
      p.x - points[(i + 1) % points.length].x,
      p.z - points[(i + 1) % points.length].z,
    ),
  );
  const xs = points.map((p) => p.x),
    zs = points.map((p) => p.z),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const carriageways = ground.data.roads.filter((r) => {
    if (!isStreet(r) && r.kind !== "service") return false;
    const pad = roadWidth(r) / 2 + ROBSON_PEDESTRIAN_RADIUS;
    for (let i = 0; i < r.pts.length - 2; i += 2)
      if (
        Math.max(r.pts[i], r.pts[i + 2]) + pad >= minX &&
        Math.min(r.pts[i], r.pts[i + 2]) - pad <= maxX &&
        Math.max(r.pts[i + 1], r.pts[i + 3]) + pad >= minZ &&
        Math.min(r.pts[i + 1], r.pts[i + 3]) - pad <= maxZ
      )
        return true;
    return false;
  });
  const c = {
    road,
    points,
    lengths,
    length: lengths.reduce((s, n) => s + n, 0),
    carriageways,
  };
  let previousY = robsonPedestrianHeight(
    ground,
    robsonPedestrianPoint(c, -0.1),
  );
  for (let d = 0; d < c.length; d += 0.1) {
    const p = robsonPedestrianPoint(c, d),
      y = robsonPedestrianHeight(ground, p);
    if (!clear(ground, c, p) || Math.abs(y - previousY) > 0.03) return null;
    previousY = y;
  }
  return c;
}
export function robsonPedestrianAssignment(
  c: RobsonPedestrianCircuit,
  slot: number,
) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= ROBSON_PEDESTRIAN_SLOTS)
    return undefined;
  return {
    distance: c.length * [0.08, 0.41, 0.74][slot],
    pace: [1.08, 1.16, 1.12][slot],
  };
}

export function advanceRobsonPedestrian(
  c: RobsonPedestrianCircuit,
  state: { distance: number; pace: number; panic: number; down: number },
  dt: number,
  ground: Ground,
  bodies: readonly PedestrianBody[],
  vehicles: readonly RobsonVehicleObstacle[],
) {
  const distance = Number.isFinite(state.distance) ? state.distance : 0,
    before = robsonPedestrianPoint(c, distance),
    wait = () => ({
      ...before,
      y: robsonPedestrianHeight(ground, before),
      distance,
      speed: 0,
    });
  if (
    ![dt, state.distance, state.pace, state.panic, state.down].every(
      Number.isFinite,
    ) ||
    dt <= 0 ||
    dt > 0.25 ||
    state.down > 0 ||
    state.pace <= 0 ||
    state.pace > 2
  )
    return wait();
  if (
    bodies.some(
      (b) =>
        ![b.x, b.y, b.z, b.radius, b.height].every(Number.isFinite) ||
        b.radius < 0 ||
        b.height <= 0,
    ) ||
    vehicles.some(
      (v) => ![v.x, v.y, v.z, v.heading, v.speed].every(Number.isFinite),
    )
  )
    return wait();
  const occupied = (p: Point, y: number) => {
    if (
      bodies.some(
        (b) =>
          y < b.y + b.height &&
          y + 1.8 > b.y &&
          Math.hypot(p.x - b.x, p.z - b.z) <
            ROBSON_PEDESTRIAN_RADIUS + b.radius + 0.12,
      )
    )
      return true;
    return vehicles.some(
      (v) =>
        y < v.y + 1.6 &&
        y + 1.8 > v.y &&
        vehicleContactCapsules(v.kind).some(([offset, radius]) => {
          const x = v.x + Math.sin(v.heading) * offset,
            z = v.z + Math.cos(v.heading) * offset;
          // Current physical body plus its next .65 seconds of travel, in either
          // direction. Yield before entering its swept path; do not alter driving.
          return (
            segmentPoint(
              p.x,
              p.z,
              x,
              z,
              x + Math.sin(v.heading) * v.speed * 0.65,
              z + Math.cos(v.heading) * v.speed * 0.65,
            ).d <
            radius + ROBSON_PEDESTRIAN_RADIUS + 0.2
          );
        }),
    );
  };
  const speed = state.panic > 0 ? 4.8 : state.pace,
    travel = speed * dt,
    steps = Math.max(1, Math.ceil(travel / 0.1));
  let previousY = robsonPedestrianHeight(ground, before);
  for (let i = 0; i <= steps; i++) {
    const p = robsonPedestrianPoint(c, distance + (travel * i) / steps),
      y = robsonPedestrianHeight(ground, p);
    if (
      !clear(ground, c, p) ||
      occupied(p, y) ||
      Math.abs(y - previousY) > 0.03
    )
      return wait();
    previousY = y;
  }
  const nextDistance = (distance + travel) % c.length,
    next = robsonPedestrianPoint(c, nextDistance);
  return {
    ...next,
    y: robsonPedestrianHeight(ground, next),
    distance: nextDistance,
    speed: Math.hypot(next.x - before.x, next.z - before.z) / dt,
  };
}

/** A car or pedestrian may already cover a desired spawn phase. Find
 * clear space on the same validated loop, never create an overlapping actor. */
export function findRobsonPedestrianSpawn(
  c: RobsonPedestrianCircuit,
  desired: number,
  ground: Ground,
  bodies: readonly PedestrianBody[],
  vehicles: readonly RobsonVehicleObstacle[],
) {
  for (let offset = 0; offset < c.length; offset += 2) {
    const distance = (desired + offset) % c.length;
    const next = advanceRobsonPedestrian(
      c,
      { distance, pace: 1, panic: 0, down: 0 },
      1 / 60,
      ground,
      bodies,
      vehicles,
    );
    if (next.speed > 0) return distance;
  }
  return undefined;
}
