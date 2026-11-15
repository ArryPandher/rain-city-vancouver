import type { CollisionWorld } from "../world/collision";
import { CANADA_PLACE_WALK_OFFSET } from "../world/canada-place-site";
import { isStreet, roadWidth, segmentPoint, type Road } from "../world/data";
import { pointOnRoad } from "./road-placement";
import {
  vehicleContactCapsules,
  type ContactPose,
  type PedestrianBody,
} from "./vehicle-pedestrian-contact";

/** Reassign three of the existing 34 rigs; the six promenade walkers stay put. */
export const HOWE_PEDESTRIAN_SLOTS = 3;
export const HOWE_PEDESTRIAN_RADIUS = 0.4;
type Point = { x: number; z: number };
type Ground = Pick<
  CollisionWorld,
  "canada" | "data" | "height" | "blocked" | "water"
>;
export type HowePedestrianCircuit = {
  road: Road;
  points: Point[];
  lengths: number[];
  length: number;
  carriageways: Road[];
};
export type HoweVehicleObstacle = ContactPose & {
  kind: "car" | "bike";
  speed: number;
};
// Metre stations on the actual imported ways. Stop before the service driveway,
// and resume beyond it; this is not an invented crossing or through-lobby route.
const ROUTES = [
  { id: "w232195213", from: 18, to: 49 },
  { id: "w1255990033", from: 23, to: 40 },
] as const;
const LANE_RADIUS = 0.55;

function roadAt(road: Road, distance: number, offset: number) {
  let segment = 0;
  for (; segment < road.pts.length - 4; segment += 2) {
    const length = Math.hypot(
      road.pts[segment + 2] - road.pts[segment],
      road.pts[segment + 3] - road.pts[segment + 1],
    );
    if (distance <= length) break;
    distance -= length;
  }
  const length = Math.hypot(
    road.pts[segment + 2] - road.pts[segment],
    road.pts[segment + 3] - road.pts[segment + 1],
  );
  return pointOnRoad(road, segment, distance / length, offset);
}

function build(
  road: Road,
  from: number,
  to: number,
  carriageways: Road[],
): HowePedestrianCircuit {
  const center = roadWidth(road) / 2 + 1.7;
  const samples = Math.ceil((to - from) / 0.5);
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++)
    points.push(
      roadAt(road, from + ((to - from) * i) / samples, center - LANE_RADIUS),
    );
  const cap = (station: number, direction: number) => {
    const p = roadAt(road, station, center),
      before = roadAt(road, station - 0.01, center),
      after = roadAt(road, station + 0.01, center),
      length = Math.hypot(after.x - before.x, after.z - before.z),
      tx = (after.x - before.x) / length,
      tz = (after.z - before.z) / length;
    for (let i = 1; i <= 16; i++) {
      const angle = (i * Math.PI) / 16;
      points.push({
        x:
          p.x +
          LANE_RADIUS *
            direction *
            (-tz * Math.cos(angle) + tx * Math.sin(angle)),
        z:
          p.z +
          LANE_RADIUS *
            direction *
            (tx * Math.cos(angle) + tz * Math.sin(angle)),
      });
    }
  };
  cap(to, 1);
  for (let i = samples - 1; i >= 0; i--)
    points.push(
      roadAt(road, from + ((to - from) * i) / samples, center + LANE_RADIUS),
    );
  cap(from, -1);
  points.pop();
  const lengths = points.map((p, i) =>
    Math.hypot(
      p.x - points[(i + 1) % points.length].x,
      p.z - points[(i + 1) % points.length].z,
    ),
  );
  return {
    road,
    points,
    lengths,
    length: lengths.reduce((sum, n) => sum + n, 0),
    carriageways,
  };
}

export function howePedestrianPoint(
  c: HowePedestrianCircuit,
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
  throw new Error("Empty Howe pedestrian circuit");
}

/** Matches the +.15 shoulder finish emitted by canadaPlaceApproachGeometry.
 * Require that support, so this offset never leaks onto a road, deck or terrain. */
export function howePedestrianHeight(ground: Ground, p: Point) {
  return ground.height(p.x, p.z) + CANADA_PLACE_WALK_OFFSET;
}

