import { canadaPlacePavingHeight } from "./canada-place-approach";
import type { CanadaPlaceSite } from "./canada-place-site";
import { isStreet, roadWidth, type CityData, type Road } from "./data";
import { ribbon, subdividePath } from "./geometry";

/** Contact with the actual rendered road ribbons, indexed once in metre cells.
 * Paving uses the shared clipping masks. Foundations/vehicle grade are untouched. */
export function createCanadaWalkingSurface(
  data: Pick<CityData, "roads">,
  site: CanadaPlaceSite,
  roadHeight: (road: Road, x: number, z: number) => number,
) {
  const triangles: number[] = [];
  const cellSize = 16;
  const cells = new Map<string, number[]>();
  for (const road of data.roads) {
    if (
      !(isStreet(road) || road.kind === "service") ||
      !site.intersects(road.pts)
    )
      continue;
    const g = ribbon(
      subdividePath(road.pts),
      roadWidth(road),
      isStreet(road) ? 0.092 : road.walkway ? 0.15 : 0.07,
      (x, z) => roadHeight(road, x, z),
      5,
      true,
    );
    const p = g.getAttribute("position"),
      ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i += 3) {
      const id = triangles.length / 9;
      const vertices = [0, 1, 2].map((k) => {
        const n = ix.getX(i + k);
        return [p.getX(n), p.getY(n), p.getZ(n)];
      });
      const [a, b, c] = vertices;
      const area =
        (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
      if (Math.abs(area) < 1e-9) continue;
      triangles.push(...a, ...b, ...c);
      const minX = Math.floor(Math.min(a[0], b[0], c[0]) / cellSize),
        maxX = Math.floor(Math.max(a[0], b[0], c[0]) / cellSize),
        minZ = Math.floor(Math.min(a[2], b[2], c[2]) / cellSize),
        maxZ = Math.floor(Math.max(a[2], b[2], c[2]) / cellSize);
      for (let x = minX; x <= maxX; x++)
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${z}`;
          const bucket = cells.get(key) ?? [];
          bucket.push(id);
          cells.set(key, bucket);
        }
    }
    g.dispose();
  }
  const faces = new Float32Array(triangles);
  return {
    triangleCount: faces.length / 9,
    triangleBytes: faces.byteLength,
    cellCount: cells.size,
    height(x: number, z: number) {
      let y = canadaPlacePavingHeight(data, site, x, z);
      if (y === undefined) return undefined;
      const ids = cells.get(
        `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`,
      );
      for (const id of ids ?? []) {
        const i = id * 9,
          ax = faces[i],
          ay = faces[i + 1],
          az = faces[i + 2],
          bx = faces[i + 3],
          by = faces[i + 4],
          bz = faces[i + 5],
          cx = faces[i + 6],
          cy = faces[i + 7],
          cz = faces[i + 8];
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        if (u >= -1e-7 && v >= -1e-7 && u + v <= 1.0000001)
          y = Math.max(y, u * ay + v * by + (1 - u - v) * cy);
      }
      return y;
    },
  };
}
