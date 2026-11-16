import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import polygonClipping from "polygon-clipping";

/** Handford01 tier hierarchy, fitted estimates within the existing generic ship. */
export const CRUISE_FORWARD = {
  cutZ: 50,
  levels: [
    {
      deck: 2,
      bottom: 21.69,
      sill: 22.12,
      head: 24.22,
      top: 24.85,
      back: 14.6,
      wing: 15.85,
      front: 75.3,
      flare: 0.35,
      panes: 21,
    },
    {
      deck: 3,
      bottom: 24.85,
      sill: 25.08,
      head: 27.23,
      top: 27.9,
      back: 14.25,
      wing: 15.5,
      front: 75.3,
      flare: 0,
      panes: 25,
    },
    {
      deck: 4,
      bottom: 27.9,
      sill: 28.13,
      head: 30.2,
      top: 30.84,
      back: 13.9,
      wing: 13.6,
      front: 72.1,
      flare: 0,
      panes: 19,
    },
  ],
} as const;
type Point = [number, number];
type Vec = [number, number, number];
function plan(
  level: (typeof CRUISE_FORWARD.levels)[number],
  upper = false,
): Point[] {
  const back = level.back,
    wing = level.wing + (upper ? level.flare : 0),
    front = level.front + (upper ? level.flare : 0);
  return [
    [-back, 50],
    [back, 50],
    [back, 53],
    [wing, 67],
    [wing, front - 1],
    [wing - 1, front],
    [-wing + 1, front],
    [-wing, front - 1],
    [-wing, 67],
    [-back, 53],
  ];
}
export function cruiseForwardPlan(index: number, upper = false) {
  return plan(CRUISE_FORWARD.levels[index], upper);
}
class Faces {
  p: number[] = [];
  tri(a: Vec, b: Vec, c: Vec) {
    this.p.push(...a, ...b, ...c);
  }
  quad(a: Vec, b: Vec, c: Vec, d: Vec) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  /** Quad order faces out. Frame depth closes into the sill/head bands. */
  prism(a: Vec, b: Vec, c: Vec, d: Vec, depth: number) {
    const n = new T.Vector3()
      .fromArray(b)
      .sub(new T.Vector3().fromArray(a))
      .cross(new T.Vector3().fromArray(d).sub(new T.Vector3().fromArray(a)))
      .normalize();
    const inner = (p: Vec): Vec => [
      p[0] - n.x * depth,
      p[1] - n.y * depth,
      p[2] - n.z * depth,
    ];
    const aa = inner(a),
      bb = inner(b),
      cc = inner(c),
      dd = inner(d);
    this.quad(a, b, c, d);
    this.quad(dd, cc, bb, aa);
    this.quad(a, aa, bb, b);
    this.quad(c, cc, dd, d);
    // The sill and head bands close both ends; omit hidden overlapping end caps.
  }
  polygon(rings: Point[][], y: number, up = true, rear = false) {
    const contour = rings[0].map((p) => new T.Vector2(...p)),
      holes = rings.slice(1).map((r) => r.map((p) => new T.Vector2(...p)));
    const all = [...contour, ...holes.flat()];
    for (const face of T.ShapeUtils.triangulateShape(contour, holes)) {
      const pts = face.map((i) => all[i]);
      let a: Vec, b: Vec, c: Vec;
      if (rear) {
        a = [pts[0].x, pts[0].y, y];
        b = [pts[1].x, pts[1].y, y];
        c = [pts[2].x, pts[2].y, y];
      } else {
        a = [pts[0].x, y, pts[0].y];
        b = [pts[1].x, y, pts[1].y];
        c = [pts[2].x, y, pts[2].y];
      }
      const normal = new T.Vector3()
        .fromArray(b)
        .sub(new T.Vector3().fromArray(a))
        .cross(new T.Vector3().fromArray(c).sub(new T.Vector3().fromArray(a)));
      if ((rear ? normal.z : normal.y) * (up ? 1 : -1) < 0) [b, c] = [c, b];
      this.tri(a, b, c);
    }
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.computeVertexNormals();
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        new Float32Array((this.p.length / 3) * 2),
        2,
      ),
    );
    return g;
  }
}