function clear(ground: Ground, c: HowePedestrianCircuit, p: Point) {
  const site = ground.canada;
  if (!site) return false;
  const y = howePedestrianHeight(ground, p);
  if (
    !Number.isFinite(y) ||
    Math.abs(y - site.supportHeight(p.x, p.z) - CANADA_PLACE_WALK_OFFSET) >
      0.02 ||
    ground.blocked(p.x, p.z, HOWE_PEDESTRIAN_RADIUS, y) ||
    ground.water(p.x, p.z, y)
  )
    return false;
  // Entire body stays inside the raised support and outside every carriageway,
  // including service ways omitted by CollisionWorld.onStreet().
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    if (
      !site.contains(
        p.x + Math.cos(angle) * HOWE_PEDESTRIAN_RADIUS,
        p.z + Math.sin(angle) * HOWE_PEDESTRIAN_RADIUS,
      )
    )
      return false;
  }
  return !c.carriageways.some((road) =>
    road.pts.some(
      (_, i) =>
        i % 2 === 0 &&
        i < road.pts.length - 2 &&
        segmentPoint(
          p.x,
          p.z,
          road.pts[i],
          road.pts[i + 1],
          road.pts[i + 2],
          road.pts[i + 3],
        ).d <
          roadWidth(road) / 2 + HOWE_PEDESTRIAN_RADIUS,
    ),
  );
}

export function createHowePedestrianCircuits(ground: Ground) {
  if (!ground.canada) return null;
  const carriageways = ground.data.roads.filter(
    (road) =>
      (isStreet(road) || road.kind === "service") &&
      ground.canada!.intersects(road.pts),
  );
  const circuits: HowePedestrianCircuit[] = [];
  for (const route of ROUTES) {
    const road = ground.data.roads.find((r) => r.id === route.id);
    if (!road || road.foot === false) return null;
    const c = build(road, route.from, route.to, carriageways);
    let previous: (Point & { y: number }) | undefined;
    for (let d = 0; d < c.length; d += 0.1) {
      const p = howePedestrianPoint(c, d),
        y = howePedestrianHeight(ground, p);
      if (!clear(ground, c, p) || (previous && Math.abs(y - previous.y) > 0.03))
        return null;
      previous = { ...p, y };
    }
    circuits.push(c);
  }
  return circuits;
}

export function howePedestrianAssignment(
  circuits: HowePedestrianCircuit[],
  slot: number,
) {
  const route = slot < 2 ? 0 : 1,
    circuit = circuits[route];
  return {
    route,
    distance: circuit.length * [0.12, 0.62, 0.3][slot],
    pace: [1.08, 1.2, 1.14][slot],
  };
}

export function advanceHowePedestrian(
  c: HowePedestrianCircuit,
  state: { distance: number; pace: number; panic: number; down: number },
  dt: number,
  ground: Ground,
  bodies: readonly PedestrianBody[],
  vehicles: readonly HoweVehicleObstacle[],
) {
  const distance = Number.isFinite(state.distance) ? state.distance : 0,
    before = howePedestrianPoint(c, distance),
    wait = () => ({
      ...before,
      y: howePedestrianHeight(ground, before),
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
            HOWE_PEDESTRIAN_RADIUS + b.radius + 0.12,
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
            radius + HOWE_PEDESTRIAN_RADIUS + 0.2
          );
        }),
    );
  };
  const speed = state.panic > 0 ? 4.8 : state.pace,
    travel = speed * dt,
    steps = Math.max(1, Math.ceil(travel / 0.1));
  let previousY = howePedestrianHeight(ground, before);
  for (let i = 0; i <= steps; i++) {
    const p = howePedestrianPoint(c, distance + (travel * i) / steps),
      y = howePedestrianHeight(ground, p);
    if (
      !clear(ground, c, p) ||
      occupied(p, y) ||
      Math.abs(y - previousY) > 0.03
    )
      return wait();
    previousY = y;
  }
  const nextDistance = (distance + travel) % c.length,
    next = howePedestrianPoint(c, nextDistance);
  return {
    ...next,
    y: howePedestrianHeight(ground, next),
    distance: nextDistance,
    speed: Math.hypot(next.x - before.x, next.z - before.z) / dt,
  };
}

/** A car already stopped on the shoulder may cover a desired spawn phase. Find
 * clear space on the same validated loop, never create an overlapping actor. */
export function findHowePedestrianSpawn(
  c: HowePedestrianCircuit,
  desired: number,
  ground: Ground,
  bodies: readonly PedestrianBody[],
  vehicles: readonly HoweVehicleObstacle[],
) {
  for (let offset = 0; offset < c.length; offset += 2) {
    const distance = (desired + offset) % c.length;
    const next = advanceHowePedestrian(
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
