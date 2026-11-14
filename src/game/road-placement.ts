import type { Road } from "../world/data";

export interface RoadSpan {
  road: Road;
  segment: number;
  min: number;
  max: number;
  length: number;
}
export interface RoadCursor {
  segment: number;
  t: number;
  direction: number;
}

export function pointOnRoad(
  road: Road,
  segment: number,
  t: number,
  offset: number,
) {
  const ax = road.pts[segment],
    az = road.pts[segment + 1];
  const dx = road.pts[segment + 2] - ax,
    dz = road.pts[segment + 3] - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dz / len,
    nz = -dx / len;
  const vertexNormal = (i: number) => {
    let tx = 0,
      tz = 0;
    for (const seg of [i - 2, i]) {
      if (seg < 0 || seg >= road.pts.length - 2) continue;
      const x = road.pts[seg + 2] - road.pts[seg],
        z = road.pts[seg + 3] - road.pts[seg + 1];
      const l = Math.hypot(x, z);
      if (l > 0.01) {
        tx += x / l;
        tz += z / l;
      }
    }
    const l = Math.hypot(tx, tz);
    return l > 0.01 ? [tz / l, -tx / l] : [nx, nz];
  };
  const blend = Math.min(4, len / 2);
  const a = Math.max(0, 1 - (t * len) / blend),
    b = Math.max(0, 1 - ((1 - t) * len) / blend);
  const start = vertexNormal(segment),
    end = vertexNormal(segment + 2);
  const ox = nx + (start[0] - nx) * a + (end[0] - nx) * b;
  const oz = nz + (start[1] - nz) * a + (end[1] - nz) * b;
  const normalLength = Math.hypot(ox, oz) || 1;
  return {
    x: ax + dx * t + (ox / normalLength) * offset,
    z: az + dz * t + (oz / normalLength) * offset,
    heading: Math.atan2(dx, dz),
    len,
  };
}

/** Clip every segment to the local circle, including ways with distant ends. */
export function nearbyRoadSpans(
  roads: Road[],
  x: number,
  z: number,
  radius: number,
) {
  const spans: RoadSpan[] = [];
  for (const road of new Set(roads)) {
    for (let segment = 0; segment < road.pts.length - 2; segment += 2) {
      const ax = road.pts[segment],
        az = road.pts[segment + 1];
      const dx = road.pts[segment + 2] - ax,
        dz = road.pts[segment + 3] - az;
      const square = dx * dx + dz * dz;
      if (square < 0.01) continue;
      const projection = ((x - ax) * dx + (z - az) * dz) / square;
      const distanceSquared =
        (ax + dx * projection - x) ** 2 + (az + dz * projection - z) ** 2;
      if (distanceSquared > radius * radius) continue;
      const delta = Math.sqrt((radius * radius - distanceSquared) / square);
      const min = Math.max(0, projection - delta),
        max = Math.min(1, projection + delta);
      if (max <= min) continue;
      spans.push({
        road,
        segment,
        min,
        max,
        length: Math.sqrt(square) * (max - min),
      });
    }
  }
  return spans;
}

/** Sample by usable road length so tiny ways do not dominate the population. */
export function sampleRoadSpan(spans: RoadSpan[], random: () => number) {
  if (!spans.length) return null;
  const total = spans.reduce((sum, span) => sum + span.length, 0);
  let choice = random() * total;
  let chosen = spans[spans.length - 1];
  for (const span of spans) {
    choice -= span.length;
    if (choice <= 0) {
      chosen = span;
      break;
    }
  }
  return {
    road: chosen.road,
    segment: chosen.segment,
    t: chosen.min + random() * (chosen.max - chosen.min),
  };
}

/** Walk through successive polyline segments and turn at the end, in metres. */
export function advanceRoadCursor(
  road: Road,
  cursor: RoadCursor,
  distance: number,
): RoadCursor {
  let { segment, t, direction } = cursor;
  let remaining = Math.max(0, distance);
  for (let guard = 0; guard < road.pts.length + 4 && remaining > 0; guard++) {
    const length = Math.hypot(
      road.pts[segment + 2] - road.pts[segment],
      road.pts[segment + 3] - road.pts[segment + 1],
    );
    const available = (direction > 0 ? 1 - t : t) * length;
    if (length > 0 && remaining <= available) {
      t += (direction * remaining) / length;
      remaining = 0;
    } else {
      remaining -= available;
      if (direction > 0) {
        if (segment < road.pts.length - 4) {
          segment += 2;
          t = 0;
        } else {
          direction = -1;
          t = 1;
        }
      } else {
        if (segment > 0) {
          segment -= 2;
          t = 1;
        } else {
          direction = 1;
          t = 0;
        }
      }
    }
  }
  return { segment, t, direction };
}
