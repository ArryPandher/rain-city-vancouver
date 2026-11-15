import type { Point } from "./data";
import { robsonMoundHeight } from "./robson-mound-site";
/** XY traces are literal decoded OSM paths. Intermediate stair datums are an
 * authored buildable interpretation, not recovered survey elevations. */
const at = (x: number, z: number, y?: number) => ({
  p: [x, z] as Point,
  y: y ?? robsonMoundHeight(x, z) ?? 0,
});
export const ROBSON_MOUND_CIRCULATION_NODES = [
  at(-129.451401, 49.87, 0),
  at(-122.951401, 59.37),
  at(-123.451401, 69.87, 3.5),
  at(-119.451401, 73.37, 3.85),
  at(-119.451401, 76.87, 4.2),
  at(-132.451401, 71.87),
  at(-142.451401, 88.37, 0),
  at(-123.451401, 84.87, 3.4),
  at(-128.951401, 87.37),
  at(-133.951401, 87.87, 0),
];
export const ROBSON_MOUND_CIRCULATION_EDGES = [
  { a: 0, b: 1, steps: true, trace: 35 },
  { a: 1, b: 2, steps: true, trace: 35 },
  { a: 2, b: 3, steps: true, trace: 35 },
  { a: 3, b: 4, steps: true, trace: 35 },
  { a: 2, b: 5, steps: true, trace: 33 },
  { a: 5, b: 6, steps: false, trace: 17 },
  { a: 4, b: 7, steps: false, trace: 16 },
  { a: 7, b: 8, steps: false, trace: 16 },
  { a: 8, b: 9, steps: true, trace: 37 },
];
