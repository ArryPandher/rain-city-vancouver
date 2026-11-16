import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import {
  PAN_PACIFIC_TOWER as D,
  PAN_PACIFIC_TOWER_WINDOW_CENTRES as WINDOW_Y,
  towerPlan,
  type PanPacificTowerFace,
} from "./pan-pacific-tower-data";

export type PanPacificTowerPart =
  | "concrete"
  | "frame"
  | "backing"
  | "roof"
  | "glass";
export type PanPacificTowerGeometry = Record<
  PanPacificTowerPart,
  T.BufferGeometry
> & {
  stats: {
    triangles: number;
    panes: number;
    punchedOpenings: number;
    geometryBatches: number;
    planVertices: number;
  };
};
const ROLES: PanPacificTowerPart[] = [
  "concrete",
  "frame",
  "backing",
  "roof",
  "glass",
];

/** Full closed tower, replacing the guarded source tower only. No base cap:
 * the existing upper podium surface remains its one floor/contact surface. */
export function createPanPacificTowerGeometry(): PanPacificTowerGeometry {
  const bins: Record<PanPacificTowerPart, T.BufferGeometry[]> = {
    concrete: [],
    frame: [],
    backing: [],
    roof: [],
    glass: [],
  };
  let panes = 0,
    punchedOpenings = 0;
  function triangle(
    role: PanPacificTowerPart,
    vs: T.Vector3[],
    normal?: T.Vector3,
  ) {
    let n = vs[1]
      .clone()
      .sub(vs[0])
      .cross(vs[2].clone().sub(vs[0]))
      .normalize();
    if (n.lengthSq() < 0.5) return;
    if (normal && n.dot(normal) < 0) {
      vs = [vs[0], vs[2], vs[1]];
      n.negate();
    }
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        vs.flatMap((v) => v.toArray()),
        3,
      ),
    );
    g.setAttribute(
      "normal",
      new T.Float32BufferAttribute(
        vs.flatMap(() => n.toArray()),
        3,
      ),
    );
    g.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    g.setIndex([0, 1, 2]);
    bins[role].push(g);
  }
  function quad(
    role: PanPacificTowerPart,
    vs: T.Vector3[],
    normal?: T.Vector3,
  ) {
    triangle(role, [vs[0], vs[1], vs[2]], normal);
    triangle(role, [vs[0], vs[2], vs[3]], normal);
  }
  function faceTools(a: readonly number[], b: readonly number[]) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along = new T.Vector3(
      (b[0] - a[0]) / length,
      0,
      (b[1] - a[1]) / length,
    );
    const normal = new T.Vector3(along.z, 0, -along.x);
    const at = (s: number, y: number, out = 0) =>
      new T.Vector3(
        a[0] + along.x * s + normal.x * out,
        y,
        a[1] + along.z * s + normal.z * out,
      );
    const plane = (
      role: PanPacificTowerPart,
      l: number,
      r: number,
      lo: number,
      hi: number,
      out = 0,
    ) => {
      if (r <= l || hi <= lo) return;
      quad(
        role,
        [at(l, lo, out), at(r, lo, out), at(r, hi, out), at(l, hi, out)],
        normal,
      );
    };
    const box = (
      role: PanPacificTowerPart,
      l: number,
      r: number,
      lo: number,
      hi: number,
      inside: number,
      outside: number,
    ) => {
      if (r <= l || hi <= lo || outside <= inside) return;
      plane(role, l, r, lo, hi, outside);
      quad(
        role,
        [
          at(l, lo, inside),
          at(r, lo, inside),
          at(r, hi, inside),
          at(l, hi, inside),
        ],
        normal.clone().negate(),
      );
      for (const [s, n] of [
        [l, along.clone().negate()],
        [r, along],
      ] as const)
        quad(
          role,
          [
            at(s, lo, inside),
            at(s, lo, outside),
            at(s, hi, outside),
            at(s, hi, inside),
          ],
          n,
        );
      for (const [y, sign] of [
        [lo, -1],
        [hi, 1],
      ])
        quad(
          role,
          [
            at(l, y, inside),
            at(r, y, inside),
            at(r, y, outside),
            at(l, y, outside),
          ],
          new T.Vector3(0, sign, 0),
        );
    };
    return { length, along, normal, at, plane, box };
  }
  type FaceTools = ReturnType<typeof faceTools>;
  const gridY = Array.from(
    { length: D.nearMajorRows + 1 },
    (_, i) => D.base + ((D.crownStart - D.base) * i) / D.nearMajorRows,
  );
  function curtain(
    f: FaceTools,
    l: number,
    r: number,
    lo: number,
    hi: number,
    boundaries?: number[],
  ) {
    if (hi <= lo) return;
    f.plane("backing", l, r, lo, hi, -D.backingInset);
    const count = Math.max(1, Math.ceil((r - l) / 1.9));
    const xs =
      boundaries ??
      Array.from({ length: count + 1 }, (_, i) => l + ((r - l) * i) / count);
    const ys = [lo, ...gridY.filter((y) => y > lo + 0.02 && y < hi - 0.02), hi];
    for (let j = 1; j < ys.length; j++) {
      const bottom = ys[j - 1],
        top = ys[j],
        transom = bottom + (top - bottom) * D.nearTransomFraction;
      for (let i = 1; i < xs.length; i++)
        for (const [y0, y1] of [
          [bottom + 0.035, transom - 0.012],
          [transom + 0.012, top - 0.035],
        ]) {
          f.plane(
            "glass",
            xs[i - 1] + 0.028,
            xs[i] - 0.028,
            y0,
            y1,
            -D.glassInset,
          );
          panes++;
        }
      f.box("frame", l, r, transom - 0.014, transom + 0.014, -0.155, 0.025);
    }
    for (const x of xs)
      f.box(
        "frame",
        Math.max(l, x - 0.028),
        Math.min(r, x + 0.028),
        lo,
        hi,
        -0.17,
        0.035,
      );
    for (const y of ys)
      f.box(
        "frame",
        l,
        r,
        Math.max(lo, y - 0.033),
        Math.min(hi, y + 0.033),
        -0.17,
        0.035,
      );
    for (const [x, n] of [
      [l, f.along],
      [r, f.along.clone().negate()],
    ] as const)
      quad(
        "concrete",
        [
          f.at(x, lo, -0.61),
          f.at(x, lo, -0.14),
          f.at(x, hi, -0.14),
          f.at(x, hi, -0.61),
        ],
        n,
      );
    for (const [y, n] of [
      [lo, new T.Vector3(0, 1, 0)],
      [hi, new T.Vector3(0, -1, 0)],
    ] as const) {
      // At the lowest datum the existing source cap closes this cavity.
      // A new upward sill here would duplicate the retained podium surface.
      if (y === D.base && n.y > 0) continue;
      quad(
        "concrete",
        [
          f.at(l, y, -0.61),
          f.at(r, y, -0.61),
          f.at(r, y, -0.14),
          f.at(l, y, -0.14),
        ],
        n,
      );
    }
  }
  function rounded(w: number, h: number, r: number): T.Vector2[] {
    const points: T.Vector2[] = [];
    for (const [cx, cy, start] of [
      [w / 2 - r, -h / 2 + r, -Math.PI / 2],
      [w / 2 - r, h / 2 - r, 0],
      [-w / 2 + r, h / 2 - r, Math.PI / 2],
      [-w / 2 + r, -h / 2 + r, Math.PI],
    ])
      for (let j = 0; j < 3; j++) {
        const angle = start + (j * Math.PI) / 4;
        points.push(
          new T.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)),
        );
      }
    return points;
  }
  function punchedCell(
    f: FaceTools,
    l: number,
    r: number,
    lo: number,
    hi: number,
    cy: number,
  ) {
    const mid = (l + r) / 2,
      w = Math.min((r - l) * 0.72, 1.82),
      h = Math.min(1.94, (hi - lo) * 0.59);
    if (w < 0.38 || h < 0.55) {
      f.plane("concrete", l, r, lo, hi, 0.04);
      return;
    }
    const opening = rounded(w, h, Math.min(0.12, w * 0.12)),
      inner = rounded(w - 0.075, h - 0.075, Math.min(0.1, w * 0.1));
    const innerAt = (v: T.Vector2, out: number) =>
      f.at(mid + v.x, cy + v.y, out);
    const outerCorners = [
      f.at(r, lo, 0.04),
      f.at(r, hi, 0.04),
      f.at(l, hi, 0.04),
      f.at(l, lo, 0.04),
    ];
    for (let i = 0; i < opening.length; i++) {
      const j = (i + 1) % opening.length,
        ci = Math.floor(i / 3),
        cj = Math.floor(j / 3);
      if (ci === cj)
        triangle(
          "concrete",
          [
            outerCorners[ci],
            innerAt(opening[j], 0.04),
            innerAt(opening[i], 0.04),
          ],
          f.normal,
        );
      else
        quad(
          "concrete",
          [
            outerCorners[ci],
            outerCorners[cj],
            innerAt(opening[j], 0.04),
            innerAt(opening[i], 0.04),
          ],
          f.normal,
        );
      const cavityNormal = f.along
        .clone()
        .multiplyScalar(-(opening[i].x + opening[j].x) / 2)
        .add(new T.Vector3(0, -(opening[i].y + opening[j].y) / 2, 0))
        .normalize();
      quad(
        "concrete",
        [
          innerAt(opening[i], 0.04),
          innerAt(opening[j], 0.04),
          innerAt(opening[j], -0.1),
          innerAt(opening[i], -0.1),
        ],
        cavityNormal,
      );
      quad(
        "frame",
        [
          innerAt(opening[i], -0.1),
          innerAt(opening[j], -0.1),
          innerAt(inner[j], -0.1),
          innerAt(inner[i], -0.1),
        ],
        f.normal,
      );
    }
    for (let i = 1; i < inner.length - 1; i++)
      triangle(
        "glass",
        [
          innerAt(inner[0], -0.14),
          innerAt(inner[i], -0.14),
          innerAt(inner[i + 1], -0.14),
        ],
        f.normal,
      );
    f.box(
      "frame",
      mid - 0.023,
      mid + 0.023,
      cy - h / 2 + 0.035,
      cy + h / 2 - 0.035,
      -0.155,
      -0.09,
    );
    f.plane("backing", l, r, lo, hi, -0.61);
    panes += 2;
    punchedOpenings++;
  }
  function pale(f: FaceTools, l: number, r: number, lo: number, hi: number) {
    const ys = WINDOW_Y.filter((y) => y > lo + 0.4 && y < hi - 0.4);
    if (!ys.length) {
      f.box("concrete", l, r, lo, hi, -0.61, 0.04);
      return;
    }
    for (let i = 0; i < ys.length; i++) {
      const low = i === 0 ? lo : (ys[i - 1] + ys[i]) / 2,
        high = i === ys.length - 1 ? hi : (ys[i] + ys[i + 1]) / 2;
      punchedCell(f, l, r, low, high, ys[i]);
    }
  }
  const rings = D.levels.map((level) =>
    towerPlan(level.noseDepth, level.noseWidth),
  );
  for (let k = 0; k < D.levels.length; k++) {
    const level = D.levels[k],
      ring = rings[k],
      crown = level.bottom >= D.crownStart;
    for (let i = 0; i < ring.length; i++) {
      const va = ring[i],
        vb = ring[(i + 1) % ring.length],
        f = faceTools(va.point, vb.point),
        face = va.face;
      const lo = level.bottom,
        hi = level.top;
      if (crown) {
        curtain(f, 0, f.length, lo, hi);
        continue;
      }
      if (face === "near") {
        const bounds = [...D.nearPanePixels]
          .reverse()
          .map((x) => ((868 - x) / (868 - 571)) * f.length);
        curtain(f, 0, f.length, lo, hi, bounds);
        continue;
      }
      if (face === "rear" || face === "return") {
        curtain(f, 0, f.length, lo, hi);
        continue;
      }
      const count =
        face === "nose" || face === "spine"
          ? 1
          : Math.max(1, Math.round(f.length / 2.13));
      for (let j = 0; j < count; j++) {
        const l = (f.length * j) / count,
          r = (f.length * (j + 1)) / count;
        if (
          face === "southeast" &&
          1 - (j + 0.5) / count < D.southeastPaleStep
        ) {
          curtain(f, l, r, lo, Math.min(hi, D.southeastNearPaleBottom));
          pale(f, l, r, Math.max(lo, D.southeastNearPaleBottom), hi);
        } else pale(f, l, r, lo, hi);
      }
    }
  }
  // Seal the millimetre-wide skin wedges at every curved/faceted corner.
  // Independent outward facet offsets must not leave an open vertical slit.
  for (let k = 0; k < rings.length; k++) {
    const ring = rings[k],
      level = D.levels[k];
    for (let i = 0; i < ring.length; i++) {
      const prev = ring[(i + ring.length - 1) % ring.length],
        v = ring[i],
        next = ring[(i + 1) % ring.length];
      const pface = faceTools(prev.point, v.point),
        nface = faceTools(v.point, next.point);
      const p0 = pface.at(pface.length, level.bottom, 0.04),
        p1 = nface.at(0, level.bottom, 0.04);
      if (p0.distanceTo(p1) < 0.00001) continue;
      const role: PanPacificTowerPart =
        (v.face === "nose" ||
          v.face === "northwest" ||
          v.face === "southeast") &&
        level.top <= D.crownStart
          ? "concrete"
          : "frame";
      quad(
        role,
        [
          p0,
          p1,
          new T.Vector3(p1.x, level.top, p1.z),
          new T.Vector3(p0.x, level.top, p0.z),
        ],
        pface.normal.clone().add(nface.normal).normalize(),
      );
    }
  }
  // Real terrace surfaces only between nested nose footprints. Shared point
  // counts preserve continuous seam contact; unchanged head produces no slab.
  for (let k = 0; k < 2; k++) {
    const outer = rings[k],
      inner = rings[k + 1],
      y = D.levels[k].top;
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length,
        a = outer[i].point,
        b = outer[j].point,
        c = inner[j].point,
        d = inner[i].point;
      if (
        Math.hypot(a[0] - d[0], a[1] - d[1]) +
          Math.hypot(b[0] - c[0], b[1] - c[1]) <
        0.01
      )
        continue;
      const p = (v: readonly number[], h: number) =>
        new T.Vector3(v[0], h, v[1]);
      quad(
        "concrete",
        [p(a, y), p(b, y), p(c, y), p(d, y)],
        new T.Vector3(0, 1, 0),
      );
      const f = faceTools(a, b);
      f.box("concrete", 0, f.length, y - 0.16, y, -0.16, 0.04);
      f.box("frame", 0, f.length, y + 1.01, y + 1.055, -0.09, -0.04);
      f.box("frame", 0, f.length, y + 0.48, y + 0.505, -0.09, -0.05);
      const n = Math.max(1, Math.ceil(f.length / 2));
      for (let j = 0; j <= n; j++) {
        const x = (f.length * j) / n;
        f.box(
          "frame",
          Math.max(0, x - 0.022),
          Math.min(f.length, x + 0.022),
          y + 0.01,
          y + 1.04,
          -0.09,
          -0.04,
        );
      }
    }
  }
  const top = rings[3],
    contour = top.map((v) => new T.Vector2(v.point[0], v.point[1]));
  const indices = T.ShapeUtils.triangulateShape(contour, []);
  for (const face of indices)
    for (const [y, sign] of [
      [D.mainRoof, 1],
      [D.mainRoof - 0.12, -1],
    ])
      triangle(
        "roof",
        face.map((i) => new T.Vector3(contour[i].x, y, contour[i].y)),
        new T.Vector3(0, sign, 0),
      );
  for (let i = 0; i < top.length; i++) {
    const f = faceTools(top[i].point, top[(i + 1) % top.length].point);
    f.box(
      "frame",
      0,
      f.length,
      D.mainRoof - 0.06,
      D.mainRoof + 0.035,
      -0.12,
      0.045,
    );
    f.box(
      "frame",
      0,
      f.length,
      D.mainRoof + 0.84,
      D.mainRoof + 0.875,
      -0.11,
      -0.06,
    );
    const n = Math.max(1, Math.ceil(f.length / 2.2));
    for (let j = 0; j <= n; j++) {
      const x = (f.length * j) / n;
      f.box(
        "frame",
        Math.max(0, x - 0.02),
        Math.min(f.length, x + 0.02),
        D.mainRoof,
        D.mainRoof + 0.87,
        -0.11,
        -0.06,
      );
    }
  }
  // Small low barrel crown traced in Handford20, not the old broad hemisphere.
  // Its unseen depth is estimated. One closed matte object, no arbitrary HVAC.
  const a = D.planControls[0],
    b = D.planControls[1];
  const across = new T.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize();
  const depth = new T.Vector3(-across.z, 0, across.x);
  const center = new T.Vector3(
    T.MathUtils.lerp(b[0], a[0], D.crown.nearFaceU),
    D.mainRoof,
    T.MathUtils.lerp(b[1], a[1], D.crown.nearFaceU),
  ).addScaledVector(depth, D.crown.inset);
  const crownAt = (t: number, v: number) =>
    center
      .clone()
      .addScaledVector(across, (t - 0.5) * D.crown.width)
      .addScaledVector(depth, v * D.crown.depth)
      .add(
        new T.Vector3(
          0,
          D.crown.height * Math.pow(Math.sin(Math.PI * t), 0.65),
          0,
        ),
      );
  for (let i = 0; i < 16; i++) {
    const l = i / 16,
      r = (i + 1) / 16;
    quad(
      "roof",
      [crownAt(l, -0.5), crownAt(r, -0.5), crownAt(r, 0.5), crownAt(l, 0.5)],
      new T.Vector3(0, 1, 0),
    );
    for (const side of [-0.5, 0.5]) {
      const a = crownAt(l, side),
        b = crownAt(r, side);
      quad(
        "roof",
        [
          new T.Vector3(a.x, D.mainRoof, a.z),
          new T.Vector3(b.x, D.mainRoof, b.z),
          b,
          a,
        ],
        depth.clone().multiplyScalar(Math.sign(side)),
      );
    }
  }
  const result = {} as PanPacificTowerGeometry;
  let triangles = 0;
  for (const role of ROLES) {
    const g = mergeGeometries(bins[role], false);
    if (!g) throw new Error(`Tower ${role} geometry merge failed`);
    bins[role].forEach((part) => part.dispose());
    landmarkSurfaceUV(g, [1, 1]);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    result[role] = g;
    triangles += (g.index?.count ?? g.attributes.position.count) / 3;
  }
  result.stats = {
    triangles,
    panes,
    punchedOpenings,
    geometryBatches: ROLES.length,
    planVertices: top.length,
  };
  return result;
}
