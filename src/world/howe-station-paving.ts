import * as T from "three";
import clipping from "polygon-clipping";
import type { Point } from "./data";

/** City 2022 orthophoto visiblePavingLimit, not the larger inferred support
 * closure. Rear edges are occlusion limits; they must not acquire a border. */
export const HOWE_STATION_OBSERVED_PAVING: Point[] = [
  [478.35201, -432.65403],
  [506.00389, -461.95297],
  [511.6511, -457.11817],
  [495.09892, -438.35911],
  [492.66478, -431.97715],
  [485.84918, -429.36635],
  [482.83084, -429.36635],
];

export type StationPavingRegistration = {
  origin: Point;
  uAxis: Point;
  vAxis: Point;
};
type Polygon = Point[][];
type Multi = Polygon[];
type Output = Record<string, number[]>;
const open = (ring: Point[]) =>
  ring.length > 1 &&
  ring[0][0] === ring.at(-1)![0] &&
  ring[0][1] === ring.at(-1)![1]
    ? ring.slice(0, -1)
    : ring;

/** Metres in the source grid's plane, continuous across every clipped piece. */
export function stationPavingUV(
  x: number,
  z: number,
  registration: StationPavingRegistration,
): Point {
  const dx = x - registration.origin[0],
    dz = z - registration.origin[1];
  return [
    dx * registration.uAxis[0] + dz * registration.uAxis[1],
    dx * registration.vAxis[0] + dz * registration.vAxis[1],
  ];
}

/** Replace, never overlay, only the existing finished walking triangles inside
 * the observed paving trace. Buried structural triangles and everything beyond
 * that trace retain their original attributes. New heights/normals interpolate
 * the original triangle, not a resampled/flattened terrain surface.
 *
 * The caller owns and disposes the input after replacing it with both outputs.
 * finishedHeight must include the existing walking finish exactly once. */
