import { Terrain } from "./terrain";
import { pointInPoly, roadWidth, segmentPoint, type CityData } from "./data";
import type { CollisionWorld } from "./collision";
import { PROSPECT_FORECOURT } from "./prospect-site";

export const PROSPECT_DETAIL = {
  minX: -1712,
  minZ: -3440,
  maxX: -1456,
  maxZ: -3256,
  step: 1,
};
export function smoothRange(value: number, low: number, high: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
export function coastalSlope(terrain: Terrain, x: number, z: number) {
  const dx = (terrain.baseHeight(x + 1, z) - terrain.baseHeight(x - 1, z)) / 2,
    dz = (terrain.baseHeight(x, z + 1) - terrain.baseHeight(x, z - 1)) / 2;
  return Math.hypot(dx, dz);
}
/** Reference-guided distribution, not a surveyed species/rock-exposure map. */
export function coastalGrowth(x: number, y: number, z: number, slope: number) {
  const patch =
      Math.sin(x * 0.083 + Math.sin(z * 0.047) * 1.4) +
      Math.cos(z * 0.072 + y * 0.07),
    soil = smoothRange(patch, -1.65, -0.65),
    pocket = smoothRange(patch, 0.45, 1.55),
    exposed = smoothRange(slope, 0.75, 1.8) * smoothRange(y, 5, 12);
  return soil * (1 - exposed) + pocket * exposed;
}
/** One-metre relief preserves the City contour surface outside this local patch.
 * Protected route strips retain the source height; centimetre quantization matches
 * the source grid. This is interpreted erosion detail, not new elevation survey data.
 */
export function addProspectGeology(data: CityData, collision: CollisionWorld) {
  const terrain = data.terrain,
    b = PROSPECT_DETAIL;
  if (!terrain || terrain.details.length) return;
  if (!terrain.contains(b.minX, b.minZ) || !terrain.contains(b.maxX, b.maxZ))
    return;
  const columns = (b.maxX - b.minX) / b.step + 1,
    rows = (b.maxZ - b.minZ) / b.step + 1,
    values = new Uint16Array(columns * rows);
  for (let iz = 0; iz < rows; iz++)
    for (let ix = 0; ix < columns; ix++) {
      const x = b.minX + ix * b.step,
        z = b.minZ + iz * b.step,
        source = terrain.baseHeight(x, z),
        slope = coastalSlope(terrain, x, z),
        boundary = Math.min(x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z);
      let route = Infinity;
      for (const road of collision.roads.query(x, z, 32))
        for (let j = 0; j < road.pts.length - 2; j += 2)
          route = Math.min(
            route,
            segmentPoint(
              x,
              z,
              road.pts[j],
              road.pts[j + 1],
              road.pts[j + 2],
              road.pts[j + 3],
            ).d -
              roadWidth(road) / 2,
          );
      let amount =
        smoothRange(boundary, 4, 12) *
        smoothRange(route, 4, 9) *
        smoothRange(source, 4, 10) *
        smoothRange(slope, 0.45, 1.4);
      if (
        pointInPoly(x, z, PROSPECT_FORECOURT) ||
        collision.water(x, z, source) ||
        collision.blocked(x, z, 2, source)
      )
        amount = 0;
      // Uneven vertical ribs and cross-fractures are visible in Prospect basalt.
      // Keep relief small relative to the original 30–60 m cliff.
      const rib = Math.sin(x * 1.13 + z * 0.69 + Math.sin(z * 0.19) * 0.6),
        cross = Math.sin(source * 1.25 + Math.sin(x * 0.38 + z * 0.29) * 1.3),
        broad = Math.sin(x * 0.29 - z * 0.21) * Math.sin(z * 0.31 + x * 0.12),
        relief = rib * 0.6 + cross * 0.35 + broad * 0.5;
      values[iz * columns + ix] = Math.round(
        Math.max(0, source + relief * amount) / terrain.meta.scale,
      );
    }
  terrain.details.push(
    new Terrain(
      {
        ...terrain.meta,
        minX: b.minX,
        minZ: b.minZ,
        step: b.step,
        columns,
        rows,
        binary: "",
        lakes: [],
      },
      values,
    ),
  );
}
