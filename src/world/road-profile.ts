import { isStreet, roadWidth, type Road } from "./data";

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
export function* roadMarkings(road: Road, gaps: [number, number][] = []) {
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
      function* pieces(a: number, b: number) {
        let head = a;
        for (const [start, end] of gaps) {
          const from = start - travelled,
            to = end - travelled;
          if (to <= head || from >= b) continue;
          if (from > head) yield [head, Math.min(from, b)];
          head = Math.max(head, to);
          if (head >= b) return;
        }
        if (head < b) yield [head, b];
      }
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
            for (const [a, b] of pieces(lo, hi))
              yield {
                pts: [...point(a, offset), ...point(b, offset)],
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
              for (const [start, end] of pieces(a, b))
                yield {
                  pts: [
                    ...point(start, divider.offset),
                    ...point(end, divider.offset),
                  ],
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

/** OSM ways share junction nodes; reserve the crossing street's full width. */
export function roadJunctionGaps(roads: Road[]) {
  const nodes = new Map<
    string,
    { road: Road; distance: number; dx: number; dz: number }[]
  >();
  for (const road of roads) {
    if (
      !isStreet(road) &&
      !(
        road.crossing &&
        ["lines", "yes", "zebra", "ladder"].includes(
          road.crossingMarkings ?? "",
        )
      )
    )
      continue;
    let distance = 0;
    for (let i = 0; i < road.pts.length; i += 2) {
      const p = road.pts;
      if (i) distance += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      const a = Math.max(0, i - 2),
        b = Math.min(p.length - 2, i + 2),
        dx = p[b] - p[a],
        dz = p[b + 1] - p[a + 1],
        length = Math.hypot(dx, dz) || 1;
      const key = `${Math.round(p[i] * 10)},${Math.round(p[i + 1] * 10)}`;
      let entries = nodes.get(key);
      if (!entries) nodes.set(key, (entries = []));
      entries.push({ road, distance, dx: dx / length, dz: dz / length });
    }
  }
  const result = new Map<Road, [number, number][]>();
  for (const entries of nodes.values()) {
    if (entries.length < 2) continue;
    for (const current of entries) {
      if (!isStreet(current.road)) continue;
      let radius = 0;
      for (const other of entries) {
        if (other.road === current.road) continue;
        const sine = Math.abs(current.dx * other.dz - current.dz * other.dx);
        if (sine > 0.35)
          radius = Math.max(
            radius,
            Math.min(
              24,
              (other.road.crossing ? 1.8 : roadWidth(other.road) / 2) / sine +
                1.5,
            ),
          );
      }
      if (radius > 0) {
        let gaps = result.get(current.road);
        if (!gaps) result.set(current.road, (gaps = []));
        gaps.push([
          Math.max(0, current.distance - radius),
          current.distance + radius,
        ]);
      }
    }
  }
  for (const [road, gaps] of result) {
    gaps.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const gap of gaps) {
      const prev = merged.at(-1);
      if (prev && gap[0] <= prev[1]) prev[1] = Math.max(prev[1], gap[1]);
      else merged.push([...gap]);
    }
    result.set(road, merged);
  }
  return result;
}