export function splitHoweStationPaving(
  pavement: T.BufferGeometry,
  finishedHeight: (x: number, z: number) => number,
  registration: StationPavingRegistration,
) {
  for (const axis of [registration.uAxis, registration.vAxis])
    if (Math.abs(Math.hypot(...axis) - 1) > 1e-6)
      throw new Error("Paving UV axes must be unit vectors");
  if (
    Math.abs(
      registration.uAxis[0] * registration.vAxis[0] +
        registration.uAxis[1] * registration.vAxis[1],
    ) > 1e-6
  )
    throw new Error("Paving UV axes must be orthogonal");
  const attributes = Object.entries(pavement.attributes);
  const position = pavement.getAttribute("position");
  if (
    !position ||
    !pavement.getAttribute("uv") ||
    !pavement.getAttribute("normal")
  )
    throw new Error(
      "Paving requires position, normal and existing metric UV attributes",
    );
  const remainder: Output = {},
    field: Output = {};
  for (const [name] of attributes) {
    remainder[name] = [];
    field[name] = [];
  }
  const trace = [HOWE_STATION_OBSERVED_PAVING];
  const bounds = {
    minX: Math.min(...HOWE_STATION_OBSERVED_PAVING.map((p) => p[0])),
    maxX: Math.max(...HOWE_STATION_OBSERVED_PAVING.map((p) => p[0])),
    minZ: Math.min(...HOWE_STATION_OBSERVED_PAVING.map((p) => p[1])),
    maxZ: Math.max(...HOWE_STATION_OBSERVED_PAVING.map((p) => p[1])),
  };
  const copy = (output: Output, ids: number[]) => {
    for (const id of ids)
      for (const [name, attribute] of attributes)
        for (let c = 0; c < attribute.itemSize; c++)
          output[name].push(attribute.getComponent(id, c));
  };
  let splitTriangles = 0,
    patternedArea = 0;
  const index = pavement.index;
  const count = index?.count ?? position.count;
  for (let at = 0; at < count; at += 3) {
    const ids = [0, 1, 2].map((k) => (index ? index.getX(at + k) : at + k));
    const triangle = ids.map(
      (i): Point => [position.getX(i), position.getZ(i)],
    );
    if (
      triangle.every((p) => p[0] < bounds.minX) ||
      triangle.every((p) => p[0] > bounds.maxX) ||
      triangle.every((p) => p[1] < bounds.minZ) ||
      triangle.every((p) => p[1] > bounds.maxZ) ||
      ids.some(
        (i) =>
          Math.abs(
            position.getY(i) -
              finishedHeight(position.getX(i), position.getZ(i)),
          ) > 0.0005,
      )
    ) {
      copy(remainder, ids);
      continue;
    }
    const inside = clipping.intersection([triangle], trace) as Multi;
    if (!inside.length) {
      copy(remainder, ids);
      continue;
    }
    const outside = clipping.difference([triangle], trace) as Multi;
    const [a, b, c] = triangle;
    const denominator =
      (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-12) {
      copy(remainder, ids);
      continue;
    }
    splitTriangles++;
    const emit = (polygons: Multi, output: Output, patterned: boolean) => {
      for (const polygon of polygons) {
        const rings = polygon.map((ring) => open(ring));
        const points = rings.flat();
        const faces = T.ShapeUtils.triangulateShape(
          rings[0].map((p) => new T.Vector2(...p)),
          rings.slice(1).map((ring) => ring.map((p) => new T.Vector2(...p))),
        );
        for (const face of faces) {
          const vertices = face.map(
            (i): Point => [
              Math.fround(points[i][0]),
              Math.fround(points[i][1]),
            ],
          );
          const area =
            (vertices[1][0] - vertices[0][0]) *
              (vertices[2][1] - vertices[0][1]) -
            (vertices[1][1] - vertices[0][1]) *
              (vertices[2][0] - vertices[0][0]);
          // Float32 storage can collapse submillimetre clipping slivers. Those
          // carry no usable surface; never emit invalid/near-vertical normals.
          if (Math.abs(area) < 1e-10) continue;
          if (area > 0) vertices.reverse();
          if (patterned) patternedArea += Math.abs(area) / 2;
          for (const [x, z] of vertices) {
            const wa =
              ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) /
              denominator;
            const wb =
              ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) /
              denominator;
            const weights = [wa, wb, 1 - wa - wb];
            for (const [name, attribute] of attributes) {
              if (name === "position") {
                output[name].push(
                  x,
                  ids.reduce(
                    (sum, id, i) => sum + weights[i] * position.getY(id),
                    0,
                  ),
                  z,
                );
              } else if (name === "uv" && patterned) {
                output[name].push(...stationPavingUV(x, z, registration));
              } else {
                const value = Array.from(
                  { length: attribute.itemSize },
                  (_, channel) =>
                    ids.reduce(
                      (sum, id, i) =>
                        sum + weights[i] * attribute.getComponent(id, channel),
                      0,
                    ),
                );
                if (name === "normal") {
                  const length = Math.hypot(...value);
                  value.forEach((v, i) => {
                    value[i] = v / length;
                  });
                }
                output[name].push(...value);
              }
            }
          }
        }
      }
    };
    emit(outside, remainder, false);
    emit(inside, field, true);
  }
  const geometry = (output: Output) => {
    const result = new T.BufferGeometry();
    for (const [name, attribute] of attributes)
      result.setAttribute(
        name,
        new T.Float32BufferAttribute(output[name], attribute.itemSize),
      );
    result.computeBoundingBox();
    result.computeBoundingSphere();
    return result;
  };
  const rest = geometry(remainder),
    patterned = geometry(field);
  return {
    remainder: rest,
    field: patterned,
    metrics: {
      inputTriangles: count / 3,
      remainderTriangles: rest.getAttribute("position").count / 3,
      fieldTriangles: patterned.getAttribute("position").count / 3,
      splitTriangles,
      patternedArea,
    },
  };
}
