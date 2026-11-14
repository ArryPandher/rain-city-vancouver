import { roadWidth, type Road } from "./data";

export function laneCount(road: Road) {
  return Math.max(
    1,
    Math.min(
      10,
      Math.round(
        road.lanes ??
          (road.oneway
            ? 2
            : ["primary", "secondary"].includes(road.kind)
              ? 4
              : 2),
      ),
    ),
  );
}

export function laneDividers(road: Road) {
  const count = laneCount(road),
    usable = Math.max(2.6, roadWidth(road) - 0.6),
    both = Math.min(count - 1, road.lanesBothWays ?? 0),
    backward =
      road.lanesBackward ??
      (road.lanesForward
        ? count - road.lanesForward - both
        : Math.floor((count - both) / 2));
  return Array.from({ length: count - 1 }, (_, i) => {
    const boundary = i + 1;
    return {
      offset: -usable / 2 + (usable * boundary) / count,
      yellow:
        !road.oneway &&
        (boundary === backward || (both > 0 && boundary === backward + both)),
    };
  });
}

/** Centre of the outer forward lane, including a centred single-lane way. */
export function drivingOffset(road: Road) {
  const count = laneCount(road),
    usable = Math.max(2.6, roadWidth(road) - 0.6);
  return usable / 2 - usable / count / 2;
}

export function sidewalkSides(road: Road) {
  if (road.sidewalk === "none") return [];
  if (road.sidewalk === "left") return [-1];
  if (road.sidewalk === "right") return [1];
  return [-1, 1];
}

/** Reverse a two-way route while retaining the correct lane/sidewalk sides. */
export function reverseRoad(road: Road): Road {
  const pts: number[] = [];
  for (let i = road.pts.length - 2; i >= 0; i -= 2)
    pts.push(road.pts[i], road.pts[i + 1]);
  return {
    ...road,
    pts,
    lanesForward: road.lanesBackward,
    lanesBackward: road.lanesForward,
    sidewalk:
      road.sidewalk === "left"
        ? "right"
        : road.sidewalk === "right"
          ? "left"
          : road.sidewalk,
  };
}

/** Keep dash phase through the many short nodes in real curved road geometry. */
export function* roadMarkings(road: Road) {
  const p = road.pts,
    lengths: number[] = [],
    normals: number[][] = [];
  let total = 0;
  for (let i = 0; i < p.length; i += 2) {
    const before = Math.max(0, i - 2),
      after = Math.min(p.length - 2, i + 2);
    const dx = p[after] - p[before],
      dz = p[after + 1] - p[before + 1],
      l = Math.hypot(dx, dz) || 1;
    normals.push([dz / l, -dx / l]);
    if (i < p.length - 2) {
      const length = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
      lengths.push(length);
      total += length;
    }
  }
  const dividers = laneDividers(road);
  let travelled = 0;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i],
      lo = Math.max(0, 3 - travelled),
      hi = Math.min(length, total - 3 - travelled);
    if (length > 0.01 && hi > lo) {
      const point = (at: number, offset: number) => {
        const t = at / length;
        return [
          p[i * 2] +
            (p[i * 2 + 2] - p[i * 2]) * t +
            (normals[i][0] * (1 - t) + normals[i + 1][0] * t) * offset,
          p[i * 2 + 1] +
            (p[i * 2 + 3] - p[i * 2 + 1]) * t +
            (normals[i][1] * (1 - t) + normals[i + 1][1] * t) * offset,
        ];
      };
      for (const divider of dividers) {
        if (divider.yellow) {
          for (const offset of [divider.offset - 0.12, divider.offset + 0.12])
            yield {
              pts: [...point(lo, offset), ...point(hi, offset)],
              yellow: true,
            };
        } else {
          for (
            let dash = Math.floor((travelled + lo - 3) / 9) * 9 + 3;
            dash < travelled + hi;
            dash += 9
          ) {
            const a = Math.max(lo, dash - travelled),
              b = Math.min(hi, dash + 3.5 - travelled);
            if (b > a)
              yield {
                pts: [...point(a, divider.offset), ...point(b, divider.offset)],
                yellow: false,
              };
          }
        }
      }
    }
    travelled += length;
  }
}

/** Use mapped crossing-way tags; an unmarked crossing receives no paint. */
export function* crosswalkMarkings(road: Road) {
  if (
    !road.crossing ||
    !["lines", "yes", "zebra", "ladder"].includes(road.crossingMarkings ?? "")
  )
    return;
  const zebra = ["zebra", "ladder"].includes(road.crossingMarkings!);
  let travelled = 0;
  for (let i = 0; i < road.pts.length - 2; i += 2) {
    const ax = road.pts[i],
      az = road.pts[i + 1],
      dx = road.pts[i + 2] - ax,
      dz = road.pts[i + 3] - az,
      length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const nx = dz / length,
      nz = -dx / length;
    if (!zebra) {
      for (const offset of [-1.4, 1.4])
        yield {
          pts: [
            ax + nx * offset,
            az + nz * offset,
            ax + dx + nx * offset,
            az + dz + nz * offset,
          ],
          width: 0.14,
        };
    } else {
      for (
        let d = Math.ceil(travelled / 1.2) * 1.2 - travelled;
        d < length;
        d += 1.2
      ) {
        const x = ax + (dx * d) / length,
          z = az + (dz * d) / length;
        yield {
          pts: [x - nx * 1.4, z - nz * 1.4, x + nx * 1.4, z + nz * 1.4],
          width: 0.5,
        };
      }
    }
    travelled += length;
  }
}
