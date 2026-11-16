import * as T from "three";
import clipping from "polygon-clipping";
import type { CityData, Point, Road } from "./data";
import type { CanadaPlaceSite } from "./canada-place-site";
import { CANADA_PLACE_WALK_OFFSET } from "./canada-place-site";
import { canadaPlaceApproachMasks } from "./canada-place-approach";
import { HOWE_STATION_OBSERVED_PAVING } from "./howe-station-paving";

/** The mapped +.15m footway duplicates the approach finish here. Its different
 * tessellation crosses that finish by millimetres. Remove only their shared
 * footprint; the original support holes and observed field bound the cut. */
export function createHoweStationRoadFinishClipper(
  data: Pick<CityData, "roads">,
  site: CanadaPlaceSite,
) {
  const mask = clipping.intersection(
    canadaPlaceApproachMasks(data, site).sidewalks,
    [HOWE_STATION_OBSERVED_PAVING],
  );
  const points = mask.flat(2);
  const bounds = new T.Box2().setFromPoints(
    points.map(([x, z]) => new T.Vector2(x, z)),
  );
  return (geometry: T.BufferGeometry, road: Pick<Road, "kind" | "walkway">) => {
    // Lower paths and actual steps are independent layers, not this finish.
    if (!road.walkway || !["footway", "path", "pedestrian"].includes(road.kind))
      return geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    if (
      !mask.length ||
      box.max.x < bounds.min.x ||
      box.min.x > bounds.max.x ||
      box.max.z < bounds.min.y ||
      box.min.z > bounds.max.y
    )
      return geometry;
    const attributes = Object.entries(geometry.attributes);
    const output: Record<string, number[]> = Object.fromEntries(
      attributes.map(([name]) => [name, []]),
    );
    const position = geometry.getAttribute("position"),
      index = geometry.index;
    const copy = (ids: number[]) => {
      for (const id of ids)
        for (const [name, attribute] of attributes)
          for (let c = 0; c < attribute.itemSize; c++)
            output[name].push(attribute.getComponent(id, c));
    };
    let changed = false;
    for (let at = 0; at < (index?.count ?? position.count); at += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(at + k) : at + k));
      const triangle = ids.map(
        (i): Point => [position.getX(i), position.getZ(i)],
      );
      // Only triangles authored on the same finish datum qualify. This also
      // protects any future raised/lowered footway crossing the same XY mask.
      if (
        triangle.every(([x]) => x < bounds.min.x) ||
        triangle.every(([x]) => x > bounds.max.x) ||
        triangle.every(([, z]) => z < bounds.min.y) ||
        triangle.every(([, z]) => z > bounds.max.y) ||
        ids.some(
          (id) =>
            Math.abs(
              position.getY(id) -
                site.supportHeight(position.getX(id), position.getZ(id)) -
                CANADA_PLACE_WALK_OFFSET,
            ) > 0.001,
        ) ||
        !clipping.intersection([triangle], mask).length
      ) {
        copy(ids);
        continue;
      }
      const [a, b, c] = triangle;
      const denominator =
        (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-10) {
        copy(ids);
        continue;
      }
      changed = true;
      for (const polygon of clipping.difference([triangle], mask)) {
        const rings = polygon.map((ring) => ring.slice(0, -1));
        const vertices = rings.flat();
        const faces = T.ShapeUtils.triangulateShape(
          rings[0].map((p) => new T.Vector2(...p)),
          rings.slice(1).map((ring) => ring.map((p) => new T.Vector2(...p))),
        );
        for (const face of faces) {
          const corners = face.map((i) => vertices[i].map(Math.fround));
          const area =
            (corners[1][0] - corners[0][0]) * (corners[2][1] - corners[0][1]) -
            (corners[2][0] - corners[0][0]) * (corners[1][1] - corners[0][1]);
          if (Math.abs(area) < 1e-10) continue;
          if (area > 0) corners.reverse();
          for (const [x, z] of corners) {
            const wa =
              ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) /
              denominator;
            const wb =
              ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) /
              denominator;
            const weights = [wa, wb, 1 - wa - wb];
            for (const [name, attribute] of attributes) {
              const values = Array.from(
                { length: attribute.itemSize },
                (_, channel) =>
                  ids.reduce(
                    (sum, id, i) =>
                      sum + weights[i] * attribute.getComponent(id, channel),
                    0,
                  ),
              );
              if (name === "position") {
                values[0] = x;
                values[2] = z;
              }
              if (name === "normal") {
                const length = Math.hypot(...values);
                values.forEach((value, i) => {
                  values[i] = value / length;
                });
              }
              output[name].push(...values);
            }
          }
        }
      }
    }
    if (!changed) return geometry;
    const result = new T.BufferGeometry();
    for (const [name, attribute] of attributes)
      result.setAttribute(
        name,
        new T.Float32BufferAttribute(output[name], attribute.itemSize),
      );
    result.computeBoundingBox();
    result.computeBoundingSphere();
    geometry.dispose();
    return result;
  };
}
