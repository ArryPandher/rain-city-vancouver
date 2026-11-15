import * as T from "three";
import type { Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { WaterfrontCentreMaterials } from "./waterfront-centre-materials";
import {
  WATERFRONT_CENTRE_ID as ID,
  WATERFRONT_CENTRE_RING as ring,
  WATERFRONT_CENTRE_HEIGHT as height,
  WATERFRONT_CENTRE_ORIGIN as centre,
  waterfrontTowerRing,
  waterfrontLevel,
} from "./waterfront-centre-site";
export type { WaterfrontCentreMaterials } from "./waterfront-centre-materials";
/** Original photo-guided exterior. Only the mapped office building is replaced;
 * heights/setbacks between source anchors are explicitly authored estimates. */
export function buildWaterfrontCentre(
  batch: Batcher,
  b: { id: string; pts: number[] },
  m: WaterfrontCentreMaterials,
): boolean {
  if (b.id !== ID) return false;
  // Authored elevations are relative to the caller's building datum. Batcher
  // adds that datum once to both immediate pieces and accumulated facade quads.
  const mesh = new ArchitecturalMesh(batch, ...centre);
  const quad = (mat: T.Material, p: Vertex3[], normal: Vertex3) => {
    const a = new T.Vector3(...p[0]),
      cross = new T.Vector3(...p[1])
        .sub(a)
        .cross(new T.Vector3(...p[2]).sub(a));
    if (cross.dot(new T.Vector3(...normal)) < 0) p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1])),
      h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(mat, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  };
  const box = (
    p: Vertex3,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    yaw = 0,
  ) => {
    const g = new T.BoxGeometry(w, h, d),
      pos = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      uv = g.getAttribute("uv");
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(n.getX(i)),
        ay = Math.abs(n.getY(i));
      uv.setXY(
        i,
        ax > 0.5 ? pos.getZ(i) : pos.getX(i),
        ay > 0.5 ? pos.getZ(i) : pos.getY(i),
      );
    }
    g.rotateY(yaw);
    g.translate(...p);
    mesh.add(g, mat);
  };
  const cap = (r: Point[], y: number, mat: T.Material) =>
    mesh.add(flatPolygon(r.flat(), [], y, 1), mat);
  // Closed mapped-footprint footing makes the unchanged collision boundary
  // tangible beneath the inset lobby and curved corner; no walkable forecourt.
  cap(ring, 0.85, m.stone);
  for (let i = 0; i < ring.length; i++) {
    const f = facadeFrame(ring[i], ring[(i + 1) % ring.length]);
    quad(
      m.stone,
      [f.p(0, 0), f.p(f.length, 0), f.p(f.length, 0.85), f.p(0, 0.85)],
      [f.outward[0], 0, f.outward[1]],
    );
  }
  const tower = waterfrontTowerRing();
  // Closed opaque-backed main mass. No separate generic podium/tower shell.
  cap(tower, height, m.roof);
  cap(tower, 0, m.dark);
  const glassP: number[] = [],
    glassN: number[] = [],
    glassUV: number[] = [],
    glassIX: number[] = [];
  const glassQuad = (p: Vertex3[], normals: Vertex3[]) => {
    const base = glassP.length / 3,
      a = new T.Vector3(...p[0]);
    if (
      new T.Vector3(...p[1])
        .sub(a)
        .cross(new T.Vector3(...p[2]).sub(a))
        .dot(new T.Vector3(...normals[0])) < 0
    ) {
      p = [p[0], p[3], p[2], p[1]];
      normals = [normals[0], normals[3], normals[2], normals[1]];
    }
    glassP.push(...p.flat());
    glassN.push(...normals.flat());
    glassUV.push(0, 0, 1, 0, 1, 1, 0, 1);
    glassIX.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const edgeNormals = tower.map((a, i) => {
    const b = tower[(i + 1) % tower.length],
      f = facadeFrame(a, b);
    return new T.Vector3(f.outward[0], 0, f.outward[1]);
  });
  let curvedDistance = 0,
    nextCurveColumn = 5;
  const curveLength = tower
    .slice(6)
    .reduce(
      (sum, p, j) =>
        sum +
        Math.hypot(
          tower[(j + 7) % tower.length][0] - p[0],
          tower[(j + 7) % tower.length][1] - p[1],
        ),
      0,
    );
  for (let i = 0; i < tower.length; i++) {
    const f = facadeFrame(tower[i], tower[(i + 1) % tower.length]),
      n: Vertex3 = [...([f.outward[0], 0, f.outward[1]] as Vertex3)];
    quad(
      m.dark,
      [
        f.p(0, 0, 0.85),
        f.p(f.length, 0, 0.85),
        f.p(f.length, 5.5, 0.85),
        f.p(0, 5.5, 0.85),
      ],
      n,
    );
    quad(
      m.dark,
      [
        f.p(0, 5.5, 0.04),
        f.p(f.length, 5.5, 0.04),
        f.p(f.length, height, 0.04),
        f.p(0, height, 0.04),
      ],
      n,
    );
    const rounded = i >= 6;
    const n0 = rounded
      ? edgeNormals[(i + tower.length - 1) % tower.length]
          .clone()
          .add(edgeNormals[i])
          .normalize()
      : edgeNormals[i];
    const n1 = rounded
      ? edgeNormals[i]
          .clone()
          .add(edgeNormals[(i + 1) % tower.length])
          .normalize()
      : edgeNormals[i];
    const cols = Math.max(1, Math.ceil(f.length / 1.35));
    // Tall ground zone remains a closed shaded lobby, with real support columns.
    quad(
      m.glass,
      [
        f.p(0, 0.18, 0.75),
        f.p(f.length, 0.18, 0.75),
        f.p(f.length, 5.5, 0.75),
        f.p(0, 5.5, 0.75),
      ],
      n,
    );
    for (let j = 0; j < cols; j++) {
      const l = (j * f.length) / cols,
        r = ((j + 1) * f.length) / cols;
      for (let floor = 1; floor < 22; floor++) {
        const lo = waterfrontLevel(floor),
          hi = waterfrontLevel(floor + 1);
        const left = n0
            .clone()
            .lerp(n1, j / cols)
            .normalize()
            .toArray() as Vertex3,
          right = n0
            .clone()
            .lerp(n1, (j + 1) / cols)
            .normalize()
            .toArray() as Vertex3;
        glassQuad(
          [f.p(l, lo + 0.32), f.p(r, lo + 0.32), f.p(r, hi), f.p(l, hi)],
          [left, right, right, left],
        );
      }
      if (!rounded && j % 4 === 0)
        box(
          f.p(l, 2.75, 0.34),
          0.5,
          5.5,
          0.5,
          m.stone,
          -Math.atan2(f.outward[0], -f.outward[1]),
        );
      // Thin metallic lines retain the narrow vertical curtain-wall rhythm.
      quad(
        m.metal,
        [
          f.p(l - 0.026, 5.5, -0.012),
          f.p(l + 0.026, 5.5, -0.012),
          f.p(l + 0.026, height, -0.012),
          f.p(l - 0.026, height, -0.012),
        ],
        n,
      );
    }
    if (rounded) {
      // Structural columns follow physical arc length, not tessellation facets.
      while (
        nextCurveColumn < curvedDistance + f.length &&
        nextCurveColumn < curveLength - 5
      ) {
        box(
          f.p(nextCurveColumn - curvedDistance, 2.75, 0.34),
          0.5,
          5.5,
          0.5,
          m.stone,
          -Math.atan2(f.outward[0], -f.outward[1]),
        );
        nextCurveColumn += 6;
      }
      curvedDistance += f.length;
    }
    for (let floor = 1; floor < 22; floor++) {
      const y = waterfrontLevel(floor);
      quad(
        m.spandrel,
        [
          f.p(0, y),
          f.p(f.length, y),
          f.p(f.length, y + 0.32),
          f.p(0, y + 0.32),
        ],
        n,
      );
      quad(
        m.metal,
        [
          f.p(0, y + 0.3, -0.018),
          f.p(f.length, y + 0.3, -0.018),
          f.p(f.length, y + 0.37, -0.018),
          f.p(0, y + 0.37, -0.018),
        ],
        n,
      );
    }
    quad(
      m.metal,
      [
        f.p(0, height - 0.1, -0.01),
        f.p(f.length, height - 0.1, -0.01),
        f.p(f.length, height, -0.01),
        f.p(0, height, -0.01),
      ],
      n,
    );
  }
  // Pale skirt: square punched windows with real deep reveals, not a white grid
  // over the full tower. Four stepped crests rise away from the rounded corner.
  for (let edge = 0; edge < 6; edge++) {
    const f = facadeFrame(ring[edge], ring[(edge + 1) % ring.length]),
      n: Vertex3 = [f.outward[0], 0, f.outward[1]],
      cols = Math.max(1, Math.round(f.length / 4.6));
    for (let j = 0; j < cols; j++) {
      let rows = 4;
      if (edge === 0) rows = Math.max(0, Math.min(4, j - 1));
      if (edge === 5) rows = Math.max(0, Math.min(4, cols - j - 2));
      // The separate lower eastern corner drum occupies this short edge.
      if (edge === 4) continue;
      if (!rows) continue;
      const l = (j * f.length) / cols,
        r = ((j + 1) * f.length) / cols,
        top = waterfrontLevel(rows + 1),
        depth = 2.35;
      const face = (
        mat: T.Material,
        l: number,
        r: number,
        lo: number,
        hi: number,
        d = 0,
      ) =>
        quad(
          mat,
          [f.p(l, lo, d), f.p(r, lo, d), f.p(r, hi, d), f.p(l, hi, d)],
          n,
        );
      // Closed ground zone; the northern raised approach buries it legitimately.
      face(m.stone, l, r, 0, 5.5);
      if (edge !== 1) {
        face(m.dark, l + 0.55, r - 0.55, 0.4, 4.95, 0.22);
        face(m.glass, l + 0.6, r - 0.6, 0.5, 4.9, -0.015);
      }
      for (let floor = 1; floor <= rows; floor++) {
        const lo = waterfrontLevel(floor),
          hi = waterfrontLevel(floor + 1),
          wl = l + 0.48,
          wr = r - 0.48,
          wy = lo + 0.5,
          wh = hi - 0.5;
        face(m.stone, l, r, lo, wy);
        face(m.stone, l, r, wh, hi);
        face(m.stone, l, wl, wy, wh);
        face(m.stone, wr, r, wy, wh);
        face(m.dark, wl, wr, wy, wh, 0.52);
        face(m.glass, wl + 0.055, wr - 0.055, wy + 0.055, wh - 0.055, 0.43);
        quad(
          m.stone,
          [f.p(wl, wy), f.p(wl, wy, 0.5), f.p(wl, wh, 0.5), f.p(wl, wh)],
          [
            ...([
              -(ring[(edge + 1) % ring.length][0] - ring[edge][0]) / f.length,
              0,
              -(ring[(edge + 1) % ring.length][1] - ring[edge][1]) / f.length,
            ] as Vertex3),
          ].map((v) => -v) as Vertex3,
        );
        quad(
          m.stone,
          [f.p(wr, wy), f.p(wr, wh), f.p(wr, wh, 0.5), f.p(wr, wy, 0.5)],
          [
            -(ring[(edge + 1) % ring.length][0] - ring[edge][0]) / f.length,
            0,
            -(ring[(edge + 1) % ring.length][1] - ring[edge][1]) / f.length,
          ],
        );
        quad(
          m.stone,
          [f.p(wl, wy), f.p(wr, wy), f.p(wr, wy, 0.5), f.p(wl, wy, 0.5)],
          [0, 1, 0],
        );
        quad(
          m.stone,
          [f.p(wl, wh), f.p(wl, wh, 0.5), f.p(wr, wh, 0.5), f.p(wr, wh)],
          [0, -1, 0],
        );
      }
      // Supported ledge and substantial cap, with closed vertical step returns.
      quad(
        m.roof,
        [
          f.p(l, top, 0),
          f.p(r, top, 0),
          f.p(r, top, depth),
          f.p(l, top, depth),
        ],
        [0, 1, 0],
      );
      face(m.stone, l, r, top - 0.25, top);
      for (const [u, sign] of [
        [l, -1],
        [r, 1],
      ])
        quad(
          m.stone,
          [f.p(u, 0), f.p(u, top), f.p(u, top, depth), f.p(u, 0, depth)],
          [
            (sign * (ring[(edge + 1) % ring.length][0] - ring[edge][0])) /
              f.length,
            0,
            (sign * (ring[(edge + 1) % ring.length][1] - ring[edge][1])) /
              f.length,
          ],
        );
      if (m.foliage && rows >= 3 && j % 2 === 0) {
        const yaw = -Math.atan2(f.outward[0], -f.outward[1]);
        box(
          f.p((l + r) / 2, top + 0.18, 0.65),
          Math.max(0.3, r - l - 0.6),
          0.36,
          0.65,
          m.stone,
          yaw,
        );
        box(
          f.p((l + r) / 2, top + 0.37, 0.65),
          Math.max(0.2, r - l - 0.7),
          0.06,
          0.55,
          m.soil,
          yaw,
        );
        box(
          f.p((l + r) / 2, top + 0.57, 0.65),
          Math.max(0.2, r - l - 0.8),
          0.38,
          0.48,
          m.foliage,
          yaw,
        );
      }
    }
  }
  // Separate three-level eastern/Cordova glazed drum fitted inside mapped corner.
  const a = ring[4],
    b5 = ring[5],
    next = ring[6],
    q: Point = [
      b5[0] + (next[0] - b5[0]) * 0.14,
      b5[1] + (next[1] - b5[1]) * 0.14,
    ];
  const arc: Point[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    arc.push([
      (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b5[0] + t * t * q[0],
      (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b5[1] + t * t * q[1],
    ]);
  }
  const drum = [...arc, [centre[0] + 16, centre[1] + 20] as Point];
  cap(drum, 13.7, m.roof);
  for (let i = 0; i < arc.length - 1; i++) {
    const f = facadeFrame(arc[i], arc[i + 1]),
      n: Vertex3 = [f.outward[0], 0, f.outward[1]];
    quad(
      m.glass,
      [f.p(0, 0.2), f.p(f.length, 0.2), f.p(f.length, 13.7), f.p(0, 13.7)],
      n,
    );
    quad(
      m.dark,
      [
        f.p(0, 0, 0.1),
        f.p(f.length, 0, 0.1),
        f.p(f.length, 13.7, 0.1),
        f.p(0, 13.7, 0.1),
      ],
      n,
    );
    for (const y of [4.6, 9.1, 13.6])
      quad(
        m.metal,
        [
          f.p(0, y, -0.025),
          f.p(f.length, y, -0.025),
          f.p(f.length, y + 0.1, -0.025),
          f.p(0, y + 0.1, -0.025),
        ],
        n,
      );
    quad(
      m.metal,
      [
        f.p(0, 0, -0.02),
        f.p(0.07, 0, -0.02),
        f.p(0.07, 13.7, -0.02),
        f.p(0, 13.7, -0.02),
      ],
      n,
    );
  }
  const gg = new T.BufferGeometry()
    .setAttribute("position", new T.Float32BufferAttribute(glassP, 3))
    .setAttribute("normal", new T.Float32BufferAttribute(glassN, 3))
    .setAttribute("uv", new T.Float32BufferAttribute(glassUV, 2));
  gg.setIndex(glassIX);
  mesh.add(gg, m.glass);
  mesh.finish();
  return true;
}
