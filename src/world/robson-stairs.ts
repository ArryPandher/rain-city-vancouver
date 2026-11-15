import * as T from "three";
import { gridXZ, ROBSON_LOWER_STAIR } from "./robson-site";
/** Treads, exposed risers and tiny triangular cheek faces sit above the old
 * continuous grade; no buried stacked boxes or additional draw calls. */
export function robsonLowerStairGeometry() {
  const s = ROBSON_LOWER_STAIR,
    positions: number[] = [],
    uv: number[] = [];
  const point = (u: number, y: number, v: number) => {
    const [x, z] = gridXZ(u, v);
    return [x, y, z];
  };
  const tri = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c);
    for (const p of [a, b, c])
      uv.push((p[0] - p[2]) / Math.SQRT2 / 4, (p[0] + p[2]) / Math.SQRT2 / 4);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  for (let i = 0; i < s.steps; i++) {
    const a = s.startU + ((s.endU - s.startU) * i) / s.steps,
      b = s.startU + ((s.endU - s.startU) * (i + 1)) / s.steps;
    const top = s.high - ((s.high - s.low) * i) / s.steps,
      bottom = s.high - ((s.high - s.low) * (i + 1)) / s.steps;
    quad(
      point(a, top, s.minV),
      point(a, top, s.maxV),
      point(b, top, s.maxV),
      point(b, top, s.minV),
    );
    quad(
      point(b, top, s.minV),
      point(b, top, s.maxV),
      point(b, bottom, s.maxV),
      point(b, bottom, s.minV),
    );
    tri(point(a, top, s.minV), point(b, top, s.minV), point(b, bottom, s.minV));
    tri(point(a, top, s.maxV), point(b, bottom, s.maxV), point(b, top, s.maxV));
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
