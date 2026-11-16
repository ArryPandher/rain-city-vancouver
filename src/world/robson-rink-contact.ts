import { segmentPoint } from "./data";
import { createRobsonRinkExteriorGeometry } from "./robson-rink-exterior";
import {
  ROBSON_RINK_EXTERIOR as D,
  ROBSON_RINK_GUARDS,
  ROBSON_RINK_OPENINGS,
  robsonRinkOpeningAt,
} from "./robson-rink-exterior-data";

/** Extract the same planar triangles the visible glass uses. No analytic
 * dome approximation: landing support must not hover above or cut its facets. */
export function createRobsonRinkContact() {
  const geometry = createRobsonRinkExteriorGeometry(),
    p = geometry.glass.getAttribute("position");
  const triangles: number[][] = [];
  for (let i = 0; i < p.count; i += 3)
    triangles.push(
      [0, 1, 2].flatMap((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]),
    );
  for (const role of ["concrete", "steel", "glass"] as const)
    geometry[role].dispose();
  const all = ROBSON_RINK_OPENINGS.flatMap((o) => o.polygon);
  const minX = Math.min(...all.map((p) => p[0])) - 2,
    maxX = Math.max(...all.map((p) => p[0])) + 2;
  const minZ = Math.min(...all.map((p) => p[1])) - 2,
    maxZ = Math.max(...all.map((p) => p[1])) + 2;
  const near = (x: number, z: number, radius = 0) =>
    x + radius >= minX &&
    x - radius <= maxX &&
    z + radius >= minZ &&
    z - radius <= maxZ;
  const roof = (x: number, z: number) => {
    if (!near(x, z)) return undefined;
    for (const t of triangles) {
      const den = (t[5] - t[8]) * (t[0] - t[6]) + (t[6] - t[3]) * (t[2] - t[8]);
      const a = ((t[5] - t[8]) * (x - t[6]) + (t[6] - t[3]) * (z - t[8])) / den;
      const b = ((t[8] - t[2]) * (x - t[6]) + (t[0] - t[6]) * (z - t[8])) / den;
      if (a >= -1e-7 && b >= -1e-7 && a + b <= 1 + 1e-7)
        return a * t[1] + b * t[4] + (1 - a - b) * t[7];
    }
  };
  const floor = (x: number, z: number) =>
    near(x, z) && robsonRinkOpeningAt(x, z) ? D.rinkY : undefined;
  return {
    floor,
    roof,
    support(x: number, z: number, referenceY = Infinity) {
      if (!near(x, z) || !robsonRinkOpeningAt(x, z)) return undefined;
      const top = roof(x, z);
      return top !== undefined && referenceY >= top - 0.35 ? top : D.rinkY;
    },
    blocked(
      x: number,
      z: number,
      radius: number,
      referenceY: number,
      camera = false,
    ) {
      if (!near(x, z, radius)) return false;
      const y = Number.isFinite(referenceY) ? referenceY : D.streetY;
      const low = camera ? y - radius : y,
        high = camera ? y + radius : y + 1.8;
      for (const guard of ROBSON_RINK_GUARDS) {
        const distance = segmentPoint(x, z, ...guard.a, ...guard.b).d;
        if (distance < radius + 0.035 && high > guard.minY && low < guard.maxY)
          return true;
        if (
          distance < radius + D.wallThickness / 2 &&
          high > D.rinkY - D.floorThickness &&
          low < D.rimY
        )
          return true;
      }
      for (const [dx, dz] of [
        [0, 0],
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
      ]) {
        const top = roof(x + dx, z + dz);
        if (
          top !== undefined &&
          high > top - 0.08 &&
          low < top + 0.08 &&
          (camera || top > y + 0.35)
        )
          return true;
      }
      return false;
    },
  };
}
