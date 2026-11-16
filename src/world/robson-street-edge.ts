import * as T from "three";
import { robsonGridCandidates } from "./robson-grid-candidates";
import {
  VehicleRoadSurfaceBuilder,
  type VehicleRoadSurface,
} from "./vehicle-road-surface";
import { ROBSON_MOUND_OUTLINE } from "./robson-mound-site";
import { ROBSON_MOUND_CIRCULATION_POLYGONS } from "./robson-mound-circulation";
import { ROBSON_RINK_OPENINGS } from "./robson-rink-exterior-data";
import clipping from "polygon-clipping";
import {
  pointInPoly,
  roadWidth,
  segmentPoint,
  type CityData,
  type Point,
  type Road,
} from "./data";
import {
  ROBSON_STREET_EDGE as D,
  robsonStreetLocal as local,
  robsonStreetWorld as world,
} from "./robson-street-edge-data";

type Multi = Point[][][];
type Vertex = [number, number, number];
export type RobsonStreetSurface = "sidewalk" | "curb" | "gutter" | "soil";
export type RobsonStreetTriangle = {
  points: [Vertex, Vertex, Vertex];
  surface: RobsonStreetSurface;
};
const open = (r: Point[]) =>
  r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1]
    ? r.slice(0, -1)
    : r;
// Micrometre snapping stabilizes boolean joins between collinear OSM splits.
const snap = (p: Multi): Multi =>
  p.map((poly) =>
    poly.map((r) =>
      r.map(([x, z]) => [Math.round(x * 1e6) / 1e6, Math.round(z * 1e6) / 1e6]),
    ),
  );
const union = (p: Multi[]) =>
  p.length
    ? snap(clipping.union(...(p.map(snap) as [Multi, ...Multi[]])) as Multi)
    : [];
const inside = (x: number, z: number, p: Multi) =>
  p.some(
    (r) =>
      pointInPoly(x, z, r[0].flat()) &&
      !r.slice(1).some((h) => pointInPoly(x, z, h.flat())),
  );
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
function ribbon(r: Road, pad = 0): Multi {
  const a: Point[] = [],
    b: Point[] = [];
  for (let i = 0; i < r.pts.length; i += 2) {
    const k = Math.max(0, i - 2),
      j = Math.min(r.pts.length - 2, i + 2),
      dx = r.pts[j] - r.pts[k],
      dz = r.pts[j + 1] - r.pts[k + 1],
      len = Math.hypot(dx, dz) || 1,
      w = roadWidth(r) / 2 + pad;
    a.push([r.pts[i] + (dz / len) * w, r.pts[i + 1] - (dx / len) * w]);
    b.push([r.pts[i] - (dz / len) * w, r.pts[i + 1] + (dx / len) * w]);
  }
  return snap([[a.concat(b.reverse())]]);
}
function distance(x: number, z: number, p: Multi) {
  let d = Infinity;
  for (const poly of p)
    for (const rr of poly) {
      const r = open(rr);
      for (let i = 0; i < r.length; i++)
        d = Math.min(
          d,
          segmentPoint(x, z, ...r[i], ...r[(i + 1) % r.length]).d,
        );
    }
  return d;
}
/** Pure local geometry/contact factory. It never changes roads, trees or the
 * existing gallery, mound, garden and rink providers. Integration is gated by
 * exact named source roads and uses actual emitted float32 upward triangles. */
