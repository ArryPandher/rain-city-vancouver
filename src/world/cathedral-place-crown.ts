import * as T from "three";
import {
  CATHEDRAL_PLACE as D,
  CATHEDRAL_PLACE_TIERS as tiers,
} from "./cathedral-place-data";

export type CrownFacet = {
  a: T.Vector3;
  b: T.Vector3;
  c: T.Vector3;
  d: T.Vector3;
  normal: T.Vector3;
};
/** Bilinear parameterization: the long facets terminate on the short ridge;
 * end facets collapse to one ridge end. No second imaginary pyramid. */
export function cathedralCrownPoint(f: CrownFacet, s: number, t: number) {
  return f.a.clone().lerp(f.b, s).lerp(f.d.clone().lerp(f.c, s), t);
}
export function cathedralCrownRegistration(base = 0) {
  const ring = tiers.at(-1)!.polygons[0][0].slice(0, 4);
  const eave = ring.map(
    (p) => new T.Vector3(p[0], base + D.crownPanelSpring, p[1]),
  );
  // City polygon has long edges0→1 and3→2. Equal-pitch hip plan: each
  // ridge end is half the short span inboard from the corresponding end.
  const width = (eave[0].distanceTo(eave[3]) + eave[1].distanceTo(eave[2])) / 2;
  const length =
    (eave[0].distanceTo(eave[1]) + eave[3].distanceTo(eave[2])) / 2;
  const t = width / (2 * length);
  const near = eave[0].clone().lerp(eave[3], 0.5),
    far = eave[1].clone().lerp(eave[2], 0.5);
  const ridge = [near.clone().lerp(far, t), near.clone().lerp(far, 1 - t)];
  ridge.forEach((p) => (p.y = base + D.roofPeak));
  const make = (
    a: T.Vector3,
    b: T.Vector3,
    c: T.Vector3,
    d: T.Vector3,
  ): CrownFacet => {
    const normal = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
    if (normal.y < 0) normal.negate();
    return { a, b, c, d, normal };
  };
  const facets = [
    make(eave[0], eave[1], ridge[1], ridge[0]),
    make(eave[1], eave[2], ridge[1], ridge[1]),
    make(eave[2], eave[3], ridge[0], ridge[1]),
    make(eave[3], eave[0], ridge[0], ridge[0]),
  ];
  return {
    eave,
    ridge,
    facets,
    width,
    length,
    ridgeLength: ridge[0].distanceTo(ridge[1]),
    pitchDegrees:
      (Math.atan2(D.roofPeak - D.crownPanelSpring, width / 2) * 180) / Math.PI,
  };
}

/** Solid lower metal panels, an actually open upper steel lattice, open eave
 * support and two ridge-end finials. Geometry is merged by the two existing
 * roof/frame materials; no alpha masks, extra capture, light or render pass. */
