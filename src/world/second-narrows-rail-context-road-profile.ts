import pc from "polygon-clipping";
import { ShapeUtils, Vector2 } from "three";
import { roadWidth, type Road, type Point } from "./data";
type V = [number, number, number];
export interface RailContextRoadPiece {
  id: string;
  polygon: Point[];
  bounds: [number, number, number, number];
  plane: (x: number, z: number) => number;
  asphalt: Point[];
}

/** Three exact source roads only. Their shared junctions and outside ties remain
 * at the existing yard datum; the inland crest is an explicit graded adaptation. */
export function createRailContextRoadProfiles(
  roads: Road[],
  base: (x: number, z: number) => number,
  shore: (x: number, z: number) => number,
) {
  const selected = roads.filter((r) =>
    ["w24007615", "w1265138308", "w1265138309"].includes(r.id ?? ""),
  );
  const occurrences = new Map<string, number>();
  for (const r of selected)
    for (let i = 0; i < r.pts.length; i += 2) {
      const key = `${r.pts[i]},${r.pts[i + 1]}`;
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }
  const junctions = [...occurrences]
    .filter(([, n]) => n > 1)
    .map(([k]) => k.split(",").map(Number) as Point);
  const pieces: RailContextRoadPiece[] = [],
    bins = new Map<string, number[]>();
  for (const road of selected) {
    const p: Point[] = [],
      dist = [0],
      raw = road.pts,
      flat = roadWidth(road) / 2 + 2.5;
    for (let i = 2; i < raw.length; i += 2) {
      const a: [number, number] = [raw[i - 2], raw[i - 1]],
        b: [number, number] = [raw[i], raw[i + 1]],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      for (let j = 0; j < n; j++)
        p.push([
          a[0] + ((b[0] - a[0]) * j) / n,
          a[1] + ((b[1] - a[1]) * j) / n,
        ]);
    }
    p.push([raw.at(-2)!, raw.at(-1)!]);
    for (let i = 1; i < p.length; i++)
      dist.push(
        dist[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]),
      );
    const heights = p.map(([x, z]) =>
      junctions.some((q) => Math.hypot(x - q[0], z - q[1]) < 12)
        ? 0
        : Math.max(
            0,
            Math.min(base(x, z), Math.max(0, shore(x, z) - flat) * 0.6),
          ),
    );
    // Only lower peaks: no uphill step, invented terminal grade or sudden ramp.
    for (let i = 1; i < p.length; i++)
      heights[i] = Math.min(
        heights[i],
        heights[i - 1] + 0.08 * (dist[i] - dist[i - 1]),
      );
    for (let i = p.length - 2; i >= 0; i--)
      heights[i] = Math.min(
        heights[i],
        heights[i + 1] + 0.08 * (dist[i + 1] - dist[i]),
      );
    const normal = (i: number): Point => {
      const a = p[Math.max(0, i - 1)],
        b = p[Math.min(p.length - 1, i + 1)],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
    };
    const at = (i: number, u: number): Point => {
      const n = normal(i);
      return [p[i][0] + n[0] * u, p[i][1] + n[1] * u];
    };
    for (let i = 1; i < p.length; i++) {
      const polygonQuad = [
        at(i - 1, -flat),
        at(i - 1, flat),
        at(i, flat),
        at(i, -flat),
      ];
      const asphaltQuad = [
        at(i - 1, -roadWidth(road) / 2),
        at(i - 1, roadWidth(road) / 2),
        at(i, roadWidth(road) / 2),
        at(i, -roadWidth(road) / 2),
      ];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const polygon = ids.map((k) => polygonQuad[k]),
          asphalt = asphaltQuad;
        const bounds: [number, number, number, number] = [
          Math.min(...polygon.map((p) => p[0])),
          Math.min(...polygon.map((p) => p[1])),
          Math.max(...polygon.map((p) => p[0])),
          Math.max(...polygon.map((p) => p[1])),
        ];
        const [a, b, c] = polygon;
        const hh = ids.map((k) => (k < 2 ? heights[i - 1] : heights[i]));
        const denominator =
          (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        const piece = {
          id: road.id!,
          polygon,
          asphalt,
          bounds,
          plane: (x: number, z: number) => {
            const u =
              ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) /
              denominator;
            const v =
              ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) /
              denominator;
            return hh[0] * u + hh[1] * v + hh[2] * (1 - u - v);
          },
        };
        const id = pieces.length;
        pieces.push(piece);
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
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key)!.push(id);
          }
      }
    }
  }
  const nearby = (bounds: [number, number, number, number]) => {
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
        for (const id of bins.get(`${x},${z}`) ?? []) ids.add(id);
    return [...ids].map((id) => pieces[id]);
  };
  const contains = (polygon: Point[], x: number, z: number, tolerance = 0) => {
    const sign = Math.sign(
      polygon.reduce(
        (sum, p, i) =>
          sum +
          p[0] * polygon[(i + 1) % polygon.length][1] -
          polygon[(i + 1) % polygon.length][0] * p[1],
        0,
      ),
    );
    return polygon.every((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      return (
        sign * ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) >=
        -1e-8 - tolerance * Math.hypot(b[0] - a[0], b[1] - a[1])
      );
    });
  };
  const at = (x: number, z: number, asphalt = false, tolerance = 0) =>
    nearby([x, z, x, z]).find(
      (p) =>
        contains(p.polygon, x, z, tolerance) &&
        (!asphalt || contains(p.asphalt, x, z)),
    );
  // Constrain each road boundary in the bank triangulation. A clipped boundary
  // vertex takes the actual road plane, so both sides have exactly one height.
  const partition = (
    triangle: [V, V, V],
    height: (x: number, z: number) => number,
  ): [V, V, V][] => {
    const bounds: [number, number, number, number] = [
      Math.min(...triangle.map((p) => p[0])),
      Math.min(...triangle.map((p) => p[2])),
      Math.max(...triangle.map((p) => p[0])),
      Math.max(...triangle.map((p) => p[2])),
    ];
    const ring = triangle.map((p) => [p[0], p[2]] as Point),
      clipped: pc.MultiPolygon[] = [],
      local: Point[][] = [];
    const result: [V, V, V][] = [];
    const emit = (polygons: pc.MultiPolygon) => {
      for (const p of polygons) {
        const outer = p[0].slice(0, -1),
          holes = p.slice(1).map((r) => r.slice(0, -1)),
          points = [...outer, ...holes.flat()];
        for (const ids of ShapeUtils.triangulateShape(
          outer.map((p) => new Vector2(...p)),
          holes.map((r) => r.map((p) => new Vector2(...p))),
        ))
          result.push(
            ids.map((i) => [
              points[i][0],
              height(...points[i]),
              points[i][1],
            ]) as [V, V, V],
          );
      }
    };
    for (const road of nearby(bounds)) {
      if (
        road.bounds[0] > bounds[2] ||
        road.bounds[2] < bounds[0] ||
        road.bounds[1] > bounds[3] ||
        road.bounds[3] < bounds[1]
      )
        continue;
      const cut = pc.intersection([ring], [road.polygon]);
      if (cut.length) {
        clipped.push(cut);
        local.push(road.polygon);
        emit(cut);
      }
    }
    if (!clipped.length) return [triangle];
    emit(
      pc.difference(
        [ring],
        pc.union([local[0]], ...local.slice(1).map((p) => [p])),
      ),
    );
    return result;
  };
  return { pieces, nearby, at, partition };
}
