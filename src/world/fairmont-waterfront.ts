import * as T from "three";
import { segmentPoint, type Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { FairmontWaterfrontMaterials } from "./fairmont-waterfront-materials";
import {
  FAIRMONT_WATERFRONT_ID as ID,
  FAIRMONT_WATERFRONT_RING as ring,
  FAIRMONT_WATERFRONT_PARTS as parts,
  FAIRMONT_WATERFRONT_ORIGIN as centre,
  FAIRMONT_WATERFRONT_CANOPY_RING as canopy,
  FAIRMONT_WATERFRONT_CANOPY_TOP as canopyTop,
  FAIRMONT_WATERFRONT_CANOPY_UNDERSIDE as canopyBottom,
  fairmontWaterfrontPartHeight,
  fairmontWaterfrontLevel,
} from "./fairmont-waterfront-site";
export type { FairmontWaterfrontMaterials } from "./fairmont-waterfront-materials";

/** Whole hotel assembly, separate from Waterfront Centre and Fairmont Pacific Rim. */
export function buildFairmontWaterfront(
  batch: Batcher,
  b: { id: string; pts: number[] },
  m: FairmontWaterfrontMaterials,
) {
  if (b.id !== ID) return false;
  // All authored heights are relative to the caller's building ground datum.
  const mesh = new ArchitecturalMesh(batch, ...centre);
  const quad = (mat: T.Material, p: Vertex3[], normal: Vertex3) => {
    const cross = new T.Vector3(...p[1])
      .sub(new T.Vector3(...p[0]))
      .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    if (cross.dot(new T.Vector3(...normal)) < 0) p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1]));
    const h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(mat, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  };
  const cap = (r: Point[], y: number, mat: T.Material, underside = false) => {
    const g = flatPolygon(r.flat(), [], y, 1);
    if (underside) {
      const ix = g.index!;
      for (let i = 0; i < ix.count; i += 3) {
        const b = ix.getX(i + 1);
        ix.setX(i + 1, ix.getX(i + 2));
        ix.setX(i + 2, b);
      }
      g.computeVertexNormals();
    }
    mesh.add(g, mat);
  };
  const face = (
    f: ReturnType<typeof facadeFrame>,
    mat: T.Material,
    l: number,
    r: number,
    lo: number,
    hi: number,
    depth = 0,
  ) => {
    if (r - l < 0.001 || hi - lo < 0.001) return;
    quad(
      mat,
      [
        f.p(l, lo, depth),
        f.p(r, lo, depth),
        f.p(r, hi, depth),
        f.p(l, hi, depth),
      ],
      [f.outward[0], 0, f.outward[1]],
    );
  };
  const window = (
    f: ReturnType<typeof facadeFrame>,
    l: number,
    r: number,
    lo: number,
    hi: number,
    lobby = false,
  ) => {
    const pier = Math.min(lobby ? 0.42 : 0.24, (r - l) * 0.2);
    const wl = l + pier,
      wr = r - pier,
      low = lo + (lobby ? 0.95 : 0.32),
      high = hi - (lobby ? 1.0 : 0.3);
    const depth = lobby ? 0.7 : 0.32;
    face(f, m.panel, l, r, lo, low);
    face(f, m.panel, l, r, high, hi);
    face(f, m.panel, l, wl, low, high);
    face(f, m.panel, wr, r, low, high);
    // Every opening has four real returns; glazing is ahead of opaque backing.
    const along: Vertex3 = [-f.outward[1], 0, f.outward[0]];
    quad(
      m.panel,
      [f.p(wl, low), f.p(wl, low, depth), f.p(wl, high, depth), f.p(wl, high)],
      along,
    );
    quad(
      m.panel,
      [f.p(wr, low), f.p(wr, high), f.p(wr, high, depth), f.p(wr, low, depth)],
      along.map((v) => -v) as Vertex3,
    );
    quad(
      m.panel,
      [f.p(wl, low), f.p(wr, low), f.p(wr, low, depth), f.p(wl, low, depth)],
      [0, 1, 0],
    );
    quad(
      m.panel,
      [
        f.p(wl, high),
        f.p(wl, high, depth),
        f.p(wr, high, depth),
        f.p(wr, high),
      ],
      [0, -1, 0],
    );
    face(f, m.dark, wl, wr, low, high, depth + 0.08);
    face(f, m.glass, wl, wr, low, high, depth);
    const edge = 0.05;
    face(f, m.metal, wl, wr, low, low + edge, depth - 0.01);
    face(f, m.metal, wl, wr, high - edge, high, depth - 0.01);
    for (const u of [wl, wr - edge, (wl + wr) / 2 - edge / 2])
      face(f, m.metal, u, u + edge, low, high, depth - 0.01);
    if (lobby) face(f, m.metal, wl, wr, 3.9, 4.02, depth - 0.01);
  };
  // Whole mapped base remains closed. The raised Canada Place approach can
  // bury part of this wall; neither the datum nor the collision ring is moved.
  cap(ring, 8, m.roof);
  cap(ring, 0, m.dark);
  for (let i = 0; i < ring.length; i++) {
    const f = facadeFrame(ring[i], ring[(i + 1) % ring.length]);
    const cols = Math.max(1, Math.round(f.length / 5.5));
    for (let j = 0; j < cols; j++)
      window(f, (j * f.length) / cols, ((j + 1) * f.length) / cols, 0, 8, true);
    // Deep, substantial fascia distinguishes the broad podium from room bays.
    face(f, m.panel, 0, f.length, 7.5, 8, -0.035);
  }
  // The MCM Howe view and City roof part 162733 establish this continuous
  // projection. Its estimated section fits the existing sloped street; the
  // cantilever has no posts or new floor inside the public walking route.
  // A single physical sheet is visible from either side. Do not add a reverse
  // duplicate or an opaque ceiling: the owner photo shows transmitted daylight.
  cap(canopy, canopyTop - 0.06, m.canopyGlass);
  const canopyBar = (
    a: Point,
    b: Point,
    y: number,
    width: number,
    height: number,
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    mesh.box(
      [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
      Math.hypot(dx, dz),
      height,
      width,
      m.metal,
      -Math.atan2(dz, dx),
    );
  };
  for (let i = 0; i < canopy.length; i++) {
    const a = canopy[i],
      b = canopy[(i + 1) % canopy.length],
      f = facadeFrame(a, b),
      low = canopyBottom + 0.12,
      high = canopyTop - 0.12;
    face(f, m.metal, 0, f.length, canopyBottom, low);
    face(f, m.metal, 0, f.length, high, canopyTop);
    face(f, m.dark, 0, f.length, low, high, 0.1);
    face(f, m.glass, 0, f.length, low, high, 0.035);
    for (const [y, normal] of [
      [low, [0, 1, 0]],
      [high, [0, -1, 0]],
    ] as const)
      quad(
        m.metal,
        [f.p(0, y), f.p(f.length, y), f.p(f.length, y, 0.1), f.p(0, y, 0.1)],
        [...normal],
      );
    const frames = Math.max(1, Math.round(f.length / 1.35));
    for (let j = 0; j <= frames; j++)
      mesh.box(
        f.p((f.length * j) / frames, (low + high) / 2, 0.03),
        0.055,
        high - low,
        0.06,
        m.metal,
        -Math.atan2(b[1] - a[1], b[0] - a[0]),
      );
    // Keep the buried attachment frame simple; the outer edge carries visible
    // transverse members above head height, beneath the transparent roof sheet.
    if (i >= 1 && i <= 6) continue;
    const beams = Math.max(1, Math.round(f.length / 2.8));
    for (let j = 0; j < beams; j++) {
      const p = f.p(((j + 0.5) * f.length) / beams, 0, 0.08);
      let closest = { x: canopy[1][0], z: canopy[1][1], d: Infinity };
      for (let k = 1; k < 7; k++) {
        const q = segmentPoint(p[0], p[2], ...canopy[k], ...canopy[k + 1]);
        if (q.d < closest.d) closest = q;
      }
      const front: Point = [p[0], p[2]],
        back: Point = [closest.x, closest.z];
      canopyBar(front, back, canopyBottom + 0.08, 0.12, 0.16);
      canopyBar(front, back, canopyTop - 0.035, 0.065, 0.07);
    }
  }
  for (const part of parts) {
    cap(part.ring, part.high, m.roof);
    const levels =
      part.name === "tower"
        ? Array.from({ length: 20 }, (_, i) => fairmontWaterfrontLevel(i + 2))
        : part.name === "crown"
          ? [64, (64 + part.high) / 2, part.high]
          : Array.from(
              { length: Math.round((part.high - 8) / 3) + 1 },
              (_, i) => 8 + i * 3,
            );
    for (let i = 0; i < part.ring.length; i++) {
      const f = facadeFrame(
        part.ring[i],
        part.ring[(i + 1) % part.ring.length],
      );
      const cols = Math.max(
        1,
        Math.round(f.length / (part.name === "crown" ? 1.4 : 3.8)),
      );
      for (let j = 0; j < cols; j++) {
        const l = (j * f.length) / cols,
          r = ((j + 1) * f.length) / cols;
        const outside = f.p((l + r) / 2, 0, -0.07);
        for (let floor = 0; floor < levels.length - 1; floor++) {
          const lo = levels[floor],
            hi = levels[floor + 1];
          if (
            fairmontWaterfrontPartHeight(outside[0], outside[2]) >
            (lo + hi) / 2
          )
            continue;
          if (part.name === "crown") {
            face(f, m.dark, l, r, lo, hi, 0.17);
            face(f, m.glass, l, r, lo, hi, 0.12);
            face(f, m.metal, l, l + Math.min(0.055, (r - l) / 4), lo, hi, 0.07);
            face(f, m.metal, l, r, lo, lo + 0.12, 0.07);
            if (floor === levels.length - 2)
              face(f, m.metal, l, r, hi - 0.12, hi, 0.07);
          } else window(f, l, r, lo, hi);
        }
      }
      if (part.name !== "crown")
        face(f, m.panel, 0, f.length, part.high - 0.2, part.high, -0.025);
    }
  }
  // Planted horizontal roof strips are supported by the existing low wing and
  // podium. They are bounded massing cues, not a current planting inventory.
  for (const [x, z, span] of [
    [400, -471, 7],
    [408, -463, 6],
    [416, -454, 6],
    [425, -445, 5],
  ] as const) {
    if (fairmontWaterfrontPartHeight(x, z) !== 8) continue;
    const size = 1.3,
      g = new T.BoxGeometry(span, 0.38, size);
    g.rotateY(-0.59);
    g.translate(x, 8.19, z);
    mesh.add(g, m.panel);
    const soil = new T.BoxGeometry(span - 0.18, 0.05, size - 0.18);
    soil.rotateY(-0.59);
    soil.translate(x, 8.4, z);
    mesh.add(soil, m.soil);
    for (let j = -1; j <= 1; j++) {
      const leaves = new T.IcosahedronGeometry(0.66, 1);
      leaves.scale(1.65, 0.7, 0.85);
      leaves.translate(x + (j * span) / 3, 8.75, z);
      mesh.add(leaves, m.foliage);
    }
  }
  mesh.finish();
  return true;
}
