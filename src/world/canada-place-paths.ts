import * as T from "three";
import clipping from "polygon-clipping";
import { CANADA_PLACE_PIER } from "./canada-place-deck";
import { flatPolygon } from "./geometry";
import type { Point } from "./data";
const pier: Point[] = Array.from(
  { length: CANADA_PLACE_PIER.length / 2 },
  (_, i) => [CANADA_PLACE_PIER[i * 2], CANADA_PLACE_PIER[i * 2 + 1]],
);
const bounds = [
  Math.min(...pier.map((p) => p[0])),
  Math.max(...pier.map((p) => p[0])),
  Math.min(...pier.map((p) => p[1])),
  Math.max(...pier.map((p) => p[1])),
];
/** Cut generic pedestrian ribbons at the actual source pier outline. Preserve
 * UV interpolation and re-sample outside terrain, including newly cut vertices. */
export function clipCanadaPlacePaths(
  geometry: T.BufferGeometry,
  height: (x: number, z: number) => number,
  offset: number,
) {
  const p = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv"),
    ix = geometry.getIndex();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  if (
    box.max.x < bounds[0] ||
    box.min.x > bounds[1] ||
    box.max.z < bounds[2] ||
    box.min.z > bounds[3]
  )
    return geometry;
  const position: number[] = [],
    tex: number[] = [];
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((k) => (ix ? ix.getX(i + k) : i + k)),
      triangle = ids.map((k) => [p.getX(k), p.getZ(k)] as Point);
    const [a, b, c] = triangle,
      den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-9) continue;
    const pieces = clipping.difference([triangle], [pier]);
    for (const poly of pieces) {
      const g = flatPolygon(
          poly[0].slice(0, -1).flat(),
          poly.slice(1).map((h) => h.slice(0, -1).flat()),
        ),
        gp = g.getAttribute("position"),
        gi = g.getIndex()!;
      for (let j = 0; j < gi.count; j++) {
        const k = gi.getX(j),
          x = gp.getX(k),
          z = gp.getZ(k);
        const wa =
            ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den,
          wb = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den,
          wc = 1 - wa - wb;
        position.push(x, height(x, z) + offset, z);
        tex.push(
          uv
            ? wa * uv.getX(ids[0]) + wb * uv.getX(ids[1]) + wc * uv.getX(ids[2])
            : 0,
          uv
            ? wa * uv.getY(ids[0]) + wb * uv.getY(ids[1]) + wc * uv.getY(ids[2])
            : 0,
        );
      }
      g.dispose();
    }
  }
  const result = new T.BufferGeometry();
  result.setAttribute("position", new T.Float32BufferAttribute(position, 3));
  result.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
  result.computeVertexNormals();
  geometry.dispose();
  return result;
}
