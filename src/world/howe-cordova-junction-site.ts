import * as T from "three";
import clipping from "polygon-clipping";
import { facadeFrame, type Vertex3 } from "./architectural-mesh";
import {
  isStreet,
  pointInPoly,
  roadWidth,
  segmentPoint,
  type CityData,
  type Point,
  type Road,
} from "./data";
import { ribbon, subdividePath } from "./geometry";
import { PACIFIC_COAST_RING } from "./pacific-coast-site";
import type { PacificCoastApronSite } from "./pacific-coast-apron-site";

type Multi = Point[][][];
export type JunctionSurface = "sidewalk" | "curb" | "gutter";
export type JunctionTriangle = {
  points: [Vertex3, Vertex3, Vertex3];
  surface: JunctionSurface;
};
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
const open = (ring: Point[]) =>
  ring.length > 1 &&
  ring[0][0] === ring.at(-1)![0] &&
  ring[0][1] === ring.at(-1)![1]
    ? ring.slice(0, -1)
    : ring;
const inside = (x: number, z: number, polys: Multi) =>
  polys.some(
    (p) =>
      pointInPoly(x, z, p[0].flat()) &&
      !p.slice(1).some((h) => pointInPoly(x, z, h.flat())),
  );
const distance = (x: number, z: number, rings: Point[][]) => {
  let d = Infinity;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      d = Math.min(d, segmentPoint(x, z, ...a, ...b).d);
    }
  return d;
};

/** Photo-informed finish, not surveyed curb coordinates. Imported road widths,
 * actual facade/apron outlines and baseline grades remain authoritative. */
export const HOWE_CORDOVA_JUNCTION = {
  curbWidth: 0.18,
  curbRise: 0.14,
  gutterWidth: 0.32,
  roadFinish: 0.094,
  surfaceSeparation: 0.003,
  sampleStep: 0.9,
  roadContactFullDistance: 8,
  roadContactFadeDistance: 8,
} as const;

/** Same sampled edge directions as world.ts's terrain-following road ribbon.
 * Offset changes are only used to obtain gutter/curb bands, not to widen roads. */
function ribbonPlan(r: Road, offset: number): Multi {
  const points = subdividePath(r.pts),
    a: Point[] = [],
    b: Point[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const j = Math.min(points.length - 2, i + 2),
      k = Math.max(0, i - 2);
    const dx = points[j] - points[k],
      dz = points[j + 1] - points[k + 1],
      len = Math.hypot(dx, dz) || 1;
    const radius = roadWidth(r) / 2 + offset;
    a.push([
      points[i] + (dz / len) * radius,
      points[i + 1] - (dx / len) * radius,
    ]);
    b.push([
      points[i] - (dz / len) * radius,
      points[i + 1] + (dx / len) * radius,
    ]);
  }
  return [[a.concat(b.reverse())]];
}

/** Read-only contact copies of the already rendered road triangles. Full
 * parity beside the gutter; a gentle outer tie preserves older support beyond
 * this one junction. This never changes road geometry or construction grade. */
