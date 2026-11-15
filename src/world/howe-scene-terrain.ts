import Delaunator from "delaunator";
import { Terrain } from "./terrain";
import { segmentPoint, type Point } from "./data";
import source from "./howe-ground-controls.json";
import { HOWE_STATION } from "./howe-station-site";

export const HOWE_FINISH_OFFSET = 0.15;
const bounds = { minX: 240, minZ: -640, maxX: 800, maxZ: -120 };
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
type Control = [number, number, number];

/** One bounded surface shared by road ribbons, support, buildings and actors.
 * Control interpolation and outer ties are authored, not a recovered terrain survey. */
export function createHoweSceneTerrain(options: {
  oldHeight: (x: number, z: number) => number;
  waterfrontPath: Point[];
  waterfrontHeight: (x: number, z: number) => number;
  protectedApproach?: Point[];
  protectedHeight?: (x: number, z: number) => number;
  protectedEdges?: {
    ring: Point[];
    height: (x: number, z: number) => number;
  }[];
}) {
  const { oldHeight, waterfrontPath, waterfrontHeight } = options;
  const controls: Control[] = source.controls.map(({ point }) => [
    point[0],
    point[1],
    point[2] - HOWE_FINISH_OFFSET,
  ]);
  // Photo-fit neighborhood pads: keep the authored focus buildings on the same
  // street datum. These are NOT City roof-base measurements.
  controls.push(
    [430.367, -472.925, 7.98],
    [518.049, -427.297, 7.98],
    [488.699, -401.38, 8.03],
  );
  // A broad, deterministic boundary closes to the pre-existing world. This
  // transition is outside the focal walking route and is intentionally approximate.
  for (let x = bounds.minX; x <= bounds.maxX; x += 20) {
    controls.push(
      [x, bounds.minZ, oldHeight(x, bounds.minZ)],
      [x, bounds.maxZ, oldHeight(x, bounds.maxZ)],
    );
  }
  for (let z = bounds.minZ + 20; z < bounds.maxZ; z += 20)
    controls.push(
      [bounds.minX, z, oldHeight(bounds.minX, z)],
      [bounds.maxX, z, oldHeight(bounds.maxX, z)],
    );
  for (const [x, z] of waterfrontPath)
    if (
      x > bounds.minX &&
      x < bounds.maxX &&
      z > bounds.minZ &&
      z < bounds.maxZ
    )
      controls.push([x, z, waterfrontHeight(x, z)]);
  const preserved = [
    {
      ring: options.protectedApproach ?? [],
      height: options.protectedHeight ?? oldHeight,
    },
    ...(options.protectedEdges ?? []),
  ];
  for (const { ring: protectedRing, height } of preserved)
    for (let i = 0; i < protectedRing.length; i++) {
      const a = protectedRing[i],
        b = protectedRing[(i + 1) % protectedRing.length];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
      for (let j = 0; j <= n; j++) {
        const x = a[0] + ((b[0] - a[0]) * j) / n,
          z = a[1] + ((b[1] - a[1]) * j) / n;
        if (
          x >= bounds.minX &&
          x <= bounds.maxX &&
          z >= bounds.minZ &&
          z <= bounds.maxZ
        )
          controls.push([x, z, height(x, z)]);
      }
    }
  const delaunay = Delaunator.from(controls);
  const triangles = Array.from(
    { length: delaunay.triangles.length / 3 },
    (_, i) => [0, 1, 2].map((j) => controls[delaunay.triangles[i * 3 + j]]),
  );
  const interpolate = (x: number, z: number) => {
    for (const [a, b, c] of triangles) {
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-8) continue;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d,
        v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7)
        return a[2] * u + b[2] * v + c[2] * (1 - u - v);
    }
    return oldHeight(x, z);
  };
  const sample = (x: number, z: number) => {
    let y = interpolate(x, z);
    // The whole pier-side cross-section must meet the unchanged deck. Blending
    // only at road vertices leaves a crease at the sidewalk and hotel corner.
    let distance = Infinity;
    for (let i = 1; i < waterfrontPath.length; i++)
      distance = Math.min(
        distance,
        segmentPoint(x, z, ...waterfrontPath[i - 1], ...waterfrontPath[i]).d,
      );
    const waterfront = 1 - smooth((distance - 12) / 18);
    y += (waterfrontHeight(x, z) - y) * waterfront;
    // Level enclosure and a short accessible approach; grade resumes outside
    // the pavilion. Aerial imagery does not supply these vertical values.
    const dx = x - HOWE_STATION.origin[0],
      dz = z - HOWE_STATION.origin[1],
      u = dx * HOWE_STATION.axis[0] + dz * HOWE_STATION.axis[1],
      v = dx * HOWE_STATION.right[0] + dz * HOWE_STATION.right[1],
      d = Math.hypot(
        Math.max(0, Math.abs(v) - HOWE_STATION.radius - 0.5),
        Math.max(0, -u - 1, u - HOWE_STATION.length - 1),
      );
    y +=
      (HOWE_STATION.landingHeight - HOWE_FINISH_OFFSET - y) *
      (1 - smooth(d / 5));
    // Preserve the separately built VCC approach at its actual cut boundary.
    // A flat normal band prevents coarse triangles from lifting its zero-height
    // shoulder; the neighboring shared ground joins over the next sixteen metres.
    let protectedDistance = Infinity,
      protectedY = 0;
    for (const { ring: protectedRing, height } of preserved)
      for (let i = 0; i < protectedRing.length; i++) {
        const a = protectedRing[i],
          b = protectedRing[(i + 1) % protectedRing.length];
        const q = segmentPoint(x, z, ...a, ...b);
        if (q.d < protectedDistance) {
          protectedDistance = q.d;
          protectedY = height(
            a[0] + (b[0] - a[0]) * q.t,
            a[1] + (b[1] - a[1]) * q.t,
          );
        }
      }
    y += (protectedY - y) * (1 - smooth((protectedDistance - 8) / 16));
    const edge = smooth(
      Math.min(
        x - bounds.minX,
        bounds.maxX - x,
        z - bounds.minZ,
        bounds.maxZ - z,
      ) / 20,
    );
    const boundaryY = oldHeight(x, z);
    return Math.max(0, boundaryY + (y - boundaryY) * edge);
  };
  const step = 4,
    columns = (bounds.maxX - bounds.minX) / step + 1,
    rows = (bounds.maxZ - bounds.minZ) / step + 1;
  const values = new Uint16Array(columns * rows);
  for (let z = 0; z < rows; z++)
    for (let x = 0; x < columns; x++)
      values[z * columns + x] = Math.round(
        sample(bounds.minX + x * step, bounds.minZ + z * step) * 1000,
      );
  const terrain = new Terrain(
    {
      version: 1,
      sourceYear: 2002,
      ...bounds,
      step,
      columns,
      rows,
      scale: 0.001,
      binary: "authored-howe-neighbourhood",
      lakes: [],
    },
    values,
  );
  // Aligned local refinements retain contact at tiny stair cuts and existing
  // approach corners without raising the resolution of the whole neighborhood.
  const addDetail = (
    parent: Terrain,
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    step: number,
    fade = 4,
  ) => {
    const columns = Math.round((maxX - minX) / step) + 1,
      rows = Math.round((maxZ - minZ) / step) + 1,
      values = new Uint16Array(columns * rows);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const x = minX + col * step,
          z = minZ + row * step;
        // Outer scene edges join the old analytic surface, not an approximation
        // interpolated along a four-metre boundary that can straddle a terrain kink.
        const left = minX === bounds.minX ? Infinity : x - minX,
          right = maxX === bounds.maxX ? Infinity : maxX - x,
          front = minZ === bounds.minZ ? Infinity : z - minZ,
          back = maxZ === bounds.maxZ ? Infinity : maxZ - z,
          weight = smooth(Math.min(left, right, front, back) / fade),
          y = parent.height(x, z) * (1 - weight) + sample(x, z) * weight;
        values[row * columns + col] = Math.round(y * 1000);
      }
    const detail = new Terrain(
      { ...parent.meta, minX, minZ, columns, rows, step },
      values,
    );
    parent.details.push(detail);
    return detail;
  };
  addDetail(terrain, 464, -440, 496, -408, 1);
  // Preserve the old western ground's sub-grid slope breaks at the patch edge.
  addDetail(
    terrain,
    bounds.minX,
    bounds.minZ,
    bounds.minX + 8,
    bounds.maxZ,
    0.5,
  );
  const approachDetail = addDetail(terrain, 272, -608, 384, -496, 1);
  for (const p of options.protectedApproach ?? []) {
    const x = Math.floor(p[0] / 4) * 4 - 8,
      z = Math.floor(p[1] / 4) * 4 - 8;
    addDetail(approachDetail, x, z, x + 24, z + 24, 0.25);
  }
  // The north approach shoulder changes slope before its corner; retain that
  // existing crease separately from the outer-corner refinements.
  addDetail(approachDetail, 344, -576, 356, -564, 0.25);
  return terrain;
}
