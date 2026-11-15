import { galleryRearStepHeight } from "./gallery-rear-entry";
import { canadaPlaceGuardSegments } from "./canada-place-guards";
import {
  createCanadaPlaceSite,
  CANADA_PLACE_ROAD_IDS,
  CANADA_PLACE_SERVICE_IDS,
  type CanadaPlaceSite,
} from "./canada-place-site";
import {
  CANADA_PLACE_DECK_Y,
  CANADA_PLACE_PIER,
  CANADA_PLACE_PIER_ID,
  CANADA_PLACE_ENTRY_CONNECTOR,
  CANADA_PLACE_DECK_COLLIDER_IDS,
  supportedDeck,
  solidAt,
  inCanadaPlacePier,
} from "./canada-place-deck";
import { harbourTower } from "./harbour-towers-site";
import { harbourGroundHeight } from "./harbour-green-site";
import { FAIRMONT_ID, fairmontFootprint } from "./fairmont-site";
import { ROGERS_ID, rogersFootprint } from "./rogers-site";
import { jackGroundHeight, jackRoofAccess, CACTUS_ID } from "./jack-poole-site";
import {
  ROBSON_GARDEN_ID,
  robsonWalkableBuilding,
  robsonHeight,
  robsonObstacle,
} from "./robson-site";
import { prospectLookoutHeight } from "./prospect-lookout-site";
import { prospectForecourtHeight } from "./prospect-site";
import {
  CONVENTION_ID,
  conventionSite,
  conventionDeckHeight,
  conventionApproachHeight,
  type ConventionSite,
} from "./convention-site";
import {
  CityData,
  Building,
  bounds,
  centroid,
  pointInPoly,
  segmentPoint,
  geo,
  Road,
  roadWidth,
  isStreet,
} from "./data";
export interface Bridge {
  id: string;
  name: string;
  a: [number, number];
  b: [number, number];
  width: number;
  height: number;
  style: "concrete" | "suspension" | "truss";
  points?: [number, number][];
}
export const BRIDGES: Bridge[] = [
  {
    id: "cambie",
    name: "Cambie Bridge",
    a: [208, 832],
    b: [363, 1590],
    points: [
      [208, 832],
      [328, 953],
      [365, 1025],
      [377, 1110],
      [363, 1590],
    ],
    width: 32,
    height: 17,
    style: "concrete",
  },
  {
    id: "granville",
    name: "Granville Bridge",
    a: geo(49.2763, -123.1291),
    b: geo(49.269, -123.1381),
    width: 28,
    height: 22,
    style: "truss",
  },
  {
    id: "burrard",
    name: "Burrard Bridge",
    a: geo(49.2771, -123.1334),
    b: geo(49.2729, -123.144),
    width: 23,
    height: 21,
    style: "concrete",
  },
  {
    id: "lions",
    name: "Lions Gate Bridge",
    a: [-1590, -3185],
    b: [-520, -4958],
    width: 22,
    height: 61,
    style: "suspension",
  },
  {
    id: "ironworkers",
    name: "Ironworkers Memorial Bridge",
    a: [6806, -952],
    b: [6776, -2268],
    width: 36,
    height: 39,
    style: "truss",
  },
];
export function bridgePoint(b: Bridge, t: number): [number, number] {
  const pts = b.points || [b.a, b.b],
    lengths = pts
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])),
    total = lengths.reduce((a, b) => a + b, 0);
  let distance = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const f = distance / lengths[i];
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
      ];
    }
    distance -= lengths[i];
  }
  return b.b;
}
export function bridgeSample(b: Bridge, x: number, z: number) {
  const pts = b.points || [b.a, b.b],
    lengths = pts
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])),
    total = lengths.reduce((a, b) => a + b, 0);
  let offset = 0,
    best = { x: 0, z: 0, d: Infinity, t: 0 };
  for (let i = 0; i < lengths.length; i++) {
    const s = segmentPoint(x, z, ...pts[i], ...pts[i + 1]);
    if (s.d < best.d) best = { ...s, t: (offset + s.t * lengths[i]) / total };
    offset += lengths[i];
  }
  return best;
}
export const bridgeY = (
  b: Bridge,
  t: number,
  ends: [number, number] = [0, 0],
) => {
  t = Math.max(0, Math.min(1, t));
  const baseline = ends[0] * (1 - t) + ends[1] * t;
  const peak = Math.max(b.height, ends[0] + 3, ends[1] + 3);
  return (
    baseline +
    Math.pow(Math.sin(Math.PI * t), 1.1) * (peak - (ends[0] + ends[1]) / 2)
  );
};
export class SpatialHash<T> {
  cells = new Map<string, T[]>();
  constructor(public size = 64) {}
  add(v: T, minX: number, minZ: number, maxX = minX, maxZ = minZ) {
    for (
      let x = Math.floor(minX / this.size);
      x <= Math.floor(maxX / this.size);
      x++
    )
      for (
        let z = Math.floor(minZ / this.size);
        z <= Math.floor(maxZ / this.size);
        z++
      ) {
        const k = x + "," + z;
        let a = this.cells.get(k);
        if (!a) this.cells.set(k, (a = []));
        a.push(v);
      }
  }
  query(x: number, z: number, r = 0) {
    const out = new Set<T>();
    for (
      let ix = Math.floor((x - r) / this.size);
      ix <= Math.floor((x + r) / this.size);
      ix++
    )
      for (
        let iz = Math.floor((z - r) / this.size);
        iz <= Math.floor((z + r) / this.size);
        iz++
      )
        for (const v of this.cells.get(ix + "," + iz) || []) out.add(v);
    return [...out];
  }
}
export class CollisionWorld {
  barriers = new SpatialHash<{
    ax: number;
    az: number;
    bx: number;
    bz: number;
    radius: number;
    top: number;
  }>(32);
  addBarrier(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    radius: number,
    top: number,
  ) {
    this.barriers.add(
      { ax, az, bx, bz, radius, top },
      Math.min(ax, bx) - radius,
      Math.min(az, bz) - radius,
      Math.max(ax, bx) + radius,
      Math.max(az, bz) + radius,
    );
  }
  harbour = false;
  gallery = false;
  robsonGarden?: Building;
  convention?: ConventionSite;
  canada?: CanadaPlaceSite;
  buildings = new SpatialHash<Building>();
  roads = new SpatialHash<Road>(100);
  forestObstacles = new SpatialHash<{ x: number; z: number; radius: number }>(
    24,
  );
  addForestTrunk(x: number, z: number, radius: number) {
    this.forestObstacles.add(
      { x, z, radius },
      x - radius,
      z - radius,
      x + radius,
      z + radius,
    );
  }
  constructor(public data: CityData) {
    this.gallery = data.buildings.some((b) => b.id === "w69701736");
    this.harbour = data.areas.some((a) => a.name === "Harbour Green Park");
    for (const source of data.buildings) {
      let b = source;
      const harbour = harbourTower(b.id);
      if (harbour) b = { ...b, pts: harbour.parts[0].pts.flat() };
      if (b.id === FAIRMONT_ID) b = { ...b, pts: fairmontFootprint };
      if (b.id === ROGERS_ID) b = { ...b, pts: rogersFootprint };
      if (b.id === CONVENTION_ID) {
        this.convention = conventionSite(b);
        b = { ...b, pts: this.convention.footprint };
        for (const [a, c] of this.convention.shoreSegments)
          this.addBarrier(
            ...this.convention.world(...a),
            ...this.convention.world(...c),
            0.06,
            7.2,
          );
      }
      if (b.id === ROBSON_GARDEN_ID) this.robsonGarden = b;
      if (robsonWalkableBuilding(b.id)) continue;
      const xs = b.pts.filter((_, i) => !(i % 2)),
        zs = b.pts.filter((_, i) => i % 2);
      this.buildings.add(
        b,
        Math.min(...xs),
        Math.min(...zs),
        Math.max(...xs),
        Math.max(...zs),
      );
    }
    if (
      data.buildings.some((b) => b.id === CANADA_PLACE_PIER_ID) &&
      [...CANADA_PLACE_ROAD_IDS].every((id) =>
        data.roads.some((r) => r.id === id),
      )
    ) {
      const ring = (p: number[]): [number, number][] =>
        Array.from({ length: p.length / 2 }, (_, i) => [
          p[i * 2],
          p[i * 2 + 1],
        ]);
      this.canada = createCanadaPlaceSite({
        roads: data.roads,
        buildings: data.buildings,
        westernHeight: (x, z) => this.existingGroundHeight(x, z),
        connectors: [ring(CANADA_PLACE_ENTRY_CONNECTOR)],
        existingDeck: ring(CANADA_PLACE_PIER),
      });
      for (const rail of canadaPlaceGuardSegments(data, this.canada, (x, z) =>
        this.existingGroundHeight(x, z),
      ))
        this.addBarrier(
          ...rail.a,
          ...rail.b,
          0.06,
          Math.max(rail.topA, rail.topB),
        );
    }
    for (const r of data.roads) {
      for (let i = 0; i < r.pts.length - 2; i += 2)
        this.roads.add(
          r,
          Math.min(r.pts[i], r.pts[i + 2]),
          Math.min(r.pts[i + 1], r.pts[i + 3]),
          Math.max(r.pts[i], r.pts[i + 2]),
          Math.max(r.pts[i + 1], r.pts[i + 3]),
        );
    }
  }
  groundHeight(x: number, z: number) {
    if (this.canada && supportedDeck(x, z)) return CANADA_PLACE_DECK_Y;
    return this.canada?.baselineHeight(x, z) ?? this.existingGroundHeight(x, z);
  }
  /** Pre-Canada surface sampler: the western tie must never recurse into itself. */
  existingGroundHeight(x: number, z: number) {
    const gallery = this.gallery ? galleryRearStepHeight(x, z) : undefined;
    if (gallery !== undefined) return gallery;
    const harbour = this.harbour ? harbourGroundHeight(x, z) : undefined;
    if (harbour !== undefined) return harbour;
    const plaza = this.convention && jackGroundHeight(x, z);
    if (plaza !== undefined) return plaza;
    const convention = conventionDeckHeight(this.convention, x, z);
    if (convention !== undefined) return convention;
    const approach = conventionApproachHeight(this.convention, x, z);
    if (approach !== undefined) return approach;
    const lookout = this.data.terrain && prospectLookoutHeight(x, z);
    if (lookout !== undefined) return lookout;
    const forecourt = this.data.terrain && prospectForecourtHeight(x, z);
    if (forecourt !== undefined) return forecourt;
    return this.robsonGarden
      ? (robsonHeight(x, z, this.robsonGarden.pts) ??
          this.data.terrain?.height(x, z) ??
          0)
      : (this.data.terrain?.height(x, z) ?? 0);
  }
  roadHeight(road: Road, x: number, z: number) {
    if (this.canada && road.id && CANADA_PLACE_SERVICE_IDS.has(road.id))
      return this.existingGroundHeight(x, z);
    return this.data.terrain?.contains(x, z) &&
      !/Lions Gate Bridge/.test(road.name ?? "")
      ? this.groundHeight(x, z)
      : this.height(x, z);
  }
  bridgeHeight(b: Bridge, t: number) {
    return bridgeY(b, t, [
      this.groundHeight(...b.a),
      this.groundHeight(...b.b),
    ]);
  }
  bridgeAt(x: number, z: number, referenceY = Infinity) {
    for (const b of BRIDGES) {
      const s = bridgeSample(b, x, z);
      if (s.d < b.width * 0.52 && this.bridgeHeight(b, s.t) <= referenceY + 3)
        return { bridge: b, ...s };
    }
    return null;
  }
  height(x: number, z: number, referenceY = Infinity) {
    const b = this.bridgeAt(x, z, referenceY);
    return b ? this.bridgeHeight(b.bridge, b.t) : this.groundHeight(x, z);
  }
  water(x: number, z: number, referenceY = Infinity) {
    if (
      this.canada &&
      referenceY >= CANADA_PLACE_DECK_Y - 0.5 &&
      (supportedDeck(x, z) || this.canada.contains(x, z))
    )
      return false;
    if (this.harbour && harbourGroundHeight(x, z) !== undefined) return false;
    if (this.convention && jackGroundHeight(x, z) !== undefined) return false;
    if (conventionDeckHeight(this.convention, x, z) !== undefined) return false;
    if (this.bridgeAt(x, z, referenceY)) return false;
    if (x < bounds.minX || z < -8500) return true;
    return (
      this.data.ocean.some((p) => pointInPoly(x, z, p)) ||
      this.data.areas.some(
        (a) => a.kind === "water" && pointInPoly(x, z, a.pts),
      )
    );
  }
  blocked(x: number, z: number, r = 0.4, referenceY = Infinity) {
    // A retaining face is not a step: low actors cannot enter the raised
    // support through its side and be snapped up by ground-following physics.
    if (
      this.canada?.contains(x, z) &&
      Number.isFinite(referenceY) &&
      this.groundHeight(x, z) > referenceY + 0.45
    )
      return true;
    const canadaLevel = this.canada && referenceY >= CANADA_PLACE_DECK_Y - 0.5;
    // Public deck eligibility never opens the closed hotel/exhibition volumes.
    if (canadaLevel && inCanadaPlacePier(x, z) && solidAt(x, z, r)) return true;
    if (this.robsonGarden && robsonObstacle(x, z, r)) return true;
    const bridge = this.bridgeAt(x, z, referenceY);
    if (
      bridge &&
      this.bridgeHeight(bridge.bridge, bridge.t) > this.groundHeight(x, z) + 2
    )
      return false;
    for (const tree of this.forestObstacles.query(x, z, r))
      if (Math.hypot(x - tree.x, z - tree.z) < r + tree.radius) return true;
    for (const wall of this.barriers.query(x, z, r))
      if (
        (!Number.isFinite(referenceY) || referenceY < wall.top + 0.2) &&
        segmentPoint(x, z, wall.ax, wall.az, wall.bx, wall.bz).d <
          r + wall.radius
      )
        return true;
    for (const b of this.buildings.query(x, z, r)) {
      if (
        canadaLevel &&
        CANADA_PLACE_DECK_COLLIDER_IDS.has(b.id) &&
        !solidAt(x, z, r) &&
        (supportedDeck(x, z, r) ||
          (!inCanadaPlacePier(x, z) && this.canada!.contains(x, z)))
      )
        continue;
      if (b.id === CACTUS_ID && jackRoofAccess(x, z, referenceY)) continue;
      if (pointInPoly(x, z, b.pts)) return true;
      for (let i = 0; i < b.pts.length; i += 2) {
        const j = (i + 2) % b.pts.length;
        if (
          segmentPoint(x, z, b.pts[i], b.pts[i + 1], b.pts[j], b.pts[j + 1]).d <
          r
        )
          return true;
      }
    }
    return false;
  }
  onStreet(x: number, z: number, clearance = 0.3) {
    for (const road of this.roads.query(x, z, 24 + clearance)) {
      if (!isStreet(road)) continue;
      for (let i = 0; i < road.pts.length - 2; i += 2)
        if (
          segmentPoint(
            x,
            z,
            road.pts[i],
            road.pts[i + 1],
            road.pts[i + 2],
            road.pts[i + 3],
          ).d <
          roadWidth(road) / 2 + clearance
        )
          return true;
    }
    return false;
  }
  nearestRoad(x: number, z: number, max = 90) {
    let best: {
      x: number;
      z: number;
      t: number;
      d: number;
      heading: number;
      road: Road;
    } | null = null;
    for (const r of this.roads.query(x, z, max)) {
      if (
        ![
          "primary",
          "secondary",
          "tertiary",
          "residential",
          "unclassified",
          "cycleway",
          "pedestrian",
        ].includes(r.kind)
      )
        continue;
      for (let i = 0; i < r.pts.length - 2; i += 2) {
        const s = segmentPoint(
          x,
          z,
          r.pts[i],
          r.pts[i + 1],
          r.pts[i + 2],
          r.pts[i + 3],
        );
        if (s.d < max && (!best || s.d < best.d))
          best = {
            ...s,
            heading: Math.atan2(
              r.pts[i + 2] - r.pts[i],
              r.pts[i + 3] - r.pts[i + 1],
            ),
            road: r,
          };
      }
    }
    return best;
  }
  safe(x: number, z: number, r = 0.5) {
    if (!this.blocked(x, z, r) && !this.water(x, z))
      return [x, z] as [number, number];
    const p = this.nearestRoad(x, z, 180);
    if (p && !this.blocked(p.x, p.z, r)) return [p.x, p.z] as [number, number];
    for (let d = 3; d < 90; d += 4)
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        const nx = x + Math.sin(a) * d,
          nz = z + Math.cos(a) * d;
        if (!this.blocked(nx, nz, r) && !this.water(nx, nz))
          return [nx, nz] as [number, number];
      }
    return [x, z] as [number, number];
  }
  /** Choose a nearby door/rear exit on this level, including elevated roads. */
  vehicleExit(x: number, z: number, heading: number, y: number) {
    for (const [side, along] of [
      [2.3, 0],
      [-2.3, 0],
      [0, -3.2],
      [0, 3.2],
      [2.3, -1.8],
      [-2.3, -1.8],
    ]) {
      const xx = x + Math.cos(heading) * side + Math.sin(heading) * along;
      const zz = z - Math.sin(heading) * side + Math.cos(heading) * along;
      const h = this.height(xx, zz, y);
      if (
        Math.abs(h - y) <= 0.6 &&
        !this.blocked(xx, zz, 0.4, y) &&
        !this.water(xx, zz, y)
      )
        return [xx, zz] as [number, number];
    }
  }
  move(
    x: number,
    z: number,
    dx: number,
    dz: number,
    r: number,
    referenceY = Infinity,
  ) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(dx, dz) / Math.max(0.2, r * 0.6)),
    );
    let hit = false;
    for (let i = 0; i < steps; i++) {
      const nx = x + dx / steps,
        nz = z + dz / steps;
      if (!this.blocked(nx, nz, r, referenceY)) {
        x = nx;
        z = nz;
      } else {
        hit = true;
        if (!this.blocked(nx, z, r, referenceY)) x = nx;
        if (!this.blocked(x, nz, r, referenceY)) z = nz;
      }
    }
    return { x, z, hit };
  }
}
