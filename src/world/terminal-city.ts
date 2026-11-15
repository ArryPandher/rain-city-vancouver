import * as T from "three";
import type { Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { TerminalCityMaterials } from "./terminal-city-materials";
import {
  TERMINAL_CITY_ID,
  TERMINAL_CITY_RING,
  TERMINAL_CITY_CLUB_HEIGHT,
  TERMINAL_CITY_TOWER_UV,
  TERMINAL_CITY_UPPER_UV,
  TERMINAL_CITY_TOP_UV,
  terminalCityPoint,
  terminalCityLevel,
  terminalCityBowedRing,
} from "./terminal-city-site";
export type { TerminalCityMaterials } from "./terminal-city-materials";
/** Original exterior reconstruction; source anchors and photographic estimates are
 * separated in the site data/source note. No interior, textures or probes here. */
export function buildTerminalCity(
  batch: Batcher,
  b: { id: string; pts: number[] },
  m: TerminalCityMaterials,
): boolean {
  if (b.id !== TERMINAL_CITY_ID) return false;
  const saved = batch.offsetY;
  batch.offsetY = 0;
  const mesh = new ArchitecturalMesh(batch, 355, -401);
  function quad(mat: T.Material, p: Vertex3[], n: Vertex3) {
    const a = new T.Vector3(...p[0]);
    if (
      new T.Vector3(...p[1])
        .sub(a)
        .cross(new T.Vector3(...p[2]).sub(a))
        .dot(new T.Vector3(...n)) < 0
    )
      p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1])),
      h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(mat, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  }
  const cap = (r: Point[], y: number, mat: T.Material, up = true) => {
    const g = flatPolygon(r.flat(), [], y, 1);
    if (!up) {
      const ix = g.index!;
      for (let i = 0; i < ix.count; i += 3) {
        const t = ix.getX(i + 1);
        ix.setX(i + 1, ix.getX(i + 2));
        ix.setX(i + 2, t);
      }
      g.computeVertexNormals();
    }
    mesh.add(g, mat);
  };
  function surface(
    f: ReturnType<typeof facadeFrame>,
    a: number,
    c: number,
    y: number,
    h: number,
    d: number,
    mat: T.Material,
  ) {
    if (c - a < 1e-5 || h - y < 1e-5) return;
    quad(
      mat,
      [f.p(a, y, d), f.p(c, y, d), f.p(c, h, d), f.p(a, h, d)],
      [f.outward[0], 0, f.outward[1]],
    );
  }
  function window(
    f: ReturnType<typeof facadeFrame>,
    a: number,
    c: number,
    y: number,
    h: number,
    depth: number,
  ) {
    surface(f, a, c, y, h, depth, m.glass);
    surface(f, a, c, y, h, depth + 0.045, m.dark);
    const along = new T.Vector3(...f.p(1, 0)).sub(new T.Vector3(...f.p(0, 0)));
    quad(
      m.stone,
      [f.p(a, y), f.p(a, y, depth), f.p(a, h, depth), f.p(a, h)],
      [along.x, 0, along.z],
    );
    quad(
      m.stone,
      [f.p(c, y), f.p(c, y, depth), f.p(c, h, depth), f.p(c, h)],
      [-along.x, 0, -along.z],
    );
    quad(
      m.stone,
      [f.p(a, y), f.p(c, y), f.p(c, y, depth), f.p(a, y, depth)],
      [0, 1, 0],
    );
    quad(
      m.stone,
      [f.p(a, h), f.p(c, h), f.p(c, h, depth), f.p(a, h, depth)],
      [0, -1, 0],
    );
    surface(
      f,
      (a + c) / 2 - 0.035,
      (a + c) / 2 + 0.035,
      y,
      h,
      depth - 0.04,
      m.metal,
    );
    surface(f, a, c, h - 0.55, h - 0.5, depth - 0.04, m.metal);
  }
  function stoneFace(
    f: ReturnType<typeof facadeFrame>,
    low: number,
    high: number,
    club: boolean,
  ) {
    const width = club ? 3.65 : 3.05,
      cols = Math.max(1, Math.round(f.length / width));
    const levels = [
      low,
      ...Array.from({ length: 31 }, (_, i) => terminalCityLevel(i)).filter(
        (y) => y > low + 0.1 && y < high - 0.1,
      ),
      high,
    ];
    for (let k = 0; k < levels.length - 1; k++) {
      const y = levels[k],
        h = levels[k + 1];
      for (let j = 0; j < cols; j++) {
        const a = (j * f.length) / cols,
          c = ((j + 1) * f.length) / cols,
          pad = club ? 0.52 : 0.43;
        const sill = y + (club ? 0.9 : 0.72),
          head = h - (club ? 0.75 : 0.6);
        if (head - sill < 0.6) {
          surface(f, a, c, y, h, 0, m.stone);
          continue;
        }
        surface(f, a, a + pad, y, h, 0, m.stone);
        surface(f, c - pad, c, y, h, 0, m.stone);
        surface(f, a + pad, c - pad, y, sill, 0, m.stone);
        surface(f, a + pad, c - pad, head, h, 0, m.stone);
        window(f, a + pad, c - pad, sill, head, club ? 0.44 : 0.22);
      }
      // Recessed mineral course with a narrow physical weathering ledge.
      surface(f, 0, f.length, h - 0.16, h - 0.08, -0.035, m.spandrel);
    }
  }
  function glassFace(
    f: ReturnType<typeof facadeFrame>,
    low: number,
    high: number,
  ) {
    surface(f, 0, f.length, low, high, 0.11, m.dark);
    surface(f, 0, f.length, low, high, 0.065, m.glass);
    const cols = Math.max(1, Math.round(f.length / 1.38));
    for (let j = 0; j <= cols; j++) {
      const q = (j * f.length) / cols;
      surface(
        f,
        Math.max(0, q - 0.045),
        Math.min(f.length, q + 0.045),
        low,
        high,
        0,
        m.metal,
      );
    }
    const levels = [
      low,
      ...Array.from({ length: 31 }, (_, i) => terminalCityLevel(i)).filter(
        (y) => y > low + 0.01 && y < high - 0.01,
      ),
      high,
    ];
    for (let k = 0; k < levels.length - 1; k++) {
      const y = levels[k],
        h = levels[k + 1];
      surface(f, 0, f.length, y, Math.min(y + 0.53, h), 0.035, m.spandrel);
      for (const yy of [y + 0.06, y + 0.46, h - 0.08])
        if (yy < high)
          surface(
            f,
            0,
            f.length,
            yy,
            Math.min(yy + 0.045, high),
            -0.018,
            m.metal,
          );
    }
  }
  // Full mapped closed ground boundary: existing collision is never hidden in a
  // walkable-looking forecourt. Photo-derived recesses are behind solid sills.
  cap(TERMINAL_CITY_RING, 0, m.dark, false);
  cap(TERMINAL_CITY_RING, TERMINAL_CITY_CLUB_HEIGHT, m.roof);
  for (let i = 0; i < 4; i++) {
    const f = facadeFrame(
      TERMINAL_CITY_RING[i],
      TERMINAL_CITY_RING[(i + 1) % 4],
    );
    if (i === 3) {
      glassFace(f, 0.48, TERMINAL_CITY_CLUB_HEIGHT);
      // Hastings view establishes a taller column-led glazed base, distinct from
      // the club's punched limestone frontage. Closed glazing retains collision.
      for (let q = 2; q < f.length; q += 5.8)
        mesh.beam(f.p(q, 0.48, -0.08), f.p(q, 10.97, -0.08), 0.19, m.stone, 12);
    } else stoneFace(f, 0, TERMINAL_CITY_CLUB_HEIGHT, true);
    surface(f, 0, f.length, 0, 0.48, 0, m.stone);
    surface(
      f,
      0,
      f.length,
      TERMINAL_CITY_CLUB_HEIGHT - 0.38,
      TERMINAL_CITY_CLUB_HEIGHT,
      -0.08,
      m.stone,
    );
  }
  function tower(r: Point[], low: number, high: number) {
    r = terminalCityBowedRing(r);
    const world = r.map((p) => terminalCityPoint(...p));
    cap(world, high, m.roof);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        c = r[(i + 1) % r.length],
        f = facadeFrame(world[i], world[(i + 1) % r.length]);
      // Cordova-facing stepped end is limestone; glazed long face and Hastings end.
      const stone = (a[0] > 30 && c[0] > 30) || (a[1] > 20 && c[1] > 20);
      if (stone) stoneFace(f, low, high, false);
      else glassFace(f, low, high);
    }
  }
  tower(TERMINAL_CITY_TOWER_UV, TERMINAL_CITY_CLUB_HEIGHT, 77.05);
  tower(TERMINAL_CITY_UPPER_UV, 77.05, 91.57);
  tower(TERMINAL_CITY_TOP_UV, 91.57, 94.94);
  // Thin bowed crown, standing on connected columns above the occupied roof.
  // Curvature, cantilever and column rhythm are photographic estimates.
  const front: Point[] = [],
    rear: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24,
      u = 2.3 + 35.7 * t,
      v = 0.35 - 1.1 * Math.sin(Math.PI * t);
    front.push(terminalCityPoint(u, v));
    rear.push(terminalCityPoint(u, v + 5.2));
  }
  const blade = [...front, ...rear.reverse()];
  cap(blade, 99, m.metal);
  cap(blade, 98.68, m.dark, false);
  for (let i = 0; i < blade.length; i++) {
    const f = facadeFrame(blade[i], blade[(i + 1) % blade.length]);
    surface(f, 0, f.length, 98.68, 99, 0, m.metal);
  }
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.3) / 7.6,
      u = 3 + 33.5 * t,
      v = 2;
    const p = terminalCityPoint(u, v);
    mesh.beam([p[0], 94.94, p[1]], [p[0], 98.68, p[1]], 0.12, m.metal, 8);
  }
  mesh.finish();
  batch.offsetY = saved;
  return true;
}