function adjacentRoadContact(
  roads: Road[],
  gutter: Multi,
  baseline: (x: number, z: number) => number,
) {
  const rings = gutter.flat().map(open),
    points = rings.flat();
  const radius =
    HOWE_CORDOVA_JUNCTION.roadContactFullDistance +
    HOWE_CORDOVA_JUNCTION.roadContactFadeDistance;
  const bounds = {
    minX: Math.min(...points.map((p) => p[0])) - radius,
    maxX: Math.max(...points.map((p) => p[0])) + radius,
    minZ: Math.min(...points.map((p) => p[1])) - radius,
    maxZ: Math.max(...points.map((p) => p[1])) + radius,
  };
  const containsBounds = (x: number, z: number) =>
    x >= bounds.minX &&
    x <= bounds.maxX &&
    z >= bounds.minZ &&
    z <= bounds.maxZ;
  const triangles: [Vertex3, Vertex3, Vertex3][] = [];
  const buckets = new Map<string, number[]>(),
    key = (x: number, z: number) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  if (points.length)
    for (const road of roads) {
      const g = ribbon(
        subdividePath(road.pts),
        roadWidth(road),
        isStreet(road) ? 0.092 : road.walkway ? 0.15 : 0.07,
        baseline,
        5,
        true,
      );
      const p = g.getAttribute("position"),
        ix = g.getIndex()!;
      for (let i = 0; i < ix.count; i += 3) {
        const tri = [0, 1, 2].map((k) => {
          const n = ix.getX(i + k);
          return [p.getX(n), p.getY(n), p.getZ(n)] as Vertex3;
        }) as [Vertex3, Vertex3, Vertex3];
        const xs = tri.map((p) => p[0]),
          zs = tri.map((p) => p[2]),
          minX = Math.min(...xs),
          maxX = Math.max(...xs),
          minZ = Math.min(...zs),
          maxZ = Math.max(...zs);
        if (
          maxX < bounds.minX ||
          minX > bounds.maxX ||
          maxZ < bounds.minZ ||
          minZ > bounds.maxZ
        )
          continue;
        const id = triangles.length;
        triangles.push(tri);
        for (let x = Math.floor(minX / 4); x <= Math.floor(maxX / 4); x++)
          for (let z = Math.floor(minZ / 4); z <= Math.floor(maxZ / 4); z++) {
            const k = `${x},${z}`,
              bucket = buckets.get(k) ?? [];
            bucket.push(id);
            buckets.set(k, bucket);
          }
      }
      g.dispose();
    }
  const height = (x: number, z: number): number | undefined => {
    if (!containsBounds(x, z)) return undefined;
    const bucket = buckets.get(key(x, z));
    if (!bucket) return undefined;
    let sourceY = -Infinity;
    for (const i of bucket) {
      const [a, b, c] = triangles[i],
        det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(det) < 1e-8) continue;
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1.0000001)
        sourceY = Math.max(sourceY, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
    }
    if (!Number.isFinite(sourceY)) return undefined;
    const weight =
      1 -
      smooth(
        (distance(x, z, rings) -
          HOWE_CORDOVA_JUNCTION.roadContactFullDistance) /
          HOWE_CORDOVA_JUNCTION.roadContactFadeDistance,
      );
    if (weight <= 0) return undefined;
    const ground = baseline(x, z);
    return ground + (sourceY - ground) * weight;
  };
  return { height, containsBounds, triangleCount: triangles.length };
}

