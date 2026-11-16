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
  const street = facadeFrame(
    TERMINAL_CITY_CLUB_RING[1],
    TERMINAL_CITY_CLUB_RING[2],
  );
  const poolPart = data.parts.find((part) => part.id === 166939)!;
  const poolEdge = poolPart.polygons[0][0].slice(1, 3) as Point[];
  const poolFront = facadeFrame(poolEdge[0], poolEdge[1]);
  const lowerRoof = data.parts.find((part) => part.id === 158862)!.height;
  const sameEdge = (a: Point, b: Point, c: Point, d: Point) =>
    (Math.hypot(a[0] - c[0], a[1] - c[1]) < 0.001 &&
      Math.hypot(b[0] - d[0], b[1] - d[1]) < 0.001) ||
    (Math.hypot(a[0] - d[0], a[1] - d[1]) < 0.001 &&
      Math.hypot(b[0] - c[0], b[1] - c[1]) < 0.001);
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
  function ringWalls(r: Point[], low: number, high: number, partId = 0) {
    for (let i = 0; i < r.length; i++) {
      const f = facadeFrame(r[i], r[(i + 1) % r.length]);
      if (f.length < 0.01) continue;
      const streetEdge = sameEdge(
        r[i],
        r[(i + 1) % r.length],
        TERMINAL_CITY_CLUB_RING[1],
        TERMINAL_CITY_CLUB_RING[2],
      );
      const poolStreetEdge = sameEdge(
        r[i],
        r[(i + 1) % r.length],
        poolEdge[0],
        poolEdge[1],
      );
      // Replace only the photographed Cordova fronts. The reversed shared
      // 158862/166939 boundary is buried below11.53m: omit BOTH internal skins.
      if (
        (partId === 158862 && (streetEdge || poolStreetEdge)) ||
        (partId === 166939 && poolStreetEdge)
      )
        continue;
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
          // The last two ground modules beside325 are the photographed parking
          // recess. Retain the unverified farther frontage's existing fallback.
          if (partId === 0 && streetEdge && j >= count - 2) continue;
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
        panel(
          0,
          partId === 0 && streetEdge
            ? (f.length * (count - 2)) / count
            : f.length,
          h - 0.16,
          h - 0.08,
          -0.025,
          m.spandrel,
        );
      }
    }
  }
  type Frame = ReturnType<typeof facadeFrame>;
  const surface = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    lo: number,
    hi: number,
    depth = 0,
  ) => {
    if (b - a < 0.001 || hi - lo < 0.001) return;
    quad(
      mat,
      [
        f.p(a, lo, depth),
        f.p(b, lo, depth),
        f.p(b, hi, depth),
        f.p(a, hi, depth),
      ],
      [f.outward[0], 0, f.outward[1]],
    );
  };
  const horizontal = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    y: number,
    front: number,
    back: number,
    up = true,
  ) =>
    quad(
      mat,
      [f.p(a, y, front), f.p(b, y, front), f.p(b, y, back), f.p(a, y, back)],
      [0, up ? 1 : -1, 0],
    );
  const jamb = (
    f: Frame,
    mat: T.Material,
    u: number,
    lo: number,
    hi: number,
    front: number,
    back: number,
    right: boolean,
  ) => {
    const a = f.p(0, 0),
      b = f.p(1, 0),
      sign = right ? 1 : -1;
    quad(
      mat,
      [
        f.p(u, lo, front),
        f.p(u, lo, back),
        f.p(u, hi, back),
        f.p(u, hi, front),
      ],
      [sign * (b[0] - a[0]), 0, sign * (b[2] - a[2])],
    );
  };
  const ledge = (
    f: Frame,
    mat: T.Material,
    a: number,
    b: number,
    lo: number,
    hi: number,
    front: number,
    back: number,
    topBack = back,
  ) => {
    surface(f, mat, a, b, lo, hi, front);
    horizontal(f, mat, a, b, lo, front, back, false);
    horizontal(f, mat, a, b, hi, front, topBack);
    jamb(f, mat, a, lo, hi, front, back, false);
    jamb(f, mat, b, lo, hi, front, back, true);
  };
  const mineral = (f: Frame, a: number, b: number, lo: number, hi: number) => {
    if (b - a < 0.02 || hi - lo < 0.02) return;
    // MCM's mineral panels have explicit joints. Module dimensions are a fit,
    // not a Tyndall-stone scan or a measured shop drawing. Recesses are12mm.
    surface(f, m.stone, a, b, lo, hi, 0.012);
    const cols = Math.max(1, Math.round((b - a) / 1.45)),
      rows = Math.max(1, Math.round((hi - lo) / 0.82));
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const left = a + ((b - a) * i) / cols + 0.006,
          right = a + ((b - a) * (i + 1)) / cols - 0.006;
        const low = lo + ((hi - lo) * j) / rows + 0.006,
          high = lo + ((hi - lo) * (j + 1)) / rows - 0.006;
        surface(f, m.stone, left, right, low, high);
        horizontal(f, m.stone, left, right, low, 0, 0.012, false);
        horizontal(f, m.stone, left, right, high, 0, 0.012);
        jamb(f, m.stone, left, low, high, 0, 0.012, false);
        jamb(f, m.stone, right, low, high, 0, 0.012, true);
      }
  };
  const reveal = (
    f: Frame,
    a: number,
    b: number,
    lo: number,
    hi: number,
    depth: number,
    includeSill = true,
  ) => {
    jamb(f, m.stone, a, lo, hi, 0, depth, true);
    jamb(f, m.stone, b, lo, hi, 0, depth, false);
    if (includeSill) horizontal(f, m.stone, a, b, lo, 0, depth);
    horizontal(f, m.stone, a, b, hi, 0, depth, false);
  };
  const glazedBand = (
    f: Frame,
    a: number,
    b: number,
    lo: number,
    hi: number,
    depth: number,
    pitch: number,
  ) => {
    // Both photographed bands have a projecting sill below. Its cap owns the
    // entire floor; a second reveal floor here would be coplanar with that cap.
    reveal(f, a, b, lo, hi, depth, false);
    surface(f, m.glass, a + 0.055, b - 0.055, lo + 0.055, hi - 0.055, depth);
    surface(f, m.dark, a, b, lo, hi, depth + 0.065);
    const count = Math.max(1, Math.round((b - a) / pitch));
    for (let i = 0; i <= count; i++) {
      const u = a + ((b - a) * i) / count;
      ledge(
        f,
        m.metal,
        Math.max(a, u - 0.035),
        Math.min(b, u + 0.035),
        lo,
        hi,
        depth - 0.065,
        depth + 0.01,
      );
    }
    for (const [low, high] of [
      [lo, lo + 0.055],
      [hi - 0.055, hi],
      [hi - 0.6, hi - 0.55],
    ])
      ledge(f, m.metal, a, b, low, high, depth - 0.06, depth + 0.01);
  };
  function cordovaFrontage() {
    // The 2013 modern325Howe reference's right edge and MCM street photographs
    // establish the parking recess / stone-framed ribbon / terrace / glazed
    // upper-band hierarchy. Apertures and panel rhythms below are photo-fit
    // interpretations inside the unchanged mapped faces and City roof limits.
    const count = Math.max(1, Math.round(street.length / 3.9));
    const start = (street.length * (count - 2)) / count,
      left = start + 0.55,
      right = street.length - 1.0;
    const sill = 0.25,
      head = 3.85,
      depth = 1.1;
    mineral(street, start, left, 0, 5.5);
    mineral(street, right, street.length, 0, 5.5);
    mineral(street, left, right, 0, sill);
    mineral(street, left, right, head, 5.5);
    reveal(street, left, right, sill, head, depth);
    // Closed roller/service backing and a fixed foreground barrier. No opening
    // in the retained gameplay collider or invitation to an invented interior.
    surface(street, m.dark, left, right, sill, head, depth);
    for (let y = sill + 0.22; y < head - 0.1; y += 0.3)
      ledge(
        street,
        m.spandrel,
        left + 0.08,
        right - 0.08,
        y,
        y + 0.026,
        depth - 0.025,
        depth,
      );
    ledge(street, m.metal, left + 0.15, right - 0.15, 1.16, 1.23, 0.72, 0.8);
    for (const u of [left + 0.13, right - 0.13])
      ledge(street, m.metal, u - 0.04, u + 0.04, sill, 1.25, 0.7, 0.82);
    // Keep projection within existing upper facade trim scale; visible undersides
    // make the deep recess readable without brighter material multipliers.
    ledge(street, m.stone, start, street.length, 5.25, 5.5, -0.1, 0.1);

    const a = 1.0,
      b = street.length - 1.0,
      low = 6.65,
      high = 9.6;
    mineral(street, 0, a, 5.5, lowerRoof);
    mineral(street, b, street.length, 5.5, lowerRoof);
    mineral(street, a, b, 5.5, low);
    mineral(street, a, b, high, lowerRoof);
    glazedBand(street, a, b, low, high, 0.58, 1.35);
    ledge(street, m.stone, a - 0.12, b + 0.12, low - 0.16, low, -0.1, 0.58);
    ledge(
      street,
      m.stone,
      0,
      street.length,
      lowerRoof - 0.16,
      lowerRoof,
      -0.12,
      0.18,
      0, // Unchanged terrace roof owns the inward horizontal surface.
    );
    // Thin terrace guard frame on the existing setback roof. Existing opaque
    // glass is not stretched into a new opaque parapet or a walkable terrace.
    const guardDepth = 0.48,
      guardLow = lowerRoof + 0.1,
      guardTop = lowerRoof + 0.92;
    for (const y of [guardLow, guardTop])
      mesh.beam(
        street.p(0.35, y, guardDepth),
        street.p(street.length - 0.35, y, guardDepth),
        0.022,
        m.metal,
        6,
      );
    const posts = Math.ceil((street.length - 0.7) / 1.55);
    for (let i = 0; i <= posts; i++) {
      const u = 0.35 + ((street.length - 0.7) * i) / posts;
      mesh.beam(
        street.p(u, lowerRoof, guardDepth),
        street.p(u, guardTop, guardDepth),
        0.024,
        m.metal,
        6,
      );
    }

    // This face is several metres behind the Cordova strip, not another row
    // pasted onto the street plane. Its lower interval is hidden by158862.
    const pa = 0.32,
      pb = poolFront.length - 0.32,
      glassLow = 15.65,
      glassHigh = poolPart.height - 0.6;
    mineral(poolFront, 0, poolFront.length, lowerRoof, glassLow);
    mineral(poolFront, 0, pa, glassLow, poolPart.height);
    mineral(poolFront, pb, poolFront.length, glassLow, poolPart.height);
    mineral(poolFront, pa, pb, glassHigh, poolPart.height);
    glazedBand(poolFront, pa, pb, glassLow, glassHigh, 0.2, 1.18);
    ledge(
      poolFront,
      m.metal,
      0,
      poolFront.length,
      glassLow - 0.09,
      glassLow,
      -0.04,
      0.2,
    );
    ledge(
      poolFront,
      m.metal,
      0,
      poolFront.length,
      poolPart.height - 0.12,
      poolPart.height,
      -0.07,
      0.15,
      0, // Unchanged pool roof owns the inward horizontal surface.
    );
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
      for (const r of rings) ringWalls(r, 5.5, part.height, part.id);
    }
  }
  cordovaFrontage();
  mesh.finish();
  return true;
}