/** Clip actual rounded-box triangles in ship coordinates, retaining attributes.
 * Its exact convex section becomes the mating bulkhead; no source positions move. */
function retained(source: T.BufferGeometry) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const p = geometry.getAttribute("position"),
    n = geometry.getAttribute("normal"),
    uv = geometry.getAttribute("uv");
  const pos: number[] = [],
    norm: number[] = [],
    tex: number[] = [],
    section = new Map<string, Point>();
  type Vertex = { p: number[]; n: number[]; uv: number[] };
  const add = (v: Vertex) => {
    pos.push(...v.p);
    norm.push(...v.n);
    tex.push(...v.uv);
  };
  for (let i = 0; i < p.count; i += 3) {
    const poly: Vertex[] = Array.from({ length: 3 }, (_, j) => ({
      p: [p.getX(i + j), p.getY(i + j), p.getZ(i + j)],
      n: [n.getX(i + j), n.getY(i + j), n.getZ(i + j)],
      uv: [uv.getX(i + j), uv.getY(i + j)],
    }));
    const clipped: Vertex[] = [];
    for (let j = 0; j < 3; j++) {
      const a = poly[j],
        b = poly[(j + 1) % 3],
        inside = a.p[2] <= CRUISE_FORWARD.cutZ,
        next = b.p[2] <= CRUISE_FORWARD.cutZ;
      if (inside) clipped.push(a);
      if (inside !== next) {
        const t = (CRUISE_FORWARD.cutZ - a.p[2]) / (b.p[2] - a.p[2]);
        const lerp = (a: number[], b: number[]) =>
          a.map((v, i) => v + (b[i] - v) * t);
        const v = {
          p: lerp(a.p, b.p),
          n: lerp(a.n, b.n),
          uv: lerp(a.uv, b.uv),
        };
        v.p[2] = CRUISE_FORWARD.cutZ;
        clipped.push(v);
        section.set(`${v.p[0].toFixed(7)},${v.p[1].toFixed(7)}`, [
          v.p[0],
          v.p[1],
        ]);
      }
    }
    for (let j = 1; j < clipped.length - 1; j++) {
      add(clipped[0]);
      add(clipped[j]);
      add(clipped[j + 1]);
    }
  }
  const ring = [...section.values()];
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  ring.sort(
    (a, b) => Math.atan2(a[1] - cy, a[0]) - Math.atan2(b[1] - cy, b[0]),
  );
  const cap = new Faces();
  cap.polygon([ring], CRUISE_FORWARD.cutZ, true, true);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(norm, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
  const capGeometry = cap.geometry();
  const capped = mergeGeometries([g, capGeometry])!;
  capGeometry.dispose();
  g.dispose();
  if (geometry !== source) geometry.dispose();
  source.dispose();
  return { geometry: capped, section: ring };
}

