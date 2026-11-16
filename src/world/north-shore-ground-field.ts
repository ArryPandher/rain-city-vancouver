import * as T from "three";
import { geo } from "./data";
import data from "./north-shore-ground-data.json";
import { northShoreImageryUv } from "./north-shore-imagery";

/** Source study only: no automatic scene attachment, water cut or support override. */
export const NORTH_SHORE_GROUND = data;
const parent = data.parentGrid;
const [gridX, gridZ] = geo(parent.bounds.north, parent.bounds.west);
const [endX, endZ] = geo(parent.bounds.south, parent.bounds.east);
const dx = (endX - gridX) / (parent.width - 1);
const dz = (endZ - gridZ) / (parent.height - 1);
const origin: [number, number] = [
  gridX + ((data.cells.minCol + data.cells.maxCol) * dx) / 2,
  gridZ + ((data.cells.minRow + data.cells.maxRow) * dz) / 2,
];
// One shared local origin ensures repeated chunk vertices have identical floats.
const xs = Float32Array.from(
  { length: data.width },
  (_, c) => gridX + (data.cells.minCol + c) * dx - origin[0],
);
const zs = Float32Array.from(
  { length: data.height },
  (_, r) => gridZ + (data.cells.minRow + r) * dz - origin[1],
);
export const NORTH_SHORE_GROUND_BOUNDS = Object.freeze({
  minX: xs[0] + origin[0],
  maxX: xs.at(-1)! + origin[0],
  minZ: zs[0] + origin[1],
  maxZ: zs.at(-1)! + origin[1],
});
const haloWidth = data.width + data.halo * 2;
function height(col: number, row: number) {
  return (
    data.elevations[(row + data.halo) * haloWidth + col + data.halo] *
    data.metresPerUnit
  );
}
const normals = new Float32Array(data.width * data.height * 3);
const colors = new Float32Array(normals.length);
const vegetation = new T.Color(0x435746),
  rock = new T.Color(0x777a73);
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
for (let row = 0; row < data.height; row++)
  for (let col = 0; col < data.width; col++) {
    // The retained one-cell source halo avoids independent one-sided seam normals.
    const normal = new T.Vector3(
      -(height(col + 1, row) - height(col - 1, row)) / (2 * dx),
      1,
      -(height(col, row + 1) - height(col, row - 1)) / (2 * dz),
    ).normalize();
    const i = (row * data.width + col) * 3;
    normals.set(normal.toArray(), i);
    const bare = Math.max(
      smooth((1 - normal.y - 0.12) / 0.33),
      smooth((height(col, row) - 1050) / 500) * 0.7,
    );
    colors.set(vegetation.clone().lerp(rock, bare).toArray(), i);
  }
function cell(axis: Float32Array, value: number) {
  let lo = 0,
    hi = axis.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (value < axis[mid]) hi = mid;
    else lo = mid;
  }
  return Math.min(lo, axis.length - 2);
}
function location(x: number, z: number) {
  const b = NORTH_SHORE_GROUND_BOUNDS;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    x < b.minX ||
    x > b.maxX ||
    z < b.minZ ||
    z > b.maxZ
  )
    return null;
  const lx = x - origin[0],
    lz = z - origin[1];
  const col = cell(xs, lx),
    row = cell(zs, lz);
  return {
    col,
    row,
    u: (lx - xs[col]) / (xs[col + 1] - xs[col]),
    v: (lz - zs[row]) / (zs[row + 1] - zs[row]),
  };
}
/** Actual emitted triangle height, not bilinear approximation. Null leaves outside support untouched. */
export function sampleNorthShoreGroundSurface(
  x: number,
  z: number,
): number | null {
  const p = location(x, z);
  if (!p) return null;
  const { col, row, u, v } = p;
  const a = height(col, row),
    b = height(col + 1, row),
    c = height(col, row + 1),
    d = height(col + 1, row + 1);
  return u + v <= 1
    ? a + (b - a) * u + (c - a) * v
    : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
/** Bilinear retained grid inspection only. Never substitute this for mesh/support contact. */
export function sampleNorthShoreGroundSource(
  x: number,
  z: number,
): number | null {
  const p = location(x, z);
  if (!p) return null;
  const { col, row, u, v } = p;
  return (
    (height(col, row) * (1 - u) + height(col + 1, row) * u) * (1 - v) +
    (height(col, row + 1) * (1 - u) + height(col + 1, row + 1) * u) * v
  );
}
/** Reuses DEM color/UV semantics. Caller must replace overlaps and resolve every open perimeter first. */
export function createNorthShoreGroundGeometry() {
  const chunks: {
    geometry: T.BufferGeometry;
    origin: [number, number];
    cells: [number, number, number, number];
  }[] = [];
  for (let row = 0; row < data.height - 1; row += 32)
    for (let col = 0; col < data.width - 1; col += 32) {
      const ec = Math.min(col + 32, data.width - 1),
        er = Math.min(row + 32, data.height - 1),
        width = ec - col + 1;
      const positions: number[] = [],
        ns: number[] = [],
        cs: number[] = [],
        uvs: number[] = [],
        indices: number[] = [];
      for (let r = row; r <= er; r++)
        for (let c = col; c <= ec; c++) {
          const i = (r * data.width + c) * 3;
          positions.push(xs[c], height(c, r), zs[r]);
          ns.push(...normals.subarray(i, i + 3));
          cs.push(...colors.subarray(i, i + 3));
          uvs.push(
            ...northShoreImageryUv(xs[c] + origin[0], zs[r] + origin[1]),
          );
          if (r < er && c < ec) {
            const a = (r - row) * width + c - col;
            indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1);
          }
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("normal", new T.Float32BufferAttribute(ns, 3));
      geometry.setAttribute("color", new T.Float32BufferAttribute(cs, 3));
      geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.userData.diagnosticGroundOnly = true;
      chunks.push({
        geometry,
        origin: [...origin],
        cells: [
          col + data.cells.minCol,
          row + data.cells.minRow,
          ec + data.cells.minCol,
          er + data.cells.minRow,
        ],
      });
    }
  return chunks;
}
