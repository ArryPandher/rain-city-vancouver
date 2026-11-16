import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import {
  PAN_PACIFIC_NEAR_PODIUM as D,
  type PanPacificNearPodiumTier,
} from "./pan-pacific-near-podium-data";
export type PanPacificNearPodiumPart =
  | "concrete"
  | "frame"
  | "backing"
  | "soffit"
  | "glass";
export type PanPacificNearPodiumGeometry = Record<
  PanPacificNearPodiumPart,
  T.BufferGeometry
> & { stats: { triangles: number; panes: number; geometryBatches: number } };
const ROLES: PanPacificNearPodiumPart[] = [
  "concrete",
  "frame",
  "backing",
  "soffit",
  "glass",
];
export function panPacificNearPodiumPoint(
  edge: number,
  t: number,
  y: number,
  out = 0,
  tier: PanPacificNearPodiumTier = "lower",
): T.Vector3 {
  const a = D.sourceVertices[edge],
    b = D.sourceVertices[edge + 1],
    scale = D.tiers[tier].scale;
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  return new T.Vector3(
    -132 +
      (T.MathUtils.lerp(a[0], b[0], t) + 132) * scale -
      (dz / length) * out,
    y,
    69 + (T.MathUtils.lerp(a[1], b[1], t) - 69) * scale + (dx / length) * out,
  );
}
/** Closed near return, no new route or floor. Shared face36 datums align the
 * last facet with the completed southeast assembly while tall glazing and a
 * curved pale return replace the original blank wall on the visible facets. */
