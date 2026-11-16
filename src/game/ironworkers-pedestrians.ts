import type { Road } from "../world/data";
import type { createIronworkersPathBoundary } from "../world/ironworkers-path-boundary";
type Boundary = ReturnType<typeof createIronworkersPathBoundary>;
const cached = new WeakMap<Boundary, Map<Road, Road>>();
/** Only the two bridge routes change; external source ways retain identity/data. */
export function ironworkersPedestrianRoad(
  road: Road,
  boundary?: Boundary,
): Road {
  if (!boundary || !["w35260598", "w62125826"].includes(road.id ?? ""))
    return road;
  let routes = cached.get(boundary);
  if (!routes) {
    routes = new Map();
    cached.set(boundary, routes);
  }
  const previous = routes.get(road);
  if (previous) return previous;
  const side = road.id === "w35260598" ? -1 : 1;
  const south = boundary.ties.find(
    (t) => t.side === side && t.endKind === "south",
  )!;
  const north = boundary.ties.find(
    (t) => t.side === side && t.endKind === "north",
  )!;
  const main = boundary.walkingCentres.find((r) => r.side === side)!;
  const points = [
    ...[...south.centres].reverse(),
    ...main.points.slice(1),
    ...north.centres.slice(1),
  ];
  if (side === 1) points.reverse();
  const mapped = { ...road, width: 2.5, pts: points.flat() };
  routes.set(road, mapped);
  return mapped;
}
