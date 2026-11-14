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
    height: 42,
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
export const bridgeY = (b: Bridge, t: number) =>
  Math.pow(Math.sin(Math.PI * t), 1.1) * b.height;
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
  buildings = new SpatialHash<Building>();
  roads = new SpatialHash<Road>(100);
  constructor(public data: CityData) {
    for (const b of data.buildings) {
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
  bridgeAt(x: number, z: number) {
    for (const b of BRIDGES) {
      const s = bridgeSample(b, x, z);
      if (s.d < b.width * 0.52) return { bridge: b, ...s };
    }
    return null;
  }
  height(x: number, z: number) {
    const b = this.bridgeAt(x, z);
    return b ? bridgeY(b.bridge, b.t) : 0;
  }
  water(x: number, z: number) {
    if (this.bridgeAt(x, z)) return false;
    if (x < bounds.minX || z < -8500) return true;
    return (
      this.data.ocean.some((p) => pointInPoly(x, z, p)) ||
      this.data.areas.some(
        (a) => a.kind === "water" && pointInPoly(x, z, a.pts),
      )
    );
  }
  blocked(x: number, z: number, r = 0.4) {
    if (this.height(x, z) > 2) return false;
    for (const b of this.buildings.query(x, z, r)) {
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
  move(x: number, z: number, dx: number, dz: number, r: number) {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(dx, dz) / Math.max(0.2, r * 0.6)),
    );
    let hit = false;
    for (let i = 0; i < steps; i++) {
      const nx = x + dx / steps,
        nz = z + dz / steps;
      if (!this.blocked(nx, nz, r)) {
        x = nx;
        z = nz;
      } else {
        hit = true;
        if (!this.blocked(nx, z, r)) x = nx;
        if (!this.blocked(x, nz, r)) z = nz;
      }
    }
    return { x, z, hit };
  }
}