export function createPanPacificNearPodiumGeometry(): PanPacificNearPodiumGeometry {
  const bins: Record<PanPacificNearPodiumPart, T.BufferGeometry[]> = {
    concrete: [],
    frame: [],
    backing: [],
    soffit: [],
    glass: [],
  };
  let panes = 0;
  function quad(
    role: PanPacificNearPodiumPart,
    vs: T.Vector3[],
    desired?: T.Vector3,
  ) {
    let normal = vs[1]
      .clone()
      .sub(vs[0])
      .cross(vs[2].clone().sub(vs[0]))
      .normalize();
    if (normal.lengthSq() < 0.1) return;
    if (desired && normal.dot(desired) < 0) {
      vs = [vs[0], vs[3], vs[2], vs[1]];
      normal.negate();
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
        vs.flatMap(() => normal.toArray()),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    bins[role].push(g);
  }
  function tools(edge: number, tier: PanPacificNearPodiumTier) {
    const at = (s: number, y: number, out = 0) =>
      panPacificNearPodiumPoint(edge, s / length, y, out, tier);
    const a = panPacificNearPodiumPoint(edge, 0, 0, 0, tier),
      b = panPacificNearPodiumPoint(edge, 1, 0, 0, tier);
    const length = a.distanceTo(b),
      along = b.clone().sub(a).normalize(),
      normal = new T.Vector3(-along.z, 0, along.x);
    function plane(
      role: PanPacificNearPodiumPart,
      l: number,
      r: number,
      lo: number,
      hi: number,
      out: number,
    ) {
      if (r <= l || hi <= lo) return;
      quad(
        role,
        [at(l, lo, out), at(r, lo, out), at(r, hi, out), at(l, hi, out)],
        normal,
      );
    }
    function box(
      role: PanPacificNearPodiumPart,
      l: number,
      r: number,
      lo: number,
      hi: number,
      inside: number,
      outside: number,
    ) {
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
      ]) {
        // Retained source cap is the single inboard upper surface. Only the
        // new outward projecting lip needs an added top face at that height.
        const inner =
          sign > 0 && Math.abs(y - D.tiers[tier].top) < 1e-8
            ? Math.max(0, inside)
            : inside;
        if (inner >= outside) continue;
        quad(
          role,
          [
            at(l, y, inner),
            at(r, y, inner),
            at(r, y, outside),
            at(l, y, outside),
          ],
          new T.Vector3(0, sign, 0),
        );
      }
    }
    return { at, length, normal, along, plane, box };
  }
  type F = ReturnType<typeof tools>;
  function aperture(
    f: F,
    l: number,
    r: number,
    lo: number,
    hi: number,
    transoms: number[] = [],
  ) {
    if (r - l < 0.15 || hi - lo < 0.15) return;
    f.plane("backing", l, r, lo, hi, -D.backingInset);
    const n = Math.max(1, Math.round((r - l) / 1.32));
    const xs = Array.from({ length: n + 1 }, (_, i) => l + ((r - l) * i) / n);
    const ys = [
      lo,
      ...transoms.filter((y) => y > lo + 0.05 && y < hi - 0.05),
      hi,
    ];
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        f.plane(
          "glass",
          xs[i - 1] + 0.035,
          xs[i] - 0.035,
          ys[j - 1] + 0.03,
          ys[j] - 0.03,
          -D.glassInset,
        );
        panes++;
      }
    for (const x of xs)
      f.box(
        "frame",
        Math.max(l, x - 0.035),
        Math.min(r, x + 0.035),
        lo,
        hi,
        -0.205,
        0.035,
      );
    for (const y of ys)
      f.box(
        "frame",
        l,
        r,
        Math.max(lo, y - 0.035),
        Math.min(hi, y + 0.035),
        -0.205,
        0.035,
      );
    for (const [s, norm] of [
      [l, f.along],
      [r, f.along.clone().negate()],
    ] as const)
      quad(
        "concrete",
        [
          f.at(s, lo, -0.7),
          f.at(s, lo, -0.18),
          f.at(s, hi, -0.18),
          f.at(s, hi, -0.7),
        ],
        norm,
      );
    for (const [y, norm] of [
      [lo, new T.Vector3(0, 1, 0)],
      [hi, new T.Vector3(0, -1, 0)],
    ] as const)
      quad(
        y === hi ? "soffit" : "concrete",
        [
          f.at(l, y, -0.7),
          f.at(r, y, -0.7),
          f.at(r, y, -0.18),
          f.at(l, y, -0.18),
        ],
        norm,
      );
  }
  function band(
    f: F,
    l: number,
    r: number,
    lo: number,
    hi: number,
    out = 0.075,
  ) {
    f.box("concrete", l, r, lo, hi, -0.72, out);
  }
  function punched(
    f: F,
    l: number,
    r: number,
    lo: number,
    hi: number,
    windows: readonly (readonly [number, number])[],
  ) {
    const side = 0.26;
    let y = lo;
    for (const [bottom, top] of windows) {
      band(f, l, r, y, bottom);
      band(f, l, l + side, bottom, top);
      band(f, r - side, r, bottom, top);
      aperture(f, l + side, r - side, bottom, top, [(bottom + top) / 2]);
      y = top;
    }
    band(f, l, r, y, hi);
  }
  function spine(
    f: F,
    width: number,
    lo: number,
    hi: number,
    windows: readonly (readonly [number, number])[],
  ) {
    // Curved pale return lies inboard of the source edge. Retained face30
    // supplies the adjacent old curved mass; this wraps rather than replaces it.
    const profile = (s: number) =>
      -D.spineCurveDepth * Math.pow((2 * s) / width - 1, 2);
    const count = 24,
      left = width * 0.25,
      right = width * 0.78;
    const xs = Array.from({ length: count + 1 }, (_, i) => (width * i) / count);
    const ys = [lo, ...windows.flatMap((v) => [...v]), hi].sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        const a = xs[i - 1],
          b = xs[i],
          bottom = ys[j - 1],
          top = ys[j];
        const glass =
          (a + b) / 2 >= left &&
          (a + b) / 2 <= right &&
          windows.some(([x, y]) => bottom >= x && top <= y);
        const out = glass ? -0.16 : 0,
          vs = [
            f.at(a, bottom, profile(a) + out),
            f.at(b, bottom, profile(b) + out),
            f.at(b, top, profile(b) + out),
            f.at(a, top, profile(a) + out),
          ];
        quad(glass ? "glass" : "concrete", vs, f.normal);
        if (glass) panes++;
        if (glass) {
          // Continuous physical sill/head reveals follow the curved opening.
          for (const [y, sign] of [
            [bottom, 1],
            [top, -1],
          ])
            quad(
              "concrete",
              [
                f.at(a, y, profile(a) - 0.16),
                f.at(b, y, profile(b) - 0.16),
                f.at(b, y, profile(b)),
                f.at(a, y, profile(a)),
              ],
              new T.Vector3(0, sign, 0),
            );
        }
      }
    f.plane("backing", 0, width, lo, hi, -0.91);
    for (const [s, norm] of [
      [0, f.along.clone().negate()],
      [width, f.along],
    ] as const)
      quad(
        "concrete",
        [
          f.at(s, lo, -0.91),
          f.at(s, lo, profile(s)),
          f.at(s, hi, profile(s)),
          f.at(s, hi, -0.91),
        ],
        norm,
      );
    // The retained cap is the roof. Add only its exposed curved underside,
    // separated vertically, avoiding a coplanar duplicate roof strip.
    for (let i = 1; i < xs.length; i++)
      quad(
        "soffit",
        [
          f.at(xs[i - 1], hi - 0.016, profile(xs[i - 1])),
          f.at(xs[i], hi - 0.016, profile(xs[i])),
          f.at(xs[i], hi - 0.016, 0),
          f.at(xs[i - 1], hi - 0.016, 0),
        ],
        new T.Vector3(0, -1, 0),
      );
    const first = (Math.ceil(count * 0.25) / count) * width,
      last = (Math.ceil(count * 0.78) / count) * width;
    for (const [bottom, top] of windows)
      for (const [s, sign] of [
        [first, 1],
        [last, -1],
      ])
        quad(
          "concrete",
          [
            f.at(s, bottom, profile(s)),
            f.at(s, bottom, profile(s) - 0.16),
            f.at(s, top, profile(s) - 0.16),
            f.at(s, top, profile(s)),
          ],
          f.along.clone().multiplyScalar(sign),
        );
    for (const [bottom, top] of windows) {
      const s = width * 0.52;
      f.box("frame", s - 0.025, s + 0.025, bottom, top, -0.24, -0.13);
    }
  }
  for (const tier of ["lower", "middle", "upper"] as const) {
    const low = tier === "lower" ? D.floor : D.tiers[tier].bottom,
      top = D.tiers[tier].top;
    const first = tools(0, tier),
      retained = D.retainedStart[tier];
    quad(
      "concrete",
      [
        new T.Vector3(retained[0], low, retained[1]),
        first.at(0, low, 0),
        first.at(0, top, 0),
        new T.Vector3(retained[0], top, retained[1]),
      ],
      first.normal,
    );
    for (let edge = 0; edge < 5; edge++) {
      const f = tools(edge, tier),
        spineWidth = edge === 0 ? D.spineWidth * D.tiers[tier].scale : 0;
      if (edge === 0)
        spine(
          f,
          spineWidth,
          low,
          top,
          tier === "lower"
            ? [[12.6, 14.12]]
            : tier === "middle"
              ? [
                  [15.5, 17.02],
                  [18.02, 19.65],
                ]
              : [
                  [20.96, 22.55],
                  [23.2, 24.96],
                ],
        );
      const l = spineWidth,
        r = f.length;
      // At face35 the final two tiers intentionally adopt the adjacent
      // southeast schedule, so all pale lips/glazing end on identical datums.
      if (edge === 4 && tier !== "lower") {
        if (tier === "middle") {
          band(f, l, r, low, 18.48, 0.045);
          aperture(f, l, r, 18.48, 19.67, [19.05]);
          band(f, l, r, 19.67, top, 0.16);
        } else {
          band(f, l, r, low, 20.62, 0.16);
          aperture(f, l, r, 20.62, 22.08, [21.61]);
          band(f, l, r, 22.08, 22.69, 0.055);
          aperture(f, l, r, 22.69, 25.02, [24.27]);
          band(f, l, r, 25.02, top, 0.16);
        }
      } else if (tier === "lower") {
        const sill = 8.08,
          head = 14.26;
        band(f, l, r, low, sill, 0.035);
        band(f, l, r, head, top, 0.1);
        if (edge === 3) {
          // Two paired groups in pale masonry, adjacent to tall field onface33.
          punched(f, l, r, sill, head, [
            [8.55, 10.45],
            [11.4, 13.95],
          ]);
        } else {
          const side = 0.22;
          band(f, l, l + side, sill, head);
          band(f, r - side, r, sill, head);
          aperture(
            f,
            l + side,
            r - side,
            sill,
            head,
            [9.38, 10.75, 12.1, 13.2],
          );
        }
      } else if (edge === 3) {
        punched(
          f,
          l,
          r,
          low,
          top,
          tier === "middle"
            ? [
                [15.35, 17.05],
                [18.0, 19.65],
              ]
            : [
                [20.95, 22.55],
                [23.2, 24.95],
              ],
        );
      } else {
        const sill = tier === "middle" ? 15.06 : 20.63,
          head = tier === "middle" ? 19.65 : 25.02;
        band(f, l, r, low, sill, 0.085);
        band(f, l, r, head, top, 0.14);
        const side = 0.22;
        band(f, l, l + side, sill, head);
        band(f, r - side, r, sill, head);
        aperture(
          f,
          l + side,
          r - side,
          sill,
          head,
          tier === "middle" ? [16.2, 17.46, 18.6] : [21.76, 22.86, 23.96],
        );
      }
      // Full-height physical returns close both outer ends and all cranked
      // corners behind the front skin; no sky crack behind a recessed pane.
      for (const [s, sign] of [
        [0, -1],
        [f.length, 1],
      ])
        quad(
          "concrete",
          [
            f.at(s, low, -0.92),
            f.at(s, low, 0),
            f.at(s, top, 0),
            f.at(s, top, -0.92),
          ],
          f.along.clone().multiplyScalar(sign),
        );
      if (edge > 0) {
        const prev = tools(edge - 1, tier),
          a = prev.at(prev.length, low, 0.075),
          b = f.at(0, low, 0.075);
        quad(
          "concrete",
          [a, b, new T.Vector3(b.x, top, b.z), new T.Vector3(a.x, top, a.z)],
          prev.normal.clone().add(f.normal).normalize(),
        );
      }
    }
  }
  const result = {} as PanPacificNearPodiumGeometry;
  let triangles = 0;
  for (const role of ROLES) {
    const g = mergeGeometries(bins[role], false);
    if (!g) throw new Error(`Near podium ${role} merge failed`);
    bins[role].forEach((v) => v.dispose());
    landmarkSurfaceUV(g, [1, 1]);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    result[role] = g;
    triangles += (g.index?.count ?? g.attributes.position.count) / 3;
  }
  result.stats = { triangles, panes, geometryBatches: ROLES.length };
  return result;
}