export function createHoweCordovaJunctionSite(
  data: Pick<CityData, "roads" | "buildings">,
  baseline: (x: number, z: number) => number,
  apron: PacificCoastApronSite,
) {
  const c = facadeFrame(PACIFIC_COAST_RING[0], PACIFIC_COAST_RING[1]);
  const origin = PACIFIC_COAST_RING[0],
    tx = (PACIFIC_COAST_RING[1][0] - origin[0]) / c.length,
    tz = (PACIFIC_COAST_RING[1][1] - origin[1]) / c.length;
  const world = (u: number, d: number): Point => [
    origin[0] + tx * u + c.outward[0] * d,
    origin[1] + tz * u + c.outward[1] * d,
  ];
  const local = (x: number, z: number): Point => [
    (x - origin[0]) * tx + (z - origin[1]) * tz,
    (x - origin[0]) * c.outward[0] + (z - origin[1]) * c.outward[1],
  ];
  const rect = (u0: number, d0: number, u1: number, d1: number): Point[] => [
    world(u0, d0),
    world(u1, d0),
    world(u1, d1),
    world(u0, d1),
  ];
  // Only the 325/club side of the junction. End ties are blended over 1.8m.
  const domain = clipping.union(
    [rect(-18, 0, c.length + 8, 14)],
    [rect(c.length - 1.6, -17, c.length + 6, 2)],
  ) as Multi;
  const domainRings = domain.flat().map(open),
    all = domainRings.flat();
  const bounds = {
    minX: Math.min(...all.map((p) => p[0])),
    maxX: Math.max(...all.map((p) => p[0])),
    minZ: Math.min(...all.map((p) => p[1])),
    maxZ: Math.max(...all.map((p) => p[1])),
  };
  const containsBounds = (x: number, z: number) =>
    x >= bounds.minX - 0.001 &&
    x <= bounds.maxX + 0.001 &&
    z >= bounds.minZ - 0.001 &&
    z <= bounds.maxZ + 0.001;
  const nearby = data.roads.filter(
    (r) =>
      (isStreet(r) || r.kind === "service") &&
      r.pts.some(
        (x, i) =>
          i % 2 === 0 &&
          x > bounds.minX - 35 &&
          x < bounds.maxX + 35 &&
          r.pts[i + 1] > bounds.minZ - 35 &&
          r.pts[i + 1] < bounds.maxZ + 35,
      ),
  );
  const roadMask = (offset: number): Multi => {
    const parts = nearby.flatMap((r) => ribbonPlan(r, offset));
    return parts.length
      ? (clipping.union(parts[0], ...parts.slice(1)) as Multi)
      : [];
  };
  const roads = roadMask(0),
    expanded = roadMask(HOWE_CORDOVA_JUNCTION.curbWidth),
    inset = roadMask(-HOWE_CORDOVA_JUNCTION.gutterWidth),
    trough = roadMask(-0.1),
    bevelEdge = roadMask(0.035);
  const roadRings = roads.flat().map(open);
  const buildings = data.buildings
    .filter((b) =>
      b.pts.some((x, i) => i % 2 === 0 && containsBounds(x, b.pts[i + 1])),
    )
    .map((b) => [
      Array.from(
        { length: b.pts.length / 2 },
        (_, i): Point => [b.pts[i * 2], b.pts[i * 2 + 1]],
      ),
    ]);
  const buildingRings = buildings.flat();
  const free = clipping.difference(
    domain,
    [apron.polygon],
    ...buildings,
  ) as Multi;
  const masks: Record<JunctionSurface, Multi> = {
    sidewalk: clipping.difference(free, expanded) as Multi,
    curb: clipping.intersection(
      free,
      clipping.difference(expanded, roads),
    ) as Multi,
    gutter: clipping.intersection(
      free,
      clipping.difference(roads, inset),
    ) as Multi,
  };
  const roadContact = adjacentRoadContact(nearby, masks.gutter, baseline);
  // Explicit profile break lines retain the 35mm bevel and 10mm gutter
  // depression even when the surrounding terrain tessellation is much coarser.
  const profileMasks: Record<JunctionSurface, Multi[]> = {
    sidewalk: [masks.sidewalk],
    curb: [
      clipping.intersection(masks.curb, bevelEdge) as Multi,
      clipping.difference(masks.curb, bevelEdge) as Multi,
    ],
    gutter: [
      clipping.intersection(masks.gutter, trough) as Multi,
      clipping.difference(masks.gutter, trough) as Multi,
    ],
  };
  const coverage = clipping.union(
    masks.sidewalk,
    masks.curb,
    masks.gutter,
  ) as Multi;
  const pathCutout = clipping.union(coverage, [apron.polygon]) as Multi;
  const crossings = data.roads
    .filter((r) => r.crossing || r.kind === "service")
    .flatMap((r) => {
      const parts: [Point, Point][] = [];
      for (let i = 0; i < r.pts.length - 2; i += 2) {
        const a: Point = [r.pts[i], r.pts[i + 1]],
          b: Point = [r.pts[i + 2], r.pts[i + 3]];
        if (containsBounds(...a) || containsBounds(...b)) parts.push([a, b]);
      }
      return parts;
    });
  const ramp = (x: number, z: number) => {
    let d = Infinity;
    for (const [a, b] of crossings)
      d = Math.min(d, segmentPoint(x, z, ...a, ...b).d);
    return smooth((d - 1.2) / 2.1);
  };
  const tie = (x: number, z: number) => {
    const [u, d] = local(x, z);
    // Artificial patch ends meet old paving without a retaining lip. Building
    // thresholds and the existing open apron end retain their current grades.
    const ends = Math.min(u + 18, 14 - d, d + 17, c.length + 8 - u);
    const building = distance(x, z, buildingRings);
    const entry = segmentPoint(
      x,
      z,
      ...apron.entrance[0],
      ...apron.entrance[1],
    ).d;
    return (
      smooth(ends / 1.8) *
      smooth((building - 0.5) / 1.1) *
      smooth((entry - 0.1) / 1.2)
    );
  };
  const surfaceY = (x: number, z: number, surface: JunctionSurface) => {
    const cfg = HOWE_CORDOVA_JUNCTION,
      blend = tie(x, z);
    const finish = cfg.roadFinish,
      rise = cfg.curbRise * ramp(x, z);
    const nearRoad = distance(x, z, roadRings);
    if (surface === "gutter") {
      const depression = Math.max(
        0,
        Math.min(nearRoad / 0.1, (cfg.gutterWidth - nearRoad) / 0.22),
      );
      return baseline(x, z) + finish - 0.01 * depression;
    }
    const bevel =
      surface === "curb"
        ? Math.max(0, 1 - nearRoad / 0.035) * 0.025 * ramp(x, z)
        : 0;
    const entryDistance = segmentPoint(
      x,
      z,
      ...apron.entrance[0],
      ...apron.entrance[1],
    ).d;
    const separation = cfg.surfaceSeparation * smooth(entryDistance / 0.15);
    return (
      baseline(x, z) + separation + (finish + rise - bevel - separation) * blend
    );
  };
  const triangles: JunctionTriangle[] = [];
  const cfg = HOWE_CORDOVA_JUNCTION;
  // Triangulate each already-clipped mask once, then split long edges. This
  // preserves exact boundaries without thousands of per-cell boolean operations.
  const heightCache = new Map<string, number>();
  const cachedY = (p: Point, surface: JunctionSurface) => {
    const key = `${surface},${p[0]},${p[1]}`;
    let y = heightCache.get(key);
    if (y === undefined) {
      y = surfaceY(...p, surface);
      heightCache.set(key, y);
    }
    return y;
  };
  const emit = (a: Point, b: Point, c: Point, surface: JunctionSurface) => {
    // Collision uses the same float32 positions ultimately uploaded to the GPU.
    // Boolean near-parallel edges occasionally leave sub-millimetre slivers;
    // suppress these numerically unstable triangles rather than amplifying them.
    const points = [a, b, c].map(
      (p) =>
        [
          Math.fround(p[0]),
          Math.fround(cachedY(p, surface)),
          Math.fround(p[1]),
        ] as Vertex3,
    ) as JunctionTriangle["points"];
    const [pa, pb, pc] = points;
    const cross =
      (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]);
    const longest = Math.max(
      ...points.map((p, i) =>
        Math.hypot(
          p[0] - points[(i + 1) % 3][0],
          p[2] - points[(i + 1) % 3][2],
        ),
      ),
    );
    if (Math.abs(cross) / longest < 0.0001) return;
    if (cross < 0) [points[1], points[2]] = [points[2], points[1]];
    triangles.push({ points, surface });
  };
  const subdivide = (p: [Point, Point, Point], surface: JunctionSurface) => {
    const pending: [Point, Point, Point][] = [p];
    while (pending.length) {
      const tri = pending.pop()!;
      const lengths = tri.map((a, i) => {
        const b = tri[(i + 1) % 3];
        return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
      });
      const longest = Math.max(...lengths);
      if (longest <= cfg.sampleStep ** 2) {
        emit(...tri, surface);
        continue;
      }
      const i = lengths.indexOf(longest),
        a = tri[i],
        b = tri[(i + 1) % 3],
        c = tri[(i + 2) % 3],
        mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      pending.push([a, mid, c], [mid, b, c]);
    }
  };
  for (const surface of ["sidewalk", "curb", "gutter"] as const)
    for (const mask of profileMasks[surface])
      for (const poly of mask) {
        const rings = poly.map(open),
          pts = rings.flat(),
          contours = rings.map((r) => r.map((p) => new T.Vector2(...p)));
        for (const tri of T.ShapeUtils.triangulateShape(
          contours[0],
          contours.slice(1),
        ))
          subdivide(tri.map((i) => pts[i]) as [Point, Point, Point], surface);
      }
  // Fixed spatial buckets avoid scanning the entire surface on each actor query.
  const buckets = new Map<string, JunctionTriangle[]>(),
    key = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  for (const tri of triangles) {
    const xs = tri.points.map((p) => p[0]),
      zs = tri.points.map((p) => p[2]);
    for (
      let x = Math.floor(Math.min(...xs) / 2);
      x <= Math.floor(Math.max(...xs) / 2);
      x++
    )
      for (
        let z = Math.floor(Math.min(...zs) / 2);
        z <= Math.floor(Math.max(...zs) / 2);
        z++
      ) {
        const k = `${x},${z}`,
          list = buckets.get(k) ?? [];
        list.push(tri);
        buckets.set(k, list);
      }
  }
  const height = (x: number, z: number): number | undefined => {
    if (!containsBounds(x, z)) return undefined;
    let fallback: number | undefined;
    for (const {
      points: [a, b, c],
    } of buckets.get(key(x, z)) ?? []) {
      const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
      if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) return y;
      if (u >= -0.0001 && v >= -0.0001 && u + v <= 1.0001) fallback = y;
    }
    return fallback;
  };
  const curbFaces: [Vertex3, Vertex3, Vertex3, Vertex3][] = [];
  for (const ring of roadRings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-6) continue;
      const nx = (b[1] - a[1]) / len,
        nz = -(b[0] - a[0]) / len,
        n = Math.ceil(len / 0.35);
      for (let j = 0; j < n; j++) {
        const at = (t: number): Point => [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
        ];
        const p = at(j / n),
          q = at((j + 1) / n),
          mid = at((j + 0.5) / n);
        let side = inside(mid[0] + nx * 0.07, mid[1] + nz * 0.07, masks.curb)
          ? 1
          : inside(mid[0] - nx * 0.07, mid[1] - nz * 0.07, masks.curb)
            ? -1
            : 0;
        if (!side || ![p, q].every((p) => containsBounds(...p))) continue;
        const top = (p: Point): Vertex3 => [p[0], surfaceY(...p, "curb"), p[1]];
        const pa = top(p),
          pb = top(q),
          la: Vertex3 = [p[0], baseline(...p) + cfg.roadFinish, p[1]],
          lb: Vertex3 = [q[0], baseline(...q) + cfg.roadFinish, q[1]];
        if (Math.max(pa[1] - la[1], pb[1] - lb[1]) < 0.002) continue;
        curbFaces.push(side > 0 ? [la, lb, pb, pa] : [lb, la, pa, pb]);
      }
    }
  return {
    bounds,
    containsBounds,
    masks,
    coverage,
    pathCutout,
    triangles,
    curbFaces,
    height,
    roadHeight: roadContact.height,
    containsRoadSupportBounds: roadContact.containsBounds,
    roadSupportTriangleCount: roadContact.triangleCount,
    world,
    local,
    ramp,
    baseline,
  };
}
export type HoweCordovaJunctionSite = ReturnType<
  typeof createHoweCordovaJunctionSite
>;
