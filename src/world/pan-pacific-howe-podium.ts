import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import {
  PAN_PACIFIC_HOWE_PODIUM as D,
  PAN_PACIFIC_HOWE_RUN as RUN,
  PAN_PACIFIC_HOWE_RUN_STATIONS as STATIONS,
  PAN_PACIFIC_HOWE_LENGTH as LENGTH,
  type PanPacificHoweTier,
} from "./pan-pacific-howe-podium-data";

export type PanPacificHowePart =
  | "concrete"
  | "frame"
  | "glass"
  | "backing"
  | "soffit";
export type PanPacificHowePodiumGeometry = Record<
  PanPacificHowePart,
  T.BufferGeometry
> & {
  stats: {
    triangles: number;
    panes: number;
    supports: number;
    geometryBatches: number;
  };
};
const ROLES: PanPacificHowePart[] = [
  "concrete",
  "frame",
  "glass",
  "backing",
  "soffit",
];
const breaks = STATIONS.map((s) => s / LENGTH);
const segmentOut = RUN.slice(0, -1).map((p, i) => {
  const dx = RUN[i + 1][0] - p[0],
    dz = RUN[i + 1][1] - p[1];
  return new T.Vector2(-dz, dx).normalize();
});
// Miter each slight OSM bend. Parallel offset strips then share exactly the
// same corner, avoiding the triangular daylight cracks of per-edge boxes.
const outAtVertex = RUN.map((_, i) => {
  if (i === 0) return segmentOut[0];
  if (i === RUN.length - 1) return segmentOut[i - 1];
  const n = segmentOut[i - 1].clone().add(segmentOut[i]).normalize();
  return n.divideScalar(n.dot(segmentOut[i]));
});

/** Source-local only; loader applies its existing landmark origin and +.08y. */
export function panPacificHowePodiumPoint(
  u: number,
  y: number,
  out = 0,
  tier: PanPacificHoweTier = "lower",
): T.Vector3 {
  const s = T.MathUtils.clamp(u, 0, 1) * LENGTH;
  let i = 0;
  while (i < RUN.length - 2 && s > STATIONS[i + 1]) i++;
  const t = (s - STATIONS[i]) / (STATIONS[i + 1] - STATIONS[i]);
  const scale = D.tiers[tier].scale;
  const x = T.MathUtils.lerp(RUN[i][0], RUN[i + 1][0], t);
  const z = T.MathUtils.lerp(RUN[i][1], RUN[i + 1][1], t);
  const n = outAtVertex[i].clone().lerp(outAtVertex[i + 1], t);
  return new T.Vector3(
    -132 + (x + 132) * scale + n.x * out,
    y,
    69 + (z - 69) * scale + n.y * out,
  );
}

/** Entire lower colonnade and two banded podium tiers. Call only after all
 * source-removal guards pass. Four opaque batches and one glazing geometry;
 * glazing material owns its paired optical draws. No horizontal PIER overlay. */
