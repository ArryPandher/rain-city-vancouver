import { facadeFrame, type Vertex3 } from "./architectural-mesh";
import type { Point } from "./data";
import { PWC_PLACE_RING } from "./pwc-place-site";

/** Photo-fitted exterior section, not surveyed dimensions or an interior route. */
export interface PwcLobbyRecess {
  id: string;
  edge: number;
  floor: number;
  ceiling: number;
  polygon: Point[];
  closingSegments: [Point, Point][];
}
export interface PwcLobbyColumn {
  x: number;
  z: number;
  radius: number;
  bottom: number;
  top: number;
}
export const PWC_LOBBY_FLOOR = 0.18;
export const PWC_LOBBY_CEILING = 7.75;
export const PWC_LOBBY_GLASS_DEPTH = 2.4;
export const PWC_LOBBY_ENTRY_DEPTH = 3.4;
export const PWC_LOBBY_BACKING_GAP = 1.2;

/** The first two retained edges face the Howe approach. Corner pockets keep
 * stone returns behind the columns, never through their circular shafts. */
export const PWC_LOBBY_SECTIONS = [0, 1].map((edge) => {
  const frame = facadeFrame(PWC_PLACE_RING[edge], PWC_PLACE_RING[edge + 1]),
    mouth = 0.5,
    shoulder = 1.75,
    shoulderDepth = 1.08,
    depth = PWC_LOBBY_GLASS_DEPTH,
    entry =
      edge === 0
        ? { left: 6, right: 12, depth: PWC_LOBBY_ENTRY_DEPTH }
        : undefined,
    // CCW in local (along, depth). The first edge is the open street boundary.
    plan: Point[] = [
      [mouth, 0],
      [frame.length - mouth, 0],
      [frame.length - mouth, shoulderDepth],
      [frame.length - shoulder, shoulderDepth],
      [frame.length - shoulder, depth],
      ...(entry
        ? ([
            [entry.right, depth],
            [entry.right, entry.depth],
            [entry.left, entry.depth],
            [entry.left, depth],
          ] as Point[])
        : []),
      [shoulder, depth],
      [shoulder, shoulderDepth],
      [mouth, shoulderDepth],
    ],
    polygon = plan.map(([u, d]) => {
      const p = frame.p(u, 0, d);
      return [p[0], p[2]] as Point;
    });
  return {
    edge,
    frame,
    mouth,
    shoulder,
    shoulderDepth,
    depth,
    entry,
    plan,
    polygon,
  };
});

export const PWC_LOBBY_RECESSES: PwcLobbyRecess[] = PWC_LOBBY_SECTIONS.map(
  ({ edge, polygon }) => ({
    id: `pwc-howe-${edge}`,
    edge,
    floor: PWC_LOBBY_FLOOR,
    ceiling: PWC_LOBBY_CEILING,
    polygon,
    // The original mapped front edge alone is open. All other edges close
    // against stone returns or the modeled rear glazing.
    closingSegments: polygon
      .slice(1)
      .map((a, i) => [a, polygon[(i + 2) % polygon.length]]),
  }),
);

export const PWC_LOBBY_COLUMNS: PwcLobbyColumn[] = PWC_LOBBY_SECTIONS.flatMap(
  ({ edge, frame }) =>
    (edge === 0
      ? [1.1, 13.9, frame.length - 1.1]
      : [1.1, frame.length - 1.1]
    ).map((u) => {
      const p = frame.p(u, 0, 0.53);
      return {
        x: p[0],
        z: p[2],
        radius: 0.48,
        bottom: 0,
        top: PWC_LOBBY_CEILING,
      };
    }),
);

export type PwcLobbyFloorPanel = {
  edge: number;
  corners: [Vertex3, Vertex3, Vertex3, Vertex3];
};
function triangleHeight(
  x: number,
  z: number,
  a: Vertex3,
  b: Vertex3,
  c: Vertex3,
) {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
  const w = 1 - u - v;
  return Math.min(u, v, w) < -1e-7 ? undefined : a[1] * u + b[1] * v + c[1] * w;
}

