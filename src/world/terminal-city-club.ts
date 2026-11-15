import * as T from "three";
import type { Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { TerminalCityMaterials } from "./terminal-city-materials";
import data from "./terminal-city-club-data.json";
export const TERMINAL_CITY_CLUB_ID = "w143683969";
export const TERMINAL_CITY_CLUB_RING = data.ring as Point[];
export const TERMINAL_CITY_CLUB_PARTS = data.parts;
/** Low adjoining club: historical City roof zones, no change to neighbour815/747.
 * Full mapped lowest level closes the small gaps between generalized roof parts. */
export function buildTerminalCityClub(
  batch: Batcher,
  b: { id: string; pts: number[] },
  m: TerminalCityMaterials,
): boolean {
  if (b.id !== TERMINAL_CITY_CLUB_ID) return false;
  // The adjoining parcel receives its own caller-supplied building datum.
  // Historical roof differences remain relative, not absolute City elevations.
  const mesh = new ArchitecturalMesh(batch, 390, -416);
  function quad(mat: T.Material, p: Vertex3[], normal: Vertex3) {
    const a = new T.Vector3(...p[0]);
    if (
      new T.Vector3(...p[1])
        .sub(a)
        .cross(new T.Vector3(...p[2]).sub(a))
        .dot(new T.Vector3(...normal)) < 0
    )
      p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1])),
      h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(mat, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  }
  function ringWalls(r: Point[], low: number, high: number) {
    for (let i = 0; i < r.length; i++) {
      const f = facadeFrame(r[i], r[(i + 1) % r.length]);
      if (f.length < 0.01) continue;
      const n: Vertex3 = [f.outward[0], 0, f.outward[1]];
      const panel = (
        a: number,
        c: number,
        y: number,
        h: number,
        d: number,
        mat: T.Material,
      ) => {
        if (c - a < 0.001 || h - y < 0.001) return;
        quad(mat, [f.p(a, y, d), f.p(c, y, d), f.p(c, h, d), f.p(a, h, d)], n);
      };
      const levels = [
        low,
        ...[5.5, 10.98, 16.46].filter((y) => y > low + 0.2 && y < high - 0.2),
        high,
      ];
      for (let k = 0; k < levels.length - 1; k++) {
        const y = levels[k],
          h = levels[k + 1],
          count = Math.max(1, Math.round(f.length / 3.9));
        for (let j = 0; j < count; j++) {
          const a = (j * f.length) / count,
            c = ((j + 1) * f.length) / count,
            pad = 0.5,
            sill = y + 0.8,
            head = h - 0.7;
          if (c - a < 1.7 || head - sill < 1) {
            panel(a, c, y, h, 0, m.stone);
            continue;
          }
          const l = a + pad,
            r = c - pad,
            d = 0.38;
          panel(a, l, y, h, 0, m.stone);
          panel(r, c, y, h, 0, m.stone);
          panel(l, r, y, sill, 0, m.stone);
          panel(l, r, head, h, 0, m.stone);
          panel(l, r, sill, head, d, m.glass);
          panel(l, r, sill, head, d + 0.05, m.dark);
          const along = new T.Vector3(...f.p(1, 0)).sub(
            new T.Vector3(...f.p(0, 0)),
          );
          quad(
            m.stone,
            [f.p(l, sill), f.p(l, sill, d), f.p(l, head, d), f.p(l, head)],
            [along.x, 0, along.z],
          );
          quad(
            m.stone,
            [f.p(r, sill), f.p(r, sill, d), f.p(r, head, d), f.p(r, head)],
            [-along.x, 0, -along.z],
          );
          quad(
            m.stone,
            [f.p(l, sill), f.p(r, sill), f.p(r, sill, d), f.p(l, sill, d)],
            [0, 1, 0],
          );
          quad(
            m.stone,
            [f.p(l, head), f.p(r, head), f.p(r, head, d), f.p(l, head, d)],
            [0, -1, 0],
          );
          panel(
            (l + r) / 2 - 0.035,
            (l + r) / 2 + 0.035,
            sill,
            head,
            d - 0.035,
            m.metal,
          );
          panel(l, r, head - 0.55, head - 0.5, d - 0.035, m.metal);
        }
        panel(0, f.length, h - 0.16, h - 0.08, -0.025, m.spandrel);
      }
    }
  }
  const roof = (r: Point[], h: number, holes: Point[][] = []) =>
    mesh.add(
      flatPolygon(
        r.flat(),
        holes.map((r) => r.flat()),
        h,
        1,
      ),
      m.roof,
    );
  ringWalls(TERMINAL_CITY_CLUB_RING, 0, 5.5);
  roof(TERMINAL_CITY_CLUB_RING, 5.5);
  for (const part of data.parts) {
    if (part.height <= 5.5) continue;
    for (const polygon of part.polygons) {
      const rings = polygon.map((r) => r.slice(0, -1) as Point[]);
      if (part.id === 166939) {
        // Aerial-registered glazed pool roof. Section is unknown: use a closed
        // flat exterior approximation, not an invented barrel/interior.
        const r = rings[0];
        mesh.add(flatPolygon(r.flat(), [], part.height, 1), m.glass);
        mesh.add(flatPolygon(r.flat(), [], part.height - 0.05, 1), m.dark);
        const p = (a: Point, b: Point, t: number): Vertex3 => [
          a[0] + (b[0] - a[0]) * t,
          part.height + 0.025,
          a[1] + (b[1] - a[1]) * t,
        ];
        for (let j = 0; j <= 8; j++)
          mesh.beam(
            p(r[0], r[3], j / 8),
            p(r[1], r[2], j / 8),
            0.025,
            m.metal,
            6,
          );
        for (let j = 0; j <= 3; j++)
          mesh.beam(
            p(r[0], r[1], j / 3),
            p(r[3], r[2], j / 3),
            0.025,
            m.metal,
            6,
          );
      } else roof(rings[0], part.height, rings.slice(1));
      for (const r of rings) ringWalls(r, 5.5, part.height);
    }
  }
  mesh.finish();
  return true;
}
