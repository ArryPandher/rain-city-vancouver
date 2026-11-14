import {
  pointInPoly,
  roadWidth,
  segmentPoint,
  seeded,
  hash,
  type Area,
  type CityData,
} from "./data";
import { CollisionWorld, SpatialHash } from "./collision";
import { treeProfile, type TreeProfile } from "./tree-profile";
export const STANLEY_BOUNDS = {
  minX: -2830,
  maxX: -780,
  minZ: -3440,
  maxZ: -1380,
};
function contains(a: Area, x: number, z: number) {
  return (
    pointInPoly(x, z, a.pts) && !a.holes?.some((h) => pointInPoly(x, z, h))
  );
}
export class ForestHabitat {
  woodland: Area[];
  openings: Area[];
  private woodlandIndex = new SpatialHash<Area>(160);
  private openingIndex = new SpatialHash<Area>(160);
  constructor(
    public data: CityData,
    public collision: CollisionWorld,
  ) {
    this.woodland = data.areas.filter(
      (a) =>
        a.kind === "forest" &&
        a.name !== "Stanley Park" &&
        a.pts.some(
          (x, i) =>
            i % 2 === 0 &&
            x < -800 &&
            a.pts[i + 1] < -1380 &&
            x > -2830 &&
            a.pts[i + 1] > -3440,
        ),
    );
    this.openings = data.areas.filter((a) =>
      [
        "grass",
        "pitch",
        "playground",
        "parking",
        "plaza",
        "water",
        "beach",
        "garden",
      ].includes(a.kind),
    );
    for (const [areas, index] of [
      [this.woodland, this.woodlandIndex],
      [this.openings, this.openingIndex],
    ] as const)
      for (const a of areas) {
        const xs = a.pts.filter((_, i) => i % 2 === 0),
          zs = a.pts.filter((_, i) => i % 2 === 1);
        index.add(
          a,
          Math.min(...xs),
          Math.min(...zs),
          Math.max(...xs),
          Math.max(...zs),
        );
      }
  }
  contains(x: number, z: number) {
    const b = STANLEY_BOUNDS;
    return (
      x > b.minX &&
      x < b.maxX &&
      z > b.minZ &&
      z < b.maxZ &&
      this.woodlandIndex.query(x, z, 0).some((a) => contains(a, x, z)) &&
      !this.openingIndex.query(x, z, 0).some((a) => contains(a, x, z))
    );
  }
  clear(x: number, z: number, margin = 1) {
    if (
      !this.contains(x, z) ||
      this.collision.water(x, z) ||
      this.collision.blocked(x, z, margin)
    )
      return false;
    for (const road of this.collision.roads.query(x, z, 25 + margin)) {
      for (let i = 0; i < road.pts.length - 2; i += 2) {
        if (
          segmentPoint(
            x,
            z,
            road.pts[i],
            road.pts[i + 1],
            road.pts[i + 2],
            road.pts[i + 3],
          ).d <
          roadWidth(road) / 2 + margin
        )
          return false;
      }
    }
    return true;
  }
  /** Jittered clusters within actual woodland polygons, with mapped tree/road clearance. */
  trees(existing: TreeProfile[]) {
    const occupied = new SpatialHash<TreeProfile>(20);
    for (const t of existing) occupied.add(t, t.x, t.z, t.x, t.z);
    const out: TreeProfile[] = [],
      b = STANLEY_BOUNDS;
    for (let gx = b.minX; gx < b.maxX; gx += 8)
      for (let gz = b.minZ; gz < b.maxZ; gz += 8) {
        const r = seeded(hash(`stanley:${gx}:${gz}`));
        const cluster =
          (Math.sin(gx * 0.023 + Math.sin(gz * 0.014) * 2) +
            Math.sin(gz * 0.021)) *
            0.13 +
          0.7;
        if (r() > cluster) continue;
        const x = gx + (r() - 0.5) * 6.8,
          z = gz + (r() - 0.5) * 6.8;
        if (
          occupied
            .query(x, z, 5)
            .some((t) => Math.hypot(x - t.x, z - t.z) < 5) ||
          !this.clear(x, z, 2.4)
        )
          continue;
        const h = 22 + r() * 20;
        const t = treeProfile(x, z, h, 0.4 + (h - 22) * 0.035, {
          name: "Coastal conifer interpretation",
          genus: "PSEUDOTSUGA",
          species: "MENZIESII",
          cultivar: "",
        });
        out.push(t);
        occupied.add(t, x, z, x, z);
      }
    return out;
  }
}
