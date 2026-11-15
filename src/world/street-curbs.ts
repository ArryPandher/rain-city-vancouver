import * as T from "three";
import { sidewalkSides } from "./road-profile";
import { isStreet, roadWidth, type Road } from "./data";

/** A deliberately small first pass. Dimensions are authored, not surveyed. */
export const CURB_BOUNDS = { minX: -310, maxX: 510, minZ: -830, maxZ: -475 };
export function hasHarbourCurbs(r: Road) {
  return (
    isStreet(r) &&
    r.foot !== false &&
    /^(Canada Place|West Cordova Street|Bute Street|Thurlow Street)$/.test(
      r.name ?? "",
    ) &&
    r.pts.every((v, i) =>
      i % 2
        ? v > CURB_BOUNDS.minZ + 15 && v < CURB_BOUNDS.maxZ - 15
        : v > CURB_BOUNDS.minX + 15 && v < CURB_BOUNDS.maxX - 15,
    )
  );
}
type Segment = {
  road: Road;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  radius: number;
};
export function curbObstacles(roads: Road[]): Segment[] {
  return roads.flatMap((road) => {
    if (!isStreet(road) && road.kind !== "service" && !road.crossing) return [];
    const out: Segment[] = [];
    for (let i = 0; i < road.pts.length - 2; i += 2) {
      const [ax, az, bx, bz] = road.pts.slice(i, i + 4);
      if (
        Math.max(ax, bx) < CURB_BOUNDS.minX - 40 ||
        Math.min(ax, bx) > CURB_BOUNDS.maxX + 40 ||
        Math.max(az, bz) < CURB_BOUNDS.minZ - 40 ||
        Math.min(az, bz) > CURB_BOUNDS.maxZ + 40
      )
        continue;
      out.push({
        road,
        ax,
        az,
        bx,
        bz,
        radius: road.crossing ? 2 : roadWidth(road) / 2 + 0.35,
      });
    }
    return out;
  });
}

/** Cross-section, road to sidewalk: gutter, vertical face, crown, apron.
 * Openings are tested across the entire section, so none can bridge a lane.
 * One metre samples follow grades; 1.8m ramps return the crown to paving.
 */
export function harbourCurbGeometry(
  road: Road,
  obstacles: Segment[],
  height: (x: number, z: number) => number,
) {
  const positions = {
    gutter: [] as number[],
    curb: [] as number[],
    apron: [] as number[],
  };
  const quad = (
    key: keyof typeof positions,
    a: number[],
    b: number[],
    c: number[],
    d: number[],
  ) => {
    // Orient each face toward the sky or road, independently of road direction.
    positions[key].push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  const nodes: { x: number; z: number; nx: number; nz: number; at: number }[] =
    [];
  let at = 0;
  const p = road.pts;
  const normals = p
    .filter((_, i) => !(i % 2))
    .map((_, n) => {
      const i = n * 2,
        a = Math.max(0, i - 2),
        b = Math.min(p.length - 2, i + 2);
      const dx = p[b] - p[a],
        dz = p[b + 1] - p[a + 1],
        len = Math.hypot(dx, dz) || 1;
      return [dz / len, -dx / len];
    });
  for (let i = 0; i < p.length - 2; i += 2) {
    const length = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
    if (length < 0.001) continue;
    const count = Math.ceil(length);
    for (let j = 0; j < count; j++) {
      const t = j / count;
      nodes.push({
        x: p[i] + (p[i + 2] - p[i]) * t,
        z: p[i + 1] + (p[i + 3] - p[i + 1]) * t,
        nx: normals[i / 2][0] * (1 - t) + normals[i / 2 + 1][0] * t,
        nz: normals[i / 2][1] * (1 - t) + normals[i / 2 + 1][1] * t,
        at: at + length * t,
      });
    }
    at += length;
  }
  nodes.push({
    x: p.at(-2)!,
    z: p.at(-1)!,
    nx: normals.at(-1)![0],
    nz: normals.at(-1)![1],
    at,
  });
  for (const side of [-1, 1]) {
    const point = (n: (typeof nodes)[number], offset: number, y: number) => {
      const norm = Math.hypot(n.nx, n.nz) || 1;
      const x = n.x + (n.nx / norm) * side * offset,
        z = n.z + (n.nz / norm) * side * offset;
      return [x, height(x, z) + y, z];
    };
    const edge = roadWidth(road) / 2;
    const apronWidth = sidewalkSides(road).includes(side) ? 2.5 : 0.6;
    const across = Math.ceil((apronWidth + 0.38) / 0.4);
    const clear = nodes.map((n) =>
      Array.from(
        { length: across + 1 },
        (_, k) => edge - 0.38 + ((apronWidth + 0.38) * k) / across,
      ).every((offset) => {
        const [x, , z] = point(n, offset, 0);
        return obstacles.every((s) => {
          if (s.road === road) return true;
          const dx = s.bx - s.ax,
            dz = s.bz - s.az,
            len2 = dx * dx + dz * dz;
          if (len2 < 1e-6) return true;
          // Continuous collinear OSM way splits are not intersections.
          const parallel =
            Math.abs((dx * n.nz - dz * n.nx) / Math.sqrt(len2)) > 0.97;
          if (parallel && s.road.name === road.name && !s.road.crossing)
            return true;
          const t = Math.max(
            0,
            Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / len2),
          );
          return (
            Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) > s.radius + 0.6
          );
        });
      }),
    );
    // Distance to the nearest cut, including way ends: no upright end caps.
    const ramp = nodes.map(() => 1);
    let last = nodes[0].at;
    for (let i = 0; i < nodes.length; i++) {
      if (!clear[i]) last = nodes[i].at;
      ramp[i] = Math.min(1, (nodes[i].at - last) / 1.8);
    }
    last = nodes.at(-1)!.at;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (!clear[i]) last = nodes[i].at;
      ramp[i] = Math.min(ramp[i], (last - nodes[i].at) / 1.8);
    }
    for (let i = 1; i < nodes.length; i++) {
      if (!clear[i - 1] || !clear[i]) continue;
      const a = nodes[i - 1],
        b = nodes[i];
      const section = (n: typeof a, rise: number) => [
        point(n, edge - 0.38, 0.096),
        point(n, edge, 0.102),
        point(n, edge, 0.102 + 0.14 * rise),
        point(n, edge + 0.18, 0.102 + 0.14 * rise),
        point(n, edge + apronWidth, 0.15),
      ];
      const aa = section(a, ramp[i - 1]),
        bb = section(b, ramp[i]);
      for (let k = 0; k < 4; k++) {
        const key = k === 0 ? "gutter" : k === 3 ? "apron" : "curb";
        if (side === 1) quad(key, aa[k], bb[k], bb[k + 1], aa[k + 1]);
        else quad(key, aa[k + 1], bb[k + 1], bb[k], aa[k]);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(positions).map(([key, pos]) => {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          pos.flatMap((_, i) =>
            i % 3 === 0 ? [pos[i] / 4, pos[i + 2] / 4] : [],
          ),
          2,
        ),
      );
      g.computeVertexNormals();
      return [key, g];
    }),
  ) as Record<keyof typeof positions, T.BufferGeometry>;
}
