import * as T from "three";
import { pointInPoly, segmentPoint, type Point } from "./data";
import type { Batcher } from "./geometry";
import type { CoastalPlantSite } from "./prospect-bank";

/** Historical MCM photograph: low pale planted court edge. Placement, capsule
 * section and dimensions are inferred, not a surveyed/current planter record. */
export const FAIRMONT_ARRIVAL_ISLAND = {
  a: [486.1, -476.5] as Point,
  b: [487.4, -471.0] as Point,
  radius: 1.1,
  rimInset: 0.045,
  innerRadius: 0.89,
  height: 0.45,
  bevelBottom: 0.395,
  soilHeight: 0.33,
  pavementFinish: 0.15,
  baseOverlap: 0.015,
  straightSegments: 12,
  arcSegments: 12,
} as const;
type Vertex = [number, number, number];
type Triangle = [Vertex, Vertex, Vertex];
type Surface = { material: "stone" | "soil"; triangle: Triangle };

function triangleHeight(x: number, z: number, [a, b, c]: Triangle) {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-10) return undefined;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
  if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) return undefined;
  return u * a[1] + v * b[1] + (1 - u - v) * c[1];
}

/** Baseline excludes the paving finish and must not call island collision. */
export function createFairmontArrivalIsland(
  baseline: (x: number, z: number) => number,
) {
  const spec = FAIRMONT_ARRIVAL_ISLAND;
  const dx = spec.b[0] - spec.a[0],
    dz = spec.b[1] - spec.a[1];
  const length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const point = (u: number, v: number): Point => [
    spec.a[0] + ux * u - uz * v,
    spec.a[1] + uz * u + ux * v,
  ];
  const groundAt = (x: number, z: number) =>
    baseline(x, z) + spec.pavementFinish;
  const vertex = (p: Point, rise: number): Vertex => [
    p[0],
    groundAt(...p) + rise,
    p[1],
  ];
  const ring = (radius: number) => {
    const pts: Point[] = [];
    for (let i = 0; i <= spec.straightSegments; i++)
      pts.push(point((length * i) / spec.straightSegments, radius));
    for (let i = 1; i <= spec.arcSegments; i++) {
      const t = (Math.PI * i) / spec.arcSegments;
      pts.push(point(length + radius * Math.sin(t), radius * Math.cos(t)));
    }
    for (let i = 1; i <= spec.straightSegments; i++)
      pts.push(point(length * (1 - i / spec.straightSegments), -radius));
    for (let i = 1; i < spec.arcSegments; i++) {
      const t = (Math.PI * i) / spec.arcSegments;
      pts.push(point(-radius * Math.sin(t), -radius * Math.cos(t)));
    }
    return pts;
  };
  const footprint = ring(spec.radius),
    rim = ring(spec.radius - spec.rimInset),
    inner = ring(spec.innerRadius);
  const surfaces: Surface[] = [],
    topTriangles: Triangle[] = [],
    soilTriangles: Triangle[] = [];
  const add = (
    material: Surface["material"],
    triangle: Triangle,
    normal: Vertex,
    top = false,
  ) => {
    const n = new T.Vector3(...triangle[1])
      .sub(new T.Vector3(...triangle[0]))
      .cross(new T.Vector3(...triangle[2]).sub(new T.Vector3(...triangle[0])));
    if (n.lengthSq() < 1e-16) return;
    if (n.dot(new T.Vector3(...normal)) < 0)
      triangle = [triangle[0], triangle[2], triangle[1]];
    surfaces.push({ material, triangle });
    if (top) topTriangles.push(triangle);
    if (material === "soil") soilTriangles.push(triangle);
  };
  const quad = (
    material: Surface["material"],
    p: [Vertex, Vertex, Vertex, Vertex],
    normal: Vertex,
    top = false,
  ) => {
    add(material, [p[0], p[1], p[2]], normal, top);
    add(material, [p[0], p[2], p[3]], normal, top);
  };
  for (let i = 0; i < footprint.length; i++) {
    const j = (i + 1) % footprint.length,
      a = footprint[i],
      b = footprint[j];
    const outward: Vertex = [a[1] - b[1], 0, b[0] - a[0]];
    quad(
      "stone",
      [
        vertex(a, -spec.baseOverlap),
        vertex(b, -spec.baseOverlap),
        vertex(b, spec.bevelBottom),
        vertex(a, spec.bevelBottom),
      ],
      outward,
    );
    quad(
      "stone",
      [
        vertex(a, spec.bevelBottom),
        vertex(b, spec.bevelBottom),
        vertex(rim[j], spec.height),
        vertex(rim[i], spec.height),
      ],
      [0, 1, 0],
      true,
    );
    quad(
      "stone",
      [
        vertex(rim[i], spec.height),
        vertex(rim[j], spec.height),
        vertex(inner[j], spec.height),
        vertex(inner[i], spec.height),
      ],
      [0, 1, 0],
      true,
    );
    quad(
      "stone",
      [
        vertex(inner[i], spec.soilHeight),
        vertex(inner[j], spec.soilHeight),
        vertex(inner[j], spec.height),
        vertex(inner[i], spec.height),
      ],
      outward.map((v) => -v) as Vertex,
    );
  }
  // Crosswise strips retain the real grade along the court, rather than a
  // long fan whose interpolation would span the changing driveway gradient.
  const cap = (
    radius: number,
    rise: number,
    material: Surface["material"],
    up: boolean,
  ) => {
    const cuts = [0, length];
    for (let i = 1; i < spec.straightSegments; i++)
      cuts.push((length * i) / spec.straightSegments);
    for (let i = 1; i <= spec.arcSegments / 2; i++) {
      const u = radius * Math.sin((Math.PI * i) / spec.arcSegments);
      cuts.push(-u, length + u);
    }
    cuts.sort((a, b) => a - b);
    const width = (u: number) =>
      Math.sqrt(
        Math.max(
          0,
          radius * radius -
            (u < 0 ? u * u : u > length ? (u - length) ** 2 : 0),
        ),
      );
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i],
        wa = width(a),
        wb = width(b);
      quad(
        material,
        [
          vertex(point(a, -wa), rise),
          vertex(point(b, -wb), rise),
          vertex(point(b, wb), rise),
          vertex(point(a, wa), rise),
        ],
        [0, up ? 1 : -1, 0],
        up,
      );
    }
  };
  cap(spec.innerRadius, spec.soilHeight, "soil", true);
  cap(spec.radius, -spec.baseOverlap, "stone", false);
  const bounds = {
    minX: Math.min(...footprint.map((p) => p[0])),
    maxX: Math.max(...footprint.map((p) => p[0])),
    minZ: Math.min(...footprint.map((p) => p[1])),
    maxZ: Math.max(...footprint.map((p) => p[1])),
  };
  const withinBounds = (x: number, z: number, r = 0) =>
    x >= bounds.minX - r &&
    x <= bounds.maxX + r &&
    z >= bounds.minZ - r &&
    z <= bounds.maxZ + r;
  const contains = (x: number, z: number) =>
    withinBounds(x, z) && pointInPoly(x, z, footprint.flat());
  const heightAt = (triangles: Triangle[], x: number, z: number) => {
    for (const triangle of triangles) {
      const h = triangleHeight(x, z, triangle);
      if (h !== undefined) return h;
    }
    return undefined;
  };
  const topAt = (x: number, z: number) =>
    withinBounds(x, z, 0.0001) ? heightAt(topTriangles, x, z) : undefined;
  const solidTriangles = surfaces.map(
    (s) =>
      new T.Triangle(
        ...(s.triangle.map((p) => new T.Vector3(...p)) as [
          T.Vector3,
          T.Vector3,
          T.Vector3,
        ]),
      ),
  );
  const blocked = (
    x: number,
    z: number,
    r: number,
    referenceY: number,
    camera = false,
  ) => {
    if (!withinBounds(x, z, r)) return false;
    let nearest: Point = [x, z],
      distance = 0;
    if (!contains(x, z)) {
      distance = Infinity;
      for (let i = 0; i < footprint.length; i++) {
        const a = footprint[i],
          b = footprint[(i + 1) % footprint.length],
          hit = segmentPoint(x, z, ...a, ...b);
        if (hit.d < distance) {
          distance = hit.d;
          nearest = [
            a[0] + (b[0] - a[0]) * hit.t,
            a[1] + (b[1] - a[1]) * hit.t,
          ];
        }
      }
      if (distance > r) return false;
    }
    // Camera spheres can pass above this low solid. Player/vehicle queries
    // overlap its closed wall/soil body without turning it into an infinite wall.
    const top = topAt(...nearest) ?? groundAt(...nearest) + spec.bevelBottom;
    const y = Number.isFinite(referenceY) ? referenceY : groundAt(x, z);
    if (camera) {
      if (contains(x, z) && y <= top && y >= groundAt(x, z) - spec.baseOverlap)
        return true;
      const centre = new T.Vector3(x, y, z),
        closest = new T.Vector3();
      return solidTriangles.some(
        (triangle) =>
          triangle
            .closestPointToPoint(centre, closest)
            .distanceToSquared(centre) <
          r * r,
      );
    }
    return y < top + 0.001 && y + 1.8 > groundAt(...nearest) - spec.baseOverlap;
  };
  const plants: CoastalPlantSite[] = [0, 0.33, 0.67, 1].map((t, i) => {
    const p = point(length * t, i % 2 ? 0.09 : -0.09);
    return {
      x: p[0],
      y: heightAt(soilTriangles, ...p)!,
      z: p[1],
      height: [0.82, 0.86, 0.84, 0.8][i],
      angle: [0.3, 2.2, 4.1, 5.4][i],
      normal: [0, 1, 0],
    };
  });
  return {
    footprint,
    bounds,
    surfaces,
    topTriangles,
    soilTriangles,
    groundAt,
    topAt,
    contains,
    blocked,
    plants,
  };
}
export type FairmontArrivalIsland = ReturnType<
  typeof createFairmontArrivalIsland
>;

export function buildFairmontArrivalIsland(
  batch: Batcher,
  site: FairmontArrivalIsland,
  materials: { stone: T.Material; soil: T.Material },
) {
  for (const material of ["stone", "soil"] as const) {
    const faces = site.surfaces.filter((s) => s.material === material);
    const positions = faces.flatMap((s) => s.triangle.flat());
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    const uv: number[] = [];
    for (const {
      triangle: [a, b, c],
    } of faces) {
      const n = new T.Vector3(...b)
        .sub(new T.Vector3(...a))
        .cross(new T.Vector3(...c).sub(new T.Vector3(...a)))
        .normalize();
      for (const [x, y, z] of [a, b, c]) {
        if (Math.abs(n.y) > 0.5) uv.push(x / 2, z / 2);
        else if (Math.abs(n.x) > Math.abs(n.z)) uv.push(z / 2, y / 2);
        else uv.push(x / 2, y / 2);
      }
    }
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const prior = batch.offsetY;
    batch.offsetY = 0;
    batch.add(g, materials[material], 486.75, -473.75);
    batch.offsetY = prior;
  }
}
