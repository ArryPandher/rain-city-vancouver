import { improveRailGroundTriangles } from "./second-narrows-rail-context-triangulation";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pointInPoly, type CityData, type Point } from "./data";
import pc from "polygon-clipping";
import { createRailContextRoadProfiles } from "./second-narrows-rail-context-road-profile";
import { preflightSecondNarrowsRail } from "./second-narrows-rail-bridge";
import {
  SECOND_NARROWS_CONTEXT as D,
  SECOND_NARROWS_CONTEXT_STATIONS,
  SECOND_NARROWS_CONTEXT_POINTS,
  railContextPoint,
  railContextTop,
} from "./second-narrows-rail-context-data";

export type RailContextRole =
  | "ground"
  | "ballast"
  | "steel"
  | "timber"
  | "concrete";
type V = [number, number, number];
export interface RailGroundTriangle {
  points: [V, V, V];
  bounds: [number, number, number, number];
}
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

/** Pure candidate: caller must install visible cuts and this same sampler
 * together. No implicit World/Collision/road mutation occurs here. */
export function createSecondNarrowsRailContext(
  data: Pick<CityData, "buildings" | "roads" | "ocean" | "areas">,
) {
  if (!preflightSecondNarrowsRail(data.buildings)) return null;
  const railwayStreet = data.roads.find((r) => r.id === "w24007615");
  if (!railwayStreet) return null;
  const roles: RailContextRole[] = [
    "ground",
    "ballast",
    "steel",
    "timber",
    "concrete",
  ];
  const bins: Record<RailContextRole, T.BufferGeometry[]> = {
    ground: [],
    ballast: [],
    steel: [],
    timber: [],
    concrete: [],
  };
  const triangles: RailGroundTriangle[] = [],
    grid = new Map<string, number[]>();
  const positions: number[] = [],
    uvs: number[] = [];
  const stations = [
    ...new Set([
      0,
      D.bankStart,
      D.length,
      ...SECOND_NARROWS_CONTEXT_STATIONS.filter((s) => s < D.length),
      ...Array.from(
        { length: Math.ceil(D.length / D.step) },
        (_, i) => i * D.step,
      ),
    ]),
  ].sort((a, b) => a - b);
  // Shared cross sections avoid overlaps/gaps at the OSM polyline bends.
  const point = (s: number, u: number, y: number): V => {
    const [x, z] = railContextPoint(s, u);
    return [x, y, z];
  };
  const baseWidth = (s: number) =>
    Math.max(
      12,
      D.shoulderHalfWidth +
        2.3 * Math.max(0, railContextTop(s) - D.yardRailTop),
    );
  const halfWidth = (s: number, _side = 1) => baseWidth(s) + 13;
  const easedLinear = (t: number) => {
    t = Math.max(0, Math.min(1, t));
    return t < 0.1
      ? (t * t) / 0.18
      : t > 0.9
        ? 1 - (1 - t) ** 2 / 0.18
        : (t - 0.05) / 0.9;
  };
  const waterSource = [
    ...data.ocean,
    ...data.areas.filter((a) => a.kind === "water").map((a) => a.pts),
  ];
  const study: Point[] = [
    [6550, -2280],
    [7020, -2280],
    [7020, -1710],
    [6550, -1710],
  ];
  const localWater = waterSource.flatMap((p) => {
    const xs = p.filter((_, i) => i % 2 === 0),
      zs = p.filter((_, i) => i % 2 === 1);
    if (
      Math.max(...xs) < 6550 ||
      Math.min(...xs) > 7020 ||
      Math.max(...zs) < -2280 ||
      Math.min(...zs) > -1710
    )
      return [];
    const ring = Array.from(
      { length: p.length / 2 },
      (_, i) => [p[i * 2], p[i * 2 + 1]] as Point,
    );
    return pc.intersection([study], [ring]);
  });
  const shoreRings = localWater.flat().map((r) => r.flat());
  const shore = (x: number, z: number) => {
    let d = Infinity;
    for (const p of shoreRings) {
      if (pointInPoly(x, z, p)) return { distance: 0, inside: true };
      for (let i = 2; i < p.length; i += 2) {
        const dx = p[i] - p[i - 2],
          dz = p[i + 1] - p[i - 1],
          l = dx * dx + dz * dz;
        if (!l) continue;
        const t = Math.max(
          0,
          Math.min(1, ((x - p[i - 2]) * dx + (z - p[i - 1]) * dz) / l),
        );
        d = Math.min(
          d,
          Math.hypot(x - p[i - 2] - dx * t, z - p[i - 1] - dz * t),
        );
      }
    }
    return { distance: d, inside: false };
  };
  const baseSoil = (s: number, u: number) =>
    s < D.bankToeStart || s > D.length
      ? 0
      : Math.max(0, railContextTop(s) - D.yardRailTop) *
        smooth((s - D.bankToeStart) / (D.bankStart - D.bankToeStart)) *
        easedLinear(
          (baseWidth(s) - Math.abs(u)) / (baseWidth(s) - D.shoulderHalfWidth),
        );
  const locate = (x: number, z: number) => {
    let best = { s: 0, u: 0, d: Infinity };
    const candidates: { s: number; d: number }[] = [];
    for (let i = 1; i < SECOND_NARROWS_CONTEXT_POINTS.length; i++) {
      const a = SECOND_NARROWS_CONTEXT_POINTS[i - 1],
        b = SECOND_NARROWS_CONTEXT_POINTS[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      const t = Math.max(
          0,
          Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length)),
        ),
        px = a[0] + dx * t,
        pz = a[1] + dz * t,
        d = Math.hypot(x - px, z - pz);
      candidates.push({
        s: SECOND_NARROWS_CONTEXT_STATIONS[i - 1] + t * length,
        d,
      });
      if (d < best.d)
        best = {
          s: SECOND_NARROWS_CONTEXT_STATIONS[i - 1] + t * length,
          u: Math.sign((x - px) * dz - (z - pz) * dx) * d,
          d,
        };
    }
    // The nearest segment's station jumps across a bend's Voronoi line away
    // from the track. Blend equally close projections only on the soil slopes;
    // the rail shoulder keeps its exact longitudinal datum.
    if (best.d > D.shoulderHalfWidth) {
      let sum = 0,
        weighted = 0;
      for (const q of candidates) {
        const w = Math.exp(-(((q.d - best.d) / 0.25) ** 2));
        sum += w;
        weighted += q.s * w;
      }
      const blend = smooth((best.d - D.shoulderHalfWidth) / 3);
      best.s = best.s * (1 - blend) + (weighted / sum) * blend;
    }
    return best;
  };
  const baseAt = (x: number, z: number) => {
    const q = locate(x, z);
    return baseSoil(q.s, q.u);
  };
  const roadProfiles = createRailContextRoadProfiles(
    data.roads,
    baseAt,
    (x, z) => shore(x, z).distance,
  );
  const soilAt = (x: number, z: number) => {
    const coast = shore(x, z);
    if (coast.inside) return 0;
    const onRoad = roadProfiles.at(x, z, false, 0.001);
    if (onRoad) return Math.max(0, onRoad.plane(x, z));
    const base = baseAt(x, z);
    let y = base,
      best = Infinity;
    for (const road of roadProfiles.nearby([x - 8, z - 8, x + 8, z + 8]))
      for (let i = 0; i < road.polygon.length; i++) {
        const a = road.polygon[i],
          b = road.polygon[(i + 1) % road.polygon.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(
            1,
            ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
          ),
        );
        const qx = a[0] + dx * t,
          qz = a[1] + dz * t,
          d = Math.hypot(x - qx, z - qz);
        if (d >= 8 || d >= best) continue;
        best = d;
        const h = Math.max(0, road.plane(qx, qz));
        // Linear grade envelope, rather than a short smoothstep cliff beside the road.
        y = Math.max(0, h - d * 0.64, Math.min(base, h + d * 0.64));
      }
    return Math.min(y, coast.distance * 0.6);
  };
  const soil = (s: number, u: number) => {
    const p = point(s, u, 0);
    return soilAt(p[0], p[2]);
  };
  const emitTriangle = (a: V, b: V, c: V) => {
    const planar =
      (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
    if (Math.abs(planar) < 1e-7) return; // exact clipping-edge degeneracy, before Float32 rounding

    const rounded = (p: V): V => {
      const x = Math.fround(p[0]),
        z = Math.fround(p[2]);
      return [x, Math.fround(soilAt(x, z)), z];
    };
    a = rounded(a);
    b = rounded(b);
    c = rounded(c);
    const normal = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (Math.abs(normal.y) < 1e-9) return;
    if (normal.y < 0) [b, c] = [c, b];
    const bounds: [number, number, number, number] = [
      Math.min(a[0], b[0], c[0]),
      Math.min(a[2], b[2], c[2]),
      Math.max(a[0], b[0], c[0]),
      Math.max(a[2], b[2], c[2]),
    ];
    const id = triangles.length;
    triangles.push({ points: [a, b, c], bounds });
    for (
      let x = Math.floor(bounds[0] / 16);
      x <= Math.floor(bounds[2] / 16);
      x++
    )
      for (
        let z = Math.floor(bounds[1] / 16);
        z <= Math.floor(bounds[3] / 16);
        z++
      ) {
        const key = `${x},${z}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(id);
      }
    for (const p of [a, b, c]) {
      positions.push(...p);
      uvs.push(p[0], p[2]);
    }
  };
  const constrained = (a: V, b: V, c: V) => {
    for (const t of roadProfiles.partition([a, b, c], soilAt))
      emitTriangle(...t);
  };
  const tri = (a: V, b: V, c: V) => {
    const checks = [a, b, c].map((p) => shore(p[0], p[2])),
      edge = Math.max(
        Math.hypot(a[0] - b[0], a[2] - b[2]),
        Math.hypot(b[0] - c[0], b[2] - c[2]),
        Math.hypot(c[0] - a[0], c[2] - a[2]),
      );
    if (!checks.some((p) => p.inside || p.distance < edge)) {
      constrained(a, b, c);
      return;
    }
    const ring = [a, b, c].map((p) => [p[0], p[2]] as Point),
      d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    for (const polygon of pc.difference([ring], localWater)) {
      const points = polygon[0].slice(0, -1),
        holes = polygon.slice(1).map((r) => r.slice(0, -1)),
        flat = [...points, ...holes.flat()];
      const indices = T.ShapeUtils.triangulateShape(
        points.map((p) => new T.Vector2(...p)),
        holes.map((r) => r.map((p) => new T.Vector2(...p))),
      );
      const vertex = ([x, z]: Point): V => {
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d,
          v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
        return [x, soilAt(x, z), z];
      };
      for (const ids of indices)
        constrained(
          vertex(flat[ids[0]]),
          vertex(flat[ids[1]]),
          vertex(flat[ids[2]]),
        );
    }
  };
  const bankStations = stations.filter((s) => s >= D.bankToeStart),
    left: Point[] = [],
    right: Point[] = [];
  const fractions = [
    -1, -0.9, -0.75, -0.6, -0.45, -0.3, 0, 0.3, 0.45, 0.6, 0.75, 0.9, 1,
  ];
  for (const s of bankStations) {
    const a = point(s, -halfWidth(s, -1), 0),
      b = point(s, halfWidth(s), 0);
    left.push([Math.fround(a[0]), Math.fround(a[2])]);
    right.push([Math.fround(b[0]), Math.fround(b[2])]);
  }
  for (let i = 1; i < bankStations.length; i++)
    for (let j = 1; j < fractions.length; j++) {
      const a = bankStations[i - 1],
        b = bankStations[i];
      const vertex = (s: number, f: number) => {
        const u =
          Math.sign(f) *
          (Math.abs(f) <= 0.3
            ? (Math.abs(f) / 0.3) * D.shoulderHalfWidth
            : D.shoulderHalfWidth +
              ((Math.abs(f) - 0.3) / 0.7) *
                (halfWidth(s, Math.sign(f)) - D.shoulderHalfWidth));
        return point(s, u, soil(s, u));
      };
      const p = vertex(a, fractions[j - 1]),
        q = vertex(b, fractions[j - 1]),
        r = vertex(b, fractions[j]),
        t = vertex(a, fractions[j]);
      tri(p, q, r);
      tri(p, r, t);
    }
  const improved = improveRailGroundTriangles(
    triangles,
    (x, z) => !!roadProfiles.at(x, z),
  );
  triangles.length = 0;
  grid.clear();
  positions.length = 0;
  uvs.length = 0;
  for (const p of improved) emitTriangle(...p);
  const ground = new T.BufferGeometry();
  ground.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  ground.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  ground.computeVertexNormals();
  bins.ground.push(ground);
  const masks = pc.difference(
    [[[...left, ...right.reverse(), left[0]]]],
    localWater,
  );
  const nearbyGround = (bounds: [number, number, number, number]) => {
    const ids = new Set<number>();
    for (
      let x = Math.floor(bounds[0] / 16);
      x <= Math.floor(bounds[2] / 16);
      x++
    )
      for (
        let z = Math.floor(bounds[1] / 16);
        z <= Math.floor(bounds[3] / 16);
        z++
      )
        for (const id of grid.get(`${x},${z}`) ?? []) ids.add(id);
    return [...ids]
      .map((id) => triangles[id])
      .filter(
        (t) =>
          t.bounds[0] <= bounds[2] &&
          t.bounds[2] >= bounds[0] &&
          t.bounds[1] <= bounds[3] &&
          t.bounds[3] >= bounds[1],
      );
  };
  const sampleSurface = (x: number, z: number): number | undefined => {
    if (!Number.isFinite(x + z)) return undefined;
    let edge: number | undefined;
    for (const id of grid.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`) ??
      []) {
      const {
        points: [a, b, c],
        bounds,
      } = triangles[id];
      if (
        x < bounds[0] - 0.0001 ||
        x > bounds[2] + 0.0001 ||
        z < bounds[1] - 0.0001 ||
        z > bounds[3] + 0.0001
      )
        continue;
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
        return a[1] * u + b[1] * v + c[1] * (1 - u - v);
      if (u >= -0.0003 && v >= -0.0003 && u + v <= 1.0003)
        edge = a[1] * u + b[1] * v + c[1] * (1 - u - v);
    }
    return edge;
  };
  const beam = (
    a: V,
    b: V,
    width: number,
    depth: number,
    role: RailContextRole,
  ) => {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      delta = bv.clone().sub(av);
    const g = new T.BoxGeometry(width, depth, delta.length());
    const tangent = delta.normalize(),
      across = new T.Vector3(0, 1, 0).cross(tangent).normalize(),
      up = tangent.clone().cross(across).normalize();
    g.applyMatrix4(new T.Matrix4().makeBasis(across, up, tangent));
    g.translate(...av.add(bv).multiplyScalar(0.5).toArray());
    bins[role].push(g);
  };
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i];
    for (const u of [-0.7175, 0.7175])
      beam(
        point(a, u, railContextTop(a) - 0.09),
        point(b, u, railContextTop(b) - 0.09),
        0.085,
        0.18,
        "steel",
      );
    if (a >= D.bankStart) {
      const vertices: number[] = [],
        uv: number[] = [];
      const face = (points: V[], normal: V) => {
        const cross = new T.Vector3(...points[1])
          .sub(new T.Vector3(...points[0]))
          .cross(new T.Vector3(...points[2]).sub(new T.Vector3(...points[0])));
        if (cross.dot(new T.Vector3(...normal)) < 0) points.reverse();
        for (const i of [0, 1, 2, 0, 2, 3]) {
          vertices.push(...points[i]);
          uv.push(points[i][0], points[i][2]);
        }
      };
      const top = (s: number, u: number) =>
          point(s, u, railContextTop(s) - 0.3),
        bottom = (s: number, u: number) => point(s, u, railContextTop(s) - 0.7);
      face(
        [top(a, -1.35), top(b, -1.35), top(b, 1.35), top(a, 1.35)],
        [0, 1, 0],
      );
      for (const sign of [-1, 1]) {
        const centre = point((a + b) / 2, 0, 0),
          outer = point((a + b) / 2, sign, 0);
        face(
          [
            bottom(a, sign * 1.9),
            bottom(b, sign * 1.9),
            top(b, sign * 1.35),
            top(a, sign * 1.35),
          ],
          [outer[0] - centre[0], 0, outer[2] - centre[2]],
        );
      }
      if (a === D.bankStart || b === D.length) {
        const s = a === D.bankStart ? a : b,
          near = point(s, 0, 0),
          far = point(s + (a === D.bankStart ? -0.01 : 0.01), 0, 0);
        face(
          [bottom(s, -1.9), bottom(s, 1.9), top(s, 1.35), top(s, -1.35)],
          [far[0] - near[0], 0, far[2] - near[2]],
        );
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      bins.ballast.push(g);
    } else
      for (const u of [-0.7175, 0.7175])
        beam(
          point(a, u, D.railTop - 0.52),
          point(b, u, D.railTop - 0.52),
          0.3,
          0.65,
          "steel",
        );
  }
  for (let s = 0.4; s < D.length; s += 0.8)
    beam(
      point(s, -1.25, railContextTop(s) - 0.27),
      point(s, 1.25, railContextTop(s) - 0.27),
      0.22,
      0.18,
      "timber",
    );
  // Bearing cap at the rail/ballast join. The earth toes in below the final
  // open girders; the actual service road at station−7.4 remains outside the bank.
  beam(
    point(D.bankStart, -3, D.railTop - 1.2),
    point(D.bankStart, 3, D.railTop - 1.2),
    1.2,
    1,
    "concrete",
  );
  // The earth now closes continuously to the existing ground at station0.
  // A broad vertical concrete closure was an unsupported visual wall. Only the
  // finite bearing cap above remains concrete; the actual underpass at−7.4 is clear.
  const parts = {} as Record<RailContextRole, T.BufferGeometry>;
  for (const role of roles) {
    // Normalize indexed box geometry to the same nonindexed layout as surfaces.
    const normalized = bins[role].map((g) => (g.index ? g.toNonIndexed() : g));
    parts[role] = mergeGeometries(normalized, false)!;
    if (role !== "ground") landmarkSurfaceUV(parts[role], [1, 1]);
    parts[role].computeBoundingBox();
    parts[role].computeBoundingSphere();
    for (const g of new Set([...bins[role], ...normalized])) g.dispose();
  }
  // Upward physical surfaces of the ballast, sleepers and rails share their
  // actual final buffers with contact; no invisible flat walking deck is added.
  const supports: RailGroundTriangle[] = [],
    supportBins = new Map<string, number[]>();
  const captureRoadContact = (geometry: T.BufferGeometry, localOnly = true) => {
    const p = geometry.getAttribute("position"),
      index = geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ps = [0, 1, 2].map((k) => {
        const id = index ? index.getX(i + k) : i + k;
        return [p.getX(id), p.getY(id), p.getZ(id)] as V;
      }) as [V, V, V];
      const cross = new T.Vector3(...ps[1])
        .sub(new T.Vector3(...ps[0]))
        .cross(new T.Vector3(...ps[2]).sub(new T.Vector3(...ps[0])));
      if (cross.y <= 1e-8) continue;
      if (
        localOnly &&
        sampleSurface(
          (ps[0][0] + ps[1][0] + ps[2][0]) / 3,
          (ps[0][2] + ps[1][2] + ps[2][2]) / 3,
        ) === undefined
      )
        continue;
      const b: [number, number, number, number] = [
          Math.min(...ps.map((p) => p[0])),
          Math.min(...ps.map((p) => p[2])),
          Math.max(...ps.map((p) => p[0])),
          Math.max(...ps.map((p) => p[2])),
        ],
        id = supports.length;
      supports.push({ points: ps, bounds: b });
      for (let x = Math.floor(b[0] / 16); x <= Math.floor(b[2] / 16); x++)
        for (let z = Math.floor(b[1] / 16); z <= Math.floor(b[3] / 16); z++) {
          const key = `${x},${z}`;
          if (!supportBins.has(key)) supportBins.set(key, []);
          supportBins.get(key)!.push(id);
        }
    }
  };
  for (const role of [
    "ballast",
    "steel",
    "timber",
    "concrete",
  ] as RailContextRole[])
    captureRoadContact(parts[role], false);
  const support = (
    x: number,
    z: number,
    referenceY: number,
  ): number | undefined => {
    if (!Number.isFinite(x + z + referenceY)) return undefined;
    let best = sampleSurface(x, z);
    for (const id of supportBins.get(
      `${Math.floor(x / 16)},${Math.floor(z / 16)}`,
    ) ?? []) {
      const {
        points: [a, b, c],
        bounds,
      } = supports[id];
      if (x < bounds[0] || x > bounds[2] || z < bounds[1] || z > bounds[3])
        continue;
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const y = a[1] * u + b[1] * v + c[1] * (1 - u - v);
      if (y <= referenceY + 0.6 && (best === undefined || y > best)) best = y;
    }
    return best;
  };
  const blocked = (
    x: number,
    z: number,
    r: number,
    referenceY: number,
    camera = false,
  ) => {
    if (!Number.isFinite(x + z + r + referenceY) || r < 0) return false;
    for (let i = 0; i < 9; i++) {
      const theta = (i * Math.PI) / 4,
        px = x + (i < 8 ? Math.cos(theta) * r : 0),
        pz = z + (i < 8 ? Math.sin(theta) * r : 0),
        y = sampleSurface(px, pz);
      if (y !== undefined && y > referenceY + (camera ? -r : 0.45)) return true;
    }
    return false;
  };
  return {
    support,
    blocked,
    parts,
    triangles,
    masks,
    sampleSurface,
    roadProfiles,
    inspectField: (x: number, z: number) => ({
      soil: soilAt(x, z),
      base: baseAt(x, z),
      shore: shore(x, z),
      location: locate(x, z),
      road: roadProfiles.at(x, z)?.plane(x, z),
    }),
    nearbyGround,
    captureRoadContact,
    point,
    halfWidth,
    stations,
    stats: {
      triangles: Object.values(parts).reduce(
        (n, g) => n + g.getAttribute("position").count / 3,
        0,
      ),
      batches: roles.length,
    },
  };
}
export type SecondNarrowsRailContext = NonNullable<
  ReturnType<typeof createSecondNarrowsRailContext>
>;