/** Cached shared floor mesh/collision contract. Callback is the exterior BASE
 * grade, sampled 45 mm outside the original wall. +.18 equals the approach's
 * .15 walking finish plus a 30 mm entrance lip. Returned heights are relative
 * to the caller's building datum; the upper tower and ceiling remain fixed. */
export function createPwcLobbySite(
  groundHeight: (x: number, z: number) => number,
  datum = 0,
) {
  const floorPanels: PwcLobbyFloorPanel[] = [];
  const sections = PWC_LOBBY_SECTIONS.map((section) => {
    const { frame: f, entry, mouth, shoulder, shoulderDepth, depth } = section;
    const count = Math.ceil(f.length / 0.5);
    const stations = [
      ...new Set([
        ...Array.from({ length: count + 1 }, (_, i) => (i * f.length) / count),
        mouth,
        f.length - mouth,
        shoulder,
        f.length - shoulder,
        ...(entry ? [entry.left, entry.right] : []),
      ]),
    ].sort((a, b) => a - b);
    const heights = stations.map((u) => {
      const p = f.p(u, 0, -0.045);
      return groundHeight(p[0], p[2]) - datum + PWC_LOBBY_FLOOR;
    });
    const heightAt = (u: number) => {
      u = Math.max(0, Math.min(f.length, u));
      const index = Math.min(
        stations.length - 2,
        Math.max(0, stations.findIndex((s) => s > u) - 1),
      );
      if (u >= f.length) return heights.at(-1)!;
      return (
        heights[index] +
        ((heights[index + 1] - heights[index]) * (u - stations[index])) /
          (stations[index + 1] - stations[index])
      );
    };
    const strips = [
      [mouth, f.length - mouth, 0, shoulderDepth],
      [shoulder, f.length - shoulder, shoulderDepth, depth],
      ...(entry ? [[entry.left, entry.right, depth, entry.depth]] : []),
    ];
    for (const [left, right, near, far] of strips) {
      const cuts = stations.filter(
        (u) => u >= left - 1e-8 && u <= right + 1e-8,
      );
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i],
          b = cuts[i + 1];
        floorPanels.push({
          edge: section.edge,
          corners: [
            f.p(a, heightAt(a), near),
            f.p(b, heightAt(b), near),
            f.p(b, heightAt(b), far),
            f.p(a, heightAt(a), far),
          ],
        });
      }
    }
    return { ...section, stations, heightAt, strips };
  });
  const floorAt = (x: number, z: number) => {
    if (x < 460 || x > 490 || z < -427 || z > -394) return undefined;
    for (const panel of floorPanels) {
      const [a, b, c, d] = panel.corners;
      const y = triangleHeight(x, z, a, d, c) ?? triangleHeight(x, z, a, c, b);
      if (y !== undefined) return y;
    }
    return undefined;
  };
  const columns = PWC_LOBBY_COLUMNS.map((column) => {
    const section = sections.find((s) => {
      const p = s.frame.p(0, 0);
      return (
        Math.abs(
          -(
            (column.x - p[0]) * s.frame.outward[0] +
            (column.z - p[2]) * s.frame.outward[1]
          ) - 0.53,
        ) < 1e-6
      );
    })!;
    const p = section.frame.p(0, 0),
      u =
        (column.x - p[0]) * -section.frame.outward[1] +
        (column.z - p[2]) * section.frame.outward[0];
    return {
      ...column,
      edge: section.edge,
      bottom:
        Math.min(
          section.heightAt(u - column.radius),
          section.heightAt(u + column.radius),
        ) - 0.03,
    };
  });
  return {
    sections,
    floorPanels,
    floorAt,
    columns,
    ceiling: PWC_LOBBY_CEILING,
    openPolygons: PWC_LOBBY_RECESSES.map((s) => s.polygon),
    closures: PWC_LOBBY_RECESSES.flatMap((s) => s.closingSegments),
  };
}
export type PwcLobbySite = ReturnType<typeof createPwcLobbySite>;
