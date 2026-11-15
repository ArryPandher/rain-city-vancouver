import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_DECK_Y,
} from "../world/canada-place-deck";
import type { CollisionWorld } from "../world/collision";
export const CANADA_PEDESTRIAN_SLOTS = 6;
export const PEDESTRIAN_POOL_LIMIT = 34;
type Point = { x: number; z: number };
export type CanadaPedestrianCircuit = {
  points: Point[];
  lengths: number[];
  length: number;
};
type Ground = Pick<CollisionWorld, "height" | "blocked" | "water">;
function build(): CanadaPedestrianCircuit {
  const path = CANADA_PLACE_DECK_ROUTE.slice(3, 6).map(([x, z]) => ({ x, z }));
  const tangent = (i: number) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(2, i + 1)],
      l = Math.hypot(b.x - a.x, b.z - a.z);
    return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  };
  const normals = path.map((_, i) => {
    const t = tangent(i);
    return { x: -t.z, z: t.x };
  });
  const offset = (i: number, side: number) => ({
    x: path[i].x + normals[i].x * 0.7 * side,
    z: path[i].z + normals[i].z * 0.7 * side,
  });
  const points = path.map((_, i) => offset(i, 1));
  const cap = (i: number, side: number) => {
    const t = tangent(i),
      n = normals[i];
    for (let j = 1; j <= 16; j++) {
      const a = (j * Math.PI) / 16;
      points.push({
        x: path[i].x + 0.7 * side * (n.x * Math.cos(a) + t.x * Math.sin(a)),
        z: path[i].z + 0.7 * side * (n.z * Math.cos(a) + t.z * Math.sin(a)),
      });
    }
  };
  cap(2, 1);
  points.push(offset(1, -1), offset(0, -1));
  cap(0, -1);
  points.pop();
  const lengths = points.map((p, i) =>
    Math.hypot(
      p.x - points[(i + 1) % points.length].x,
      p.z - points[(i + 1) % points.length].z,
    ),
  );
  return { points, lengths, length: lengths.reduce((a, b) => a + b, 0) };
}
export function canadaPedestrianPoint(
  c: CanadaPedestrianCircuit,
  distance: number,
) {
  let d = ((distance % c.length) + c.length) % c.length;
  for (let i = 0; i < c.points.length; i++) {
    const l = c.lengths[i];
    if (d <= l || i === c.points.length - 1) {
      const a = c.points[i],
        b = c.points[(i + 1) % c.points.length],
        t = d / l;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    d -= l;
  }
  throw new Error("Empty pedestrian circuit");
}
function clear(ground: Ground, p: Point) {
  return (
    Math.abs(
      ground.height(p.x, p.z, CANADA_PLACE_DECK_Y) - CANADA_PLACE_DECK_Y,
    ) < 0.02 &&
    !ground.blocked(p.x, p.z, 0.4, CANADA_PLACE_DECK_Y) &&
    !ground.water(p.x, p.z, CANADA_PLACE_DECK_Y)
  );
}
/** Whole fixed circuit must be supported by loaded public deck. No water or
 * building exemptions; unavailable/failed landmark geometry retains normal NPCs. */
export function createCanadaPedestrianCircuit(ground: Ground) {
  const c = build();
  for (let d = 0; d < c.length; d += 0.1)
    if (!clear(ground, canadaPedestrianPoint(c, d))) return null;
  return c;
}
export type PedestrianObstacle = Point & { radius: number; y?: number };
export function advanceCanadaPedestrian(
  c: CanadaPedestrianCircuit,
  state: { distance: number; panic: number; down: number },
  dt: number,
  ground: Ground,
  obstacles: PedestrianObstacle[],
) {
  const safeDistance = Number.isFinite(state.distance) ? state.distance : 0;
  const before = canadaPedestrianPoint(c, safeDistance),
    speed = state.panic > 0 ? 4.8 : 1.2;
  const wait = () => ({ ...before, distance: safeDistance, speed: 0 });
  if (
    ![dt, state.distance, state.panic, state.down].every(Number.isFinite) ||
    state.down > 0 ||
    dt <= 0 ||
    dt > 0.25
  )
    return wait();
  if (
    obstacles.some(
      (o) =>
        ![o.x, o.z, o.radius, o.y ?? 7.88].every(Number.isFinite) ||
        o.radius < 0,
    )
  )
    return wait();
  const nearby = obstacles.filter((o) => Math.abs((o.y ?? 7.88) - 7.88) < 2.5);
  const occupied = (p: Point) =>
    nearby.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.radius + 0.4);
  const travel = speed * dt;
  const steps = Math.max(1, Math.ceil(travel / 0.1));
  for (let i = 0; i <= steps; i++) {
    const p = canadaPedestrianPoint(c, state.distance + (travel * i) / steps);
    if (!clear(ground, p) || occupied(p)) return wait();
  }
  const distance = (state.distance + travel) % c.length,
    next = canadaPedestrianPoint(c, distance);
  // Check endpoint too when travel is not divisible by the sweep step.
  if (!clear(ground, next) || occupied(next))
    return { ...before, distance: state.distance, speed: 0 };
  return {
    ...next,
    distance,
    speed: Math.hypot(next.x - before.x, next.z - before.z) / dt,
  };
}