export function createCruiseForwardAssembly() {
  const white = new Faces(),
    glass = new Faces(),
    kept: T.BufferGeometry[] = [],
    sections: Point[][] = [];
  for (const level of CRUISE_FORWARD.levels) {
    const k = level.deck,
      length = 199 - k * 13,
      width = 30 - k * 0.7,
      y = 17.1 + k * 3.05,
      z = -5 - k * 3;
    for (const g of [
      new RoundedBoxGeometry(width, 2.8, length, 3, 0.8).translate(0, y, z),
      new RoundedBoxGeometry(width + 0.6, 0.28, length + 0.6, 3, 0.5).translate(
        0,
        y + 1.4,
        z,
      ),
    ]) {
      const part = retained(g);
      kept.push(part.geometry);
      sections.push(part.section);
    }
  }
  const points = (p: Point[], edge: number, y: number, t: number): Vec => {
    const a = p[edge],
      b = p[(edge + 1) % p.length];
    return [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
  };
  for (let k = 0; k < CRUISE_FORWARD.levels.length; k++) {
    const level = CRUISE_FORWARD.levels[k],
      low = plan(level),
      high = plan(level, true);
    for (let edge = 1; edge < low.length; edge++) {
      const wall = (a: number, b: number, lo: Point[], hi: Point[]) =>
        white.quad(
          points(lo, edge, a, 0),
          points(hi, edge, b, 0),
          points(hi, edge, b, 1),
          points(lo, edge, a, 1),
        );
      wall(level.bottom, level.sill, low, low);
      wall(level.head, level.top, high, high);
      if (edge === 1 || edge === 9) {
        wall(level.sill, level.head, low, high);
        continue;
      }
      const length = Math.hypot(
        low[(edge + 1) % low.length][0] - low[edge][0],
        low[(edge + 1) % low.length][1] - low[edge][1],
      );
      const panes =
        edge === 5 ? level.panes : Math.max(1, Math.round(length / 3.4));
      const half = 0.045 / length;
      for (let j = 0; j < panes; j++) {
        const a = j / panes + half,
          b = (j + 1) / panes - half;
        const vertices = [
          points(low, edge, level.sill, a),
          points(high, edge, level.head, a),
          points(high, edge, level.head, b),
          points(low, edge, level.sill, b),
        ];
        const n = new T.Vector3()
          .fromArray(vertices[1])
          .sub(new T.Vector3().fromArray(vertices[0]))
          .cross(
            new T.Vector3()
              .fromArray(vertices[3])
              .sub(new T.Vector3().fromArray(vertices[0])),
          )
          .normalize();
        const inset = vertices.map(
          (p) => [p[0] - n.x * 0.1, p[1] - n.y * 0.1, p[2] - n.z * 0.1] as Vec,
        );
        // This opaque exterior pane closes the enclosing volume at its reveal.
        // Interior/back faces would add hidden overdraw, not visible depth.
        glass.quad(inset[0], inset[1], inset[2], inset[3]);
        // Closed reveals connect the recessed pane to the frame plane.
        for (let q = 0; q < 4; q++)
          white.quad(
            vertices[q],
            inset[q],
            inset[(q + 1) % 4],
            vertices[(q + 1) % 4],
          );
      }
      for (let j = 0; j <= panes; j++) {
        const a = Math.max(0, j / panes - half),
          b = Math.min(1, j / panes + half);
        white.prism(
          points(low, edge, level.sill, a),
          points(high, edge, level.head, a),
          points(high, edge, level.head, b),
          points(low, edge, level.sill, b),
          0.16,
        );
      }
    }
    if (k === 0) white.polygon([low], level.bottom, false);
    const next = CRUISE_FORWARD.levels[k + 1];
    const exposed = next
      ? polygonClipping.difference([high], [plan(next)])
      : [[high]];
    for (const polygon of exposed)
      white.polygon(polygon as Point[][], level.top, true);
  }
  // Exact clipped original bulkheads own their rear areas. Fill only the
  // remainder of the stepped rear face, avoiding duplicate mating caps.
  const rear = CRUISE_FORWARD.levels.map(
    (l) =>
      [
        [
          [-l.back, l.bottom],
          [l.back, l.bottom],
          [l.back, l.top],
          [-l.back, l.top],
        ],
      ] as Point[][],
  );
  const covered = polygonClipping.union(
    ...(sections.map((s) => [s]) as [Point[][], ...Point[][][]]),
  );
  const back = polygonClipping.difference(
    polygonClipping.union(...(rear as [Point[][], ...Point[][][]])),
    covered,
  );
  for (const polygon of back)
    white.polygon(polygon as Point[][], CRUISE_FORWARD.cutZ, false, true);
  const addedWhite = white.geometry(),
    glassGeometry = glass.geometry();
  const retainedTriangles = kept.reduce(
    (n, g) => n + g.getAttribute("position").count / 3,
    0,
  );
  const geometry = mergeGeometries([...kept, addedWhite])!;
  const addedTriangles =
    (addedWhite.getAttribute("position").count +
      glassGeometry.getAttribute("position").count) /
    3;
  kept.forEach((g) => g.dispose());
  addedWhite.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  glassGeometry.computeBoundingBox();
  glassGeometry.computeBoundingSphere();
  return {
    white: geometry,
    glass: glassGeometry,
    stats: {
      addedTriangles,
      retainedTriangles,
      triangles:
        geometry.getAttribute("position").count / 3 +
        glassGeometry.getAttribute("position").count / 3,
    },
  };
}