export function createCathedralPlaceCrown(base = 0) {
  const registration = cathedralCrownRegistration(base);
  const buffers = {
    roof: { p: [] as number[], uv: [] as number[], ix: [] as number[] },
    frame: { p: [] as number[], uv: [] as number[], ix: [] as number[] },
  };
  type Role = keyof typeof buffers;
  const tri = (
    role: Role,
    a: T.Vector3,
    b: T.Vector3,
    c: T.Vector3,
    normal: T.Vector3,
  ) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-14) return;
    if (n.dot(normal) < 0) [b, c] = [c, b];
    const q = buffers[role],
      i = q.p.length / 3;
    for (const p of [a, b, c]) {
      q.p.push(...p.toArray());
      q.uv.push(p.x, p.z);
    }
    q.ix.push(i, i + 1, i + 2);
  };
  const quad = (role: Role, p: T.Vector3[], normal: T.Vector3) => {
    tri(role, p[0], p[1], p[2], normal);
    tri(role, p[0], p[2], p[3], normal);
  };
  const beams = new Set<string>();
  const beam = (
    a: T.Vector3,
    b: T.Vector3,
    width: number,
    tipWidth = width,
  ) => {
    const axis = b.clone().sub(a);
    if (axis.length() < 0.015) return;
    const key =
      [a, b]
        .map((p) =>
          p
            .toArray()
            .map((v) => v.toFixed(4))
            .join(","),
        )
        .sort()
        .join("/") + `/${width}/${tipWidth}`;
    if (beams.has(key)) return;
    beams.add(key);
    axis.normalize();
    const across = new T.Vector3(0, 1, 0);
    if (Math.abs(axis.y) > 0.95) across.set(1, 0, 0);
    across.cross(axis).normalize();
    const other = axis.clone().cross(across).normalize();
    const corners = (p: T.Vector3, w: number) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) =>
        p
          .clone()
          .addScaledVector(across, (x * w) / 2)
          .addScaledVector(other, (y * w) / 2),
      );
    const lo = corners(a, width),
      hi = corners(b, tipWidth);
    quad("frame", lo, axis.clone().negate());
    quad("frame", hi, axis);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        n = lo[i].clone().add(lo[j]).multiplyScalar(0.5).sub(a);
      quad("frame", [lo[i], lo[j], hi[j], hi[i]], n);
    }
  };
  const threshold = D.crownSolidFraction;
  for (const f of registration.facets) {
    const panel = [
      cathedralCrownPoint(f, 0, 0),
      cathedralCrownPoint(f, 1, 0),
      cathedralCrownPoint(f, 1, threshold),
      cathedralCrownPoint(f, 0, threshold),
    ];
    const inner = panel.map((p) =>
      p.clone().addScaledVector(f.normal, -D.crownPanelThickness),
    );
    quad("roof", panel, f.normal);
    quad("roof", inner, f.normal.clone().negate());
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        n = panel[j].clone().sub(panel[i]).cross(f.normal);
      quad("roof", [panel[i], panel[j], inner[j], inner[i]], n);
    }
    const seams = Math.max(2, Math.round(f.a.distanceTo(f.b) / 0.65));
    for (let i = 0; i <= seams; i++) {
      const s = i / seams;
      const start = cathedralCrownPoint(f, s, 0).addScaledVector(
          f.normal,
          0.02,
        ),
        end = cathedralCrownPoint(f, s, threshold).addScaledVector(
          f.normal,
          0.02,
        );
      beam(start, end, 0.035);
    }
    // Space the lattice at its actual lower opening edge, not at the much
    // wider roof eave: otherwise the hip-end lattice collapses into solid bars.
    const divisions = Math.max(
      2,
      Math.round(panel[3].distanceTo(panel[2]) / D.crownLatticePitch),
    );
    // Three diagonal courses leave open diamond/triangular apertures. There is
    // intentionally no roof polygon, backing or transparency mask above here.
    for (let row = 0; row < D.crownLatticeRows; row++) {
      const t0 = threshold + ((1 - threshold) * row) / D.crownLatticeRows,
        t1 = threshold + ((1 - threshold) * (row + 1)) / D.crownLatticeRows;
      for (let i = 0; i < divisions; i++) {
        const s0 = i / divisions,
          s1 = (i + 1) / divisions;
        beam(
          cathedralCrownPoint(f, s0, t0),
          cathedralCrownPoint(f, s1, t1),
          D.crownLatticeBar,
        );
        beam(
          cathedralCrownPoint(f, s1, t0),
          cathedralCrownPoint(f, s0, t1),
          D.crownLatticeBar,
        );
      }
    }
    beam(panel[3], panel[2], 0.11);
    beam(f.a, f.d, 0.13);
    beam(f.b, f.c, 0.13);
  }
  // Open rectangular eave support: two rails plus posts, on the retained stone
  // cap. No solid skirt hiding the photographed ventilation openings.
  for (let i = 0; i < registration.eave.length; i++) {
    const a = registration.eave[i],
      b = registration.eave[(i + 1) % 4],
      n = Math.ceil(a.distanceTo(b) / 2.5);
    for (const y of [
      base + D.crownSpring + 0.08,
      base + D.crownPanelSpring - 0.08,
    ])
      beam(a.clone().setY(y), b.clone().setY(y), 0.09);
    for (let j = 0; j <= n; j++) {
      const p = a.clone().lerp(b, j / n);
      beam(
        p.clone().setY(base + D.crownSpring),
        p.clone().setY(base + D.crownPanelSpring),
        0.085,
      );
    }
  }
  beam(registration.ridge[0], registration.ridge[1], 0.12);
  for (const p of registration.ridge)
    beam(p, p.clone().setY(base + D.apex), 0.13, 0.022);
  const finish = (role: Role) => {
    const q = buffers[role],
      g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(q.uv, 2));
    g.setIndex(q.ix);
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  };
  return {
    roof: finish("roof"),
    frame: finish("frame"),
    registration,
    beamCount: beams.size,
  };
}