export function createPanPacificHowePodiumGeometry(): PanPacificHowePodiumGeometry {
  const bins: Record<PanPacificHowePart, T.BufferGeometry[]> = {
    concrete: [],
    frame: [],
    glass: [],
    backing: [],
    soffit: [],
  };
  let panes = 0;
  const p = panPacificHowePodiumPoint;
  function quad(
    role: PanPacificHowePart,
    vs: T.Vector3[],
    desired?: T.Vector3,
  ) {
    let n = vs[1]
      .clone()
      .sub(vs[0])
      .cross(vs[2].clone().sub(vs[0]))
      .normalize();
    if (desired && n.dot(desired) < 0) {
      vs = [vs[0], vs[3], vs[2], vs[1]];
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
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    bins[role].push(g);
  }
  function slices(l: number, r: number, fn: (l: number, r: number) => void) {
    const points = [
      l,
      ...breaks.filter((v) => v > l + 1e-8 && v < r - 1e-8),
      r,
    ];
    for (let i = 1; i < points.length; i++) fn(points[i - 1], points[i]);
  }
  function face(
    role: PanPacificHowePart,
    tier: PanPacificHoweTier,
    l: number,
    r: number,
    low: number,
    high: number,
    out: number,
  ) {
    if (r <= l || high <= low) return;
    slices(l, r, (a, b) =>
      quad(role, [
        p(a, low, out, tier),
        p(b, low, out, tier),
        p(b, high, out, tier),
        p(a, high, out, tier),
      ]),
    );
  }
  function box(
    role: PanPacificHowePart,
    tier: PanPacificHoweTier,
    l: number,
    r: number,
    low: number,
    high: number,
    inside: number,
    outside: number,
  ) {
    if (r <= l || high <= low || outside <= inside) return;
    slices(l, r, (a, b) => {
      const at = (s: number, y: number, o: number) => p(s, y, o, tier);
      const out = at((a + b) / 2, 0, 1)
        .sub(at((a + b) / 2, 0, 0))
        .normalize();
      const along = at(b, 0, 0)
        .sub(at(a, 0, 0))
        .normalize();
      quad(
        role,
        [
          at(a, low, outside),
          at(b, low, outside),
          at(b, high, outside),
          at(a, high, outside),
        ],
        out,
      );
      quad(
        role,
        [
          at(a, low, inside),
          at(b, low, inside),
          at(b, high, inside),
          at(a, high, inside),
        ],
        out.clone().negate(),
      );
      quad(
        role,
        [
          at(a, low, inside),
          at(a, low, outside),
          at(a, high, outside),
          at(a, high, inside),
        ],
        along.clone().negate(),
      );
      quad(
        role,
        [
          at(b, low, inside),
          at(b, low, outside),
          at(b, high, outside),
          at(b, high, inside),
        ],
        along,
      );
      for (const [y, sign] of [
        [low, -1],
        [high, 1],
      ])
        quad(
          role,
          [
            at(a, y, inside),
            at(b, y, inside),
            at(b, y, outside),
            at(a, y, outside),
          ],
          new T.Vector3(0, sign, 0),
        );
    });
  }
  function cylinder(
    role: PanPacificHowePart,
    u: number,
    out: number,
    low: number,
    high: number,
    bottomR: number,
    topR = bottomR,
    segments = 16,
  ) {
    const g = new T.CylinderGeometry(topR, bottomR, high - low, segments);
    const c = p(u, (low + high) / 2, out);
    g.translate(c.x, c.y, c.z);
    bins[role].push(g);
  }
  function rail(
    y: number,
    inset: number,
    intervals: readonly (readonly [number, number])[] = [[0, 1]],
  ) {
    // Thin open rails belong to the raised terrace, not a collision fence.
    for (const [start, end] of intervals) {
      if (end - start < 0.002) continue;
      box(
        "frame",
        "lower",
        start,
        end,
        y + 1.025,
        y + 1.08,
        -inset - 0.045,
        -inset + 0.015,
      );
      for (const h of [0.34, 0.67])
        box(
          "frame",
          "lower",
          start,
          end,
          y + h,
          y + h + 0.026,
          -inset - 0.024,
          -inset + 0.002,
        );
      // Terminal posts meet the masonry. Pane stations continue only through
      // the genuinely open sections; no rail runs through a solid screen.
      const posts = [
        start,
        ...D.paneBoundaries.filter((u) => u > start && u < end),
        end,
      ];
      for (const u of posts) {
        const du = 0.025 / LENGTH;
        box(
          "frame",
          "lower",
          Math.max(start, u - du),
          Math.min(end, u + du),
          y + 0.015,
          y + 1.06,
          -inset - 0.035,
          -inset + 0.01,
        );
      }
    }
  }
  // Existing PIER already supplies the floor. Only a vertical retaining face
  // fills the photographed stepped base below it and terminates at that floor.
  // PIER triangles80–85 already supply the wall on edges38–40. Do not put
  // another near-coplanar face there: decoded quantization differs by millimetres.
  slices(0, D.retainingEnd, (a, b) => {
    const at = (u: number, y: number) =>
      u === D.retainingEnd
        ? new T.Vector3(D.retainingEndPoint[0], y, D.retainingEndPoint[1])
        : p(u, y, 0);
    quad("concrete", [
      at(a, D.retainingBottom),
      at(b, D.retainingBottom),
      at(b, D.floor),
      at(a, D.floor),
    ]);
  });
  for (const u of [0]) {
    const along = p(1, 0)
      .sub(p(0, 0))
      .normalize()
      .multiplyScalar(u === 0 ? -1 : 1);
    quad(
      "concrete",
      [
        p(u, D.retainingBottom, -0.22),
        p(u, D.retainingBottom, 0),
        p(u, D.floor, 0),
        p(u, D.floor, -0.22),
      ],
      along,
    );
  }
  rail(D.floor, 0.14);
  // Fixed gallery top; window head clears the thicker fascia underside by30mm.
  const lowerGlazingTop = D.galleryY - D.galleryThickness - 0.03;
  // Closed lower exterior, physically behind the pillars. No implied interior.
  box(
    "backing",
    "lower",
    0,
    1,
    D.floor,
    14.45,
    -D.recess - 0.48,
    -D.recess - 0.45,
  );
  box(
    "concrete",
    "lower",
    0,
    1,
    D.floor,
    9.12,
    -D.recess - 0.46,
    -D.recess + 0.04,
  );
  box(
    "concrete",
    "lower",
    0,
    1,
    lowerGlazingTop,
    11.02,
    -D.recess - 0.46,
    -D.recess + 0.04,
  );
  box(
    "concrete",
    "lower",
    0,
    1,
    13.48,
    14.5,
    -D.recess - 0.46,
    -D.recess + 0.04,
  );
  // Only the narrow lower window strip is glazing. The upper gallery in
  // Handford20 is predominantly pale panelled wall, not a curtain wall ribbon.
  for (let i = 1; i < D.paneBoundaries.length; i++) {
    const l = D.paneBoundaries[i - 1],
      r = D.paneBoundaries[i];
    face(
      "glass",
      "lower",
      l + 0.0006,
      r - 0.0006,
      9.12,
      lowerGlazingTop,
      -D.recess - 0.025,
    );
    panes++;
    box(
      "frame",
      "lower",
      Math.max(0, l - 0.0006),
      Math.min(1, l + 0.0006),
      9.12,
      lowerGlazingTop,
      -D.recess - 0.06,
      -D.recess + 0.05,
    );
  }
  const wall = D.galleryWall,
    opening = wall.recess;
  const wallSections: [number, number, number, number][] = [
    [0, opening.start, wall.bottom, wall.top],
    [opening.end, 1, wall.bottom, wall.top],
    [opening.start, opening.end, wall.bottom, opening.bottom],
    [opening.start, opening.end, opening.top, wall.top],
  ];
  for (const [l, r, low, high] of wallSections) {
    // A closed pale substrate behind 18mm joints; 65mm face-to-joint depth
    // makes the narrow panel rhythm read through actual occlusion and light.
    box("soffit", "lower", l, r, low, high, -D.recess - 0.1, -D.recess - 0.025);
    const cuts = [l, ...wall.panelBoundaries.filter((u) => u > l && u < r), r];
    for (let i = 1; i < cuts.length; i++) {
      const gap = 0.009 / LENGTH;
      box(
        "concrete",
        "lower",
        cuts[i - 1] + gap,
        cuts[i] - gap,
        low,
        high,
        -D.recess - 0.026,
        -D.recess + 0.04,
      );
    }
  }
  // The photo proves a shadowed rectangle, not a black window. A pale opaque
  // closure uses physical depth/lighting for shadow, without inventing glazing.
  box(
    "concrete",
    "lower",
    opening.start,
    opening.end,
    opening.bottom,
    opening.top,
    -D.recess - 0.39,
    -D.recess - 0.36,
  );
  for (const [l, r] of [
    [opening.start, opening.start + 0.045 / LENGTH],
    [opening.end - 0.045 / LENGTH, opening.end],
  ])
    box(
      "concrete",
      "lower",
      l,
      r,
      opening.bottom,
      opening.top,
      -D.recess - 0.36,
      -D.recess + 0.04,
    );
  for (const [low, high] of [
    [opening.bottom, opening.bottom + 0.045],
    [opening.top - 0.045, opening.top],
  ])
    box(
      "concrete",
      "lower",
      opening.start,
      opening.end,
      low,
      high,
      -D.recess - 0.36,
      -D.recess + 0.04,
    );
  // Shallow intermediate terrace slab visible in the reference, supported by
  // the same columns/back wall; this is above the retained PIER, not its copy.
  box(
    "concrete",
    "lower",
    0,
    1,
    D.galleryY - D.galleryThickness,
    D.galleryY,
    -D.recess,
    -D.galleryInset,
  );
  const screens = D.galleryScreens;
  let openStart = 0;
  const openRail: [number, number][] = [];
  for (const { start, end } of screens.intervals) {
    openRail.push([openStart, start]);
    openStart = end;
    const front = -screens.frontInset,
      back = front - screens.thickness,
      top = D.galleryY + screens.height;
    box(
      "concrete",
      "lower",
      start,
      end,
      D.galleryY - screens.embed,
      top,
      back,
      front,
    );
    box(
      "concrete",
      "lower",
      start,
      end,
      top - 0.012,
      top + screens.copingHeight,
      back - screens.copingOverhang,
      front + screens.copingOverhang,
    );
  }
  openRail.push([openStart, 1]);
  rail(D.galleryY, D.galleryInset + 0.03, openRail);
  box(
    "concrete",
    "lower",
    0,
    1,
    D.lowerBeamBottom,
    D.tiers.lower.top,
    -D.recess - 0.48,
    0,
  );
  box(
    "soffit",
    "lower",
    0,
    1,
    D.lowerBeamBottom - 0.014,
    D.lowerBeamBottom - 0.004,
    -D.recess,
    -0.18,
  );
  for (const support of D.supports) {
    const u = support.u;
    cylinder("concrete", u, -D.columnInset, D.floor, D.floor + 0.18, 0.51);
    cylinder("concrete", u, -D.columnInset, D.floor + 0.18, 13.66, 0.43, 0.405);
    cylinder("concrete", u, -D.columnInset, 13.66, 13.86, 0.47);
    cylinder("concrete", u, -D.columnInset, 13.86, 14.12, 0.47, 0.66, 8);
    box(
      "concrete",
      "lower",
      u - 0.6 / LENGTH,
      u + 0.6 / LENGTH,
      14.12,
      D.lowerBeamBottom,
      -D.columnInset - 0.6,
      -D.columnInset + 0.6,
    );
  }
  // Both terminal cheeks close the lower cut back to preserved faces35/41.
  for (const [l, r] of [
    [0, 0.0035],
    [0.9965, 1],
  ])
    box(
      "concrete",
      "lower",
      l,
      r,
      D.floor,
      D.tiers.lower.top,
      -D.recess - 0.48,
      0,
    );

  function glazing(
    tier: PanPacificHoweTier,
    l: number,
    r: number,
    low: number,
    high: number,
  ) {
    // Deep dark backing and four physical returns give each aperture depth.
    box("backing", tier, l, r, low, high, -0.64, -0.6);
    const du = 0.043 / (LENGTH * D.tiers[tier].scale);
    const cuts = [
      l,
      ...D.paneBoundaries.filter((u) => u > l + du && u < r - du),
      r,
    ];
    const transom = low + (high - low) * 0.68;
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i];
      for (const [bottom, top] of [
        [low + 0.045, transom - 0.025],
        [transom + 0.025, high - 0.045],
      ]) {
        face("glass", tier, a + du, b - du, bottom, top, -0.14);
        panes++;
      }
    }
    for (const u of cuts)
      box(
        "frame",
        tier,
        Math.max(l, u - du),
        Math.min(r, u + du),
        low,
        high,
        -0.18,
        0.025,
      );
    for (const y of [low, transom, high])
      box("frame", tier, l, r, y - 0.025, y + 0.025, -0.18, 0.03);
    for (const [a, b] of [
      [l, l + du],
      [r - du, r],
    ])
      box("concrete", tier, a, b, low, high, -0.64, -0.15);
    box("concrete", tier, l, r, low - 0.04, low, -0.64, 0.035);
    box("soffit", tier, l, r, high, high + 0.045, -0.64, 0.035);
  }
  function band(
    tier: PanPacificHoweTier,
    low: number,
    high: number,
    out = 0.045,
  ) {
    box("concrete", tier, 0, 1, low, high, -0.68, out);
  }
  // Broad middle wall with the three resolved near window groups, then the
  // long far window run. Two slender upper glazing levels share mullion lines.
  band("middle", D.tiers.middle.bottom, 15.2, 0.11);
  band("middle", 15.2, 15.73);
  band("middle", 17.82, 18.48);
  let cursor = 0;
  for (const [l, r] of D.lowerWindowGroups) {
    box("concrete", "middle", cursor, l, 15.73, 17.82, -0.68, 0.045);
    glazing("middle", l, r, 15.73, 17.82);
    cursor = r;
  }
  box("concrete", "middle", cursor, 1, 15.73, 17.82, -0.68, 0.045);
  glazing("middle", 0, 1, 18.48, 19.67);
  band("middle", 19.67, D.tiers.middle.top, 0.16);
  // Small actual projecting lips, shaded undersides, and repeated returns.
  band("upper", D.tiers.upper.bottom, 20.62, 0.16);
  glazing("upper", 0, 1, 20.62, 22.08);
  band("upper", 22.08, 22.69, 0.055);
  glazing("upper", 0, 1, 22.69, 25.02);
  band("upper", 25.02, D.tiers.upper.top, 0.16);
  for (const tier of ["middle", "upper"] as const) {
    const { bottom, top } = D.tiers[tier];
    for (const [l, r] of [
      [0, 0.0025],
      [0.9975, 1],
    ])
      box("concrete", tier, l, r, bottom, top, -0.68, 0);
    box("soffit", tier, 0, 1, top - 0.055, top - 0.042, -0.65, 0.145);
    // Fine recessed panel joints in the broad pale belts are actual geometry,
    // inset 8mm; they use the backing batch rather than adding a shader/grid.
    const paleRanges =
      tier === "middle"
        ? [
            [15.2, 15.73],
            [17.82, 18.48],
          ]
        : [[22.08, 22.69]];
    for (const u of D.paneBoundaries.slice(1, -1))
      for (const [low, high] of paleRanges)
        box("soffit", tier, u - 0.0001, u + 0.0001, low, high, 0.044, 0.049);
  }
  const result = {} as PanPacificHowePodiumGeometry;
  let triangles = 0;
  for (const role of ROLES) {
    const g = mergeGeometries(bins[role], false);
    if (!g) throw new Error(`Could not merge Pan Pacific ${role}`);
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
    supports: D.supports.length,
    geometryBatches: ROLES.length,
  };
  return result;
}