export function createRobsonStreetEdgeSite(
  data: CityData,
  baseline: (x: number, z: number) => number,
) {
  const roads = data.roads.filter((r) =>
    (D.roadIds as readonly string[]).includes(r.id ?? ""),
  );
  if (roads.length !== D.roadIds.length) return undefined;
  const B = D.bounds,
    boundary: Multi = [
      [
        [
          world(B.minU, B.minV),
          world(B.maxU, B.minV),
          world(B.maxU, B.maxV),
          world(B.minU, B.maxV),
        ],
      ],
    ];
  const nearby = (r: Road) =>
    r.pts.some(
      (x, i) =>
        i % 2 === 0 &&
        (() => {
          const [u, v] = local(x, r.pts[i + 1]);
          return (
            u > B.minU - 150 &&
            u < B.maxU + 150 &&
            v > B.minV - 150 &&
            v < B.maxV + 150
          );
        })(),
    );
  const barriers = data.roads.filter(
    (r) =>
      nearby(r) &&
      (r.kind === "cycleway" || r.kind === "service" || r.id === "w50098016"),
  );
  // The source traffic/bike/pedestrian widths are inviolable. No sidewalk or
  // raised separator bridges a protected route, including the parkade exit.
  const protectedPlan = union(barriers.map((r) => ribbon(r, 0.08)));
  const buildings: Multi = data.buildings
    .filter((b) =>
      b.pts.some((x, i) => i % 2 === 0 && inside(x, b.pts[i + 1], boundary)),
    )
    .map((b) => [
      Array.from(
        { length: b.pts.length / 2 },
        (_, i) => [b.pts[i * 2], b.pts[i * 2 + 1]] as Point,
      ),
    ]);
  const roadPlan = union(roads.map((r) => ribbon(r)));
  const offset = (pad: number) =>
    clipping.intersection(
      snap(boundary),
      union(roads.map((r) => ribbon(r, pad))),
    ) as Multi;
  const protectedGarden: Multi = [
    [
      Array.from(
        { length: ROBSON_MOUND_OUTLINE.length / 2 },
        (_, i) =>
          [
            ROBSON_MOUND_OUTLINE[i * 2],
            ROBSON_MOUND_OUTLINE[i * 2 + 1],
          ] as Point,
      ),
    ],
    ...(ROBSON_MOUND_CIRCULATION_POLYGONS as Multi),
    ...ROBSON_RINK_OPENINGS.map((o) => [
      o.polygon.map((p) => [p[0], p[1]] as Point),
    ]),
  ];
  const exclusions = union([protectedPlan, buildings, protectedGarden]);
  const strip = (a: number, b: number) =>
    clipping.difference(
      snap(clipping.difference(snap(offset(b)), snap(offset(a))) as Multi),
      snap(exclusions),
    ) as Multi;
  const masks: Record<RobsonStreetSurface, Multi> = {
    gutter: strip(0, D.gutterWidth),
    curb: strip(D.gutterWidth, D.gutterWidth + D.curbWidth),
    sidewalk: strip(D.gutterWidth + D.curbWidth, D.apronExtent),
    soil: [],
  };
  // Preserve inventory positions; only trees wholly surrounded by this new
  // sidewalk receive a recessed opening. Others retain their existing ground.
  const trees: { id: number; point: Point; ring: Point[] }[] = [];
  for (const t of data.publicTrees?.trees ?? []) {
    const [id, x, z] = t,
      [u, v] = local(x, z),
      h = D.treeOpeningHalf;
    const ring = [
      world(u - h, v - h),
      world(u + h, v - h),
      world(u + h, v + h),
      world(u - h, v + h),
    ];
    if (ring.every((p) => inside(...p, masks.sidewalk))) {
      trees.push({ id, point: [x, z], ring });
    }
  }
  masks.soil = union(trees.map((t) => [[t.ring]]));
  if (masks.soil.length)
    masks.sidewalk = clipping.difference(masks.sidewalk, masks.soil) as Multi;
  const crossings = data.roads.filter((r) => nearby(r) && r.crossing);
  const ramp = (x: number, z: number) => {
    let d = Infinity;
    for (const r of crossings)
      for (let i = 0; i < r.pts.length - 2; i += 2)
        d = Math.min(
          d,
          segmentPoint(
            x,
            z,
            ...(r.pts.slice(i, i + 4) as [number, number, number, number]),
          ).d,
        );
    // Both curbs and the broader apron flatten into the real crosswalk mouths.
    return smooth((d - 1.25) / 2.1);
  };
  const tie = (x: number, z: number) => {
    const [u, v] = local(x, z),
      ends = Math.min(u - B.minU, B.maxU - u, v - B.minV, B.maxV - v);
    // Do not introduce threshold steps against retained buildings/old paving.
    return smooth(ends / 1.8) * smooth(distance(x, z, buildings) / 1.1);
  };
  const analyticY = (x: number, z: number, s: RobsonStreetSurface) =>
    baseline(x, z) +
    D.roadFinish +
    (s === "gutter" || s === "soil" ? 0 : D.curbRise * ramp(x, z) * tie(x, z));
  // Sample the finish once on a fixed triangular grid. Clipping masks against
  // those same planes prevents thin boolean slivers turning a smooth ramp into
  // a near-vertical triangle through nonlinear per-vertex height interpolation.
  const step = D.sampleStep;
  const heights = new Map<string, number>();
  const cornerY = (x: number, z: number, s: RobsonStreetSurface) => {
    const key = `${x},${z},${s}`;
    let value = heights.get(key);
    if (value === undefined) {
      value = analyticY(x, z, s);
      heights.set(key, value);
    }
    return value;
  };
  const y = (x: number, z: number, s: RobsonStreetSurface) => {
    const ix = Math.floor(x / step),
      iz = Math.floor(z / step),
      a = ix * step,
      b = iz * step,
      u = (x - a) / step,
      v = (z - b) / step;
    const h00 = cornerY(a, b, s),
      h11 = cornerY(a + step, b + step, s);
    return u >= v
      ? h00 +
          (cornerY(a + step, b, s) - h00) * u +
          (h11 - cornerY(a + step, b, s)) * v
      : h00 +
          (h11 - cornerY(a, b + step, s)) * u +
          (cornerY(a, b + step, s) - h00) * v;
  };
  const triangles: RobsonStreetTriangle[] = [];
  const emit = (p: [Point, Point, Point], surface: RobsonStreetSurface) => {
    const points = p.map((a) => [
      Math.fround(a[0]),
      Math.fround(y(...a, surface)),
      Math.fround(a[1]),
    ]) as [Vertex, Vertex, Vertex];
    const [a, b, c] = points,
      cross = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
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
  for (const surface of ["sidewalk", "curb", "gutter", "soil"] as const) {
    for (const poly of masks[surface]) {
      const candidate = robsonGridCandidates(poly, step);
      const pts = poly.flat(),
        xs = pts.map((p) => p[0]),
        zs = pts.map((p) => p[1]);
      for (
        let ix = Math.floor(Math.min(...xs) / step);
        ix <= Math.floor(Math.max(...xs) / step);
        ix++
      )
        for (
          let iz = Math.floor(Math.min(...zs) / step);
          iz <= Math.floor(Math.max(...zs) / step);
          iz++
        ) {
          if (!candidate(ix, iz)) continue;
          const x = ix * step,
            z = iz * step;
          for (const grid of [
            [
              [x, z],
              [x + step, z],
              [x + step, z + step],
            ],
            [
              [x, z],
              [x + step, z + step],
              [x, z + step],
            ],
          ] as Point[][]) {
            const cut = clipping.intersection([poly], [[grid]]) as Multi;
            for (const piece of cut) {
              const rings = piece.map(open),
                flat = rings.flat(),
                v = rings.map((r) => r.map((p) => new T.Vector2(...p)));
              for (const t of T.ShapeUtils.triangulateShape(v[0], v.slice(1)))
                emit(t.map((i) => flat[i]) as [Point, Point, Point], surface);
            }
          }
        }
    }
  }
  const sides: [Vertex, Vertex, Vertex, Vertex][] = [];
  // Every exposed higher edge closes to the original finish, including tree
  // reveals and patch boundaries. Internal equal-height seams get no wall.
  for (const surface of ["sidewalk", "curb"] as const)
    for (const poly of masks[surface])
      for (const rr of poly) {
        const ring = open(rr);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 1e-6) continue;
          const nx = (b[1] - a[1]) / len,
            nz = -(b[0] - a[0]) / len,
            m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const sign = inside(
            m[0] + nx * 0.002,
            m[1] + nz * 0.002,
            masks[surface],
          )
            ? -1
            : 1;
          const q: Point = [m[0] + sign * nx * 0.004, m[1] + sign * nz * 0.004];
          if (inside(...q, masks.sidewalk) || inside(...q, masks.curb))
            continue;
          const n = Math.ceil(len / D.sampleStep);
          for (let j = 0; j < n; j++) {
            const p = (t: number): Point => [
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
              ],
              pa = p(j / n),
              pb = p((j + 1) / n);
            const top = (p: Point): Vertex => [
              Math.fround(p[0]),
              Math.fround(y(...p, surface)),
              Math.fround(p[1]),
            ];
            const low = (p: Point): Vertex => [
              Math.fround(p[0]),
              Math.fround(y(...p, "gutter")),
              Math.fround(p[1]),
            ];
            let face: [Vertex, Vertex, Vertex, Vertex] = [
              top(pa),
              top(pb),
              low(pb),
              low(pa),
            ];
            const va = new T.Vector3(...face[1]).sub(new T.Vector3(...face[0])),
              vb = new T.Vector3(...face[2]).sub(new T.Vector3(...face[0]));
            if (va.cross(vb).dot(new T.Vector3(nx * sign, 0, nz * sign)) < 0)
              face = [face[1], face[0], face[3], face[2]];
            if (
              Math.max(
                Math.abs(face[0][1] - face[3][1]),
                Math.abs(face[1][1] - face[2][1]),
              ) > 0.00001
            )
              sides.push(face);
          }
        }
      }
  const buckets = new Map<string, RobsonStreetTriangle[]>(),
    key = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  for (const t of triangles) {
    const xs = t.points.map((p) => p[0]),
      zs = t.points.map((p) => p[2]);
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
          v = buckets.get(k) ?? [];
        v.push(t);
        buckets.set(k, v);
      }
  }
  const containsRoadSupportBounds = (x: number, z: number) => {
    const [u, v] = local(x, z);
    return u >= B.minU && u <= B.maxU && v >= B.minV && v <= B.maxV;
  };
  let roadBuilder: VehicleRoadSurfaceBuilder | undefined;
  let roadContact: VehicleRoadSurface | undefined;
  const beginRoadContact = () => {
    roadBuilder = new VehicleRoadSurfaceBuilder();
    roadContact = undefined;
  };
  const captureRoadContact = (geometry: T.BufferGeometry, road: Road) => {
    if (
      !roadBuilder ||
      !(roads.includes(road) || road.kind === "footway" || road.kind === "path")
    )
      return;
    const sourcePlan = Array.from({ length: road.pts.length / 2 }, (_, i) =>
      local(road.pts[i * 2], road.pts[i * 2 + 1]),
    );
    const margin = roadWidth(road);
    if (
      Math.max(...sourcePlan.map((p) => p[0])) < B.minU - margin ||
      Math.min(...sourcePlan.map((p) => p[0])) > B.maxU + margin ||
      Math.max(...sourcePlan.map((p) => p[1])) < B.minV - margin ||
      Math.min(...sourcePlan.map((p) => p[1])) > B.maxV + margin
    )
      return;
    const position = geometry.getAttribute("position"),
      ix = geometry.index;
    if (!position) return;
    const vertices: number[] = [];
    const end = Math.min(
      ix?.count ?? position.count,
      geometry.drawRange.start + geometry.drawRange.count,
    );
    for (let i = geometry.drawRange.start; i + 2 < end; i += 3) {
      const ids = [0, 1, 2].map((k) => (ix ? ix.getX(i + k) : i + k));
      const points = ids.map((j) => [
        position.getX(j),
        position.getY(j),
        position.getZ(j),
      ]);
      const plan = points.map((p) => local(p[0], p[2]));
      if (
        Math.max(...plan.map((p) => p[0])) < B.minU ||
        Math.min(...plan.map((p) => p[0])) > B.maxU ||
        Math.max(...plan.map((p) => p[1])) < B.minV ||
        Math.min(...plan.map((p) => p[1])) > B.maxV
      )
        continue;
      // Keep only the actual visible upward floor, not undersides or caps.
      const [a, b, c] = points;
      if ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) <= 1e-9)
        continue;
      vertices.push(...points.flat());
    }
    const copy = new T.BufferGeometry().setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
    roadBuilder.add(copy);
    copy.dispose();
  };
  const finishRoadContact = () => {
    roadContact = roadBuilder?.finish();
    roadBuilder = undefined;
  };
  const height = (x: number, z: number) => {
    for (const {
      points: [a, b, c],
    } of buckets.get(key(x, z)) ?? []) {
      const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
        return u * a[1] + v * b[1] + (1 - u - v) * c[1];
    }
    // The final road triangles supply on-foot contact only. Their construction
    // samples groundHeight, never this finish, so build order cannot raise them.
    // Protected plaza/bike/service routes and garden/wells keep their providers.
    if (
      containsRoadSupportBounds(x, z) &&
      !inside(x, z, protectedGarden) &&
      !inside(x, z, protectedPlan)
    )
      return roadContact?.height(x, z);
    return undefined;
  };
  return {
    containsRoadSupportBounds,
    beginRoadContact,
    captureRoadContact,
    finishRoadContact,
    coverage: union(Object.values(masks)),
    protectedGarden,
    triangles,
    sides,
    masks,
    trees,
    roadPlan,
    protectedPlan,
    height,
    local,
    boundary,
    ramp,
  };
}
export type RobsonStreetEdgeSite = NonNullable<
  ReturnType<typeof createRobsonStreetEdgeSite>
>;
export function createRobsonStreetEdgeGeometry(site: RobsonStreetEdgeSite) {
  const parts = {} as Record<RobsonStreetSurface, T.BufferGeometry>;
  for (const surface of ["sidewalk", "curb", "gutter", "soil"] as const) {
    const vertices = site.triangles
      .filter((t) => t.surface === surface)
      .flatMap((t) => t.points);
    if (surface === "curb")
      for (const f of site.sides)
        for (const i of [0, 1, 2, 0, 2, 3]) vertices.push(f[i]);
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices.flat(), 3),
    );
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        vertices.flatMap((p) => local(p[0], p[2])),
        2,
      ),
    );
    g.computeVertexNormals();
    parts[surface] = g;
  }
  return parts;
}
