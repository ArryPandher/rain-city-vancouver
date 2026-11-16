/** Registered from Handford20 roof/aerial plus historic typical hotel plan.
 * Horizontal parallax correction and all metric heights remain inferred.
 * Exact retained cap datum is independently decoded from the licensed source. */
export type PanPacificTowerFace =
  | "near"
  | "spine"
  | "rear"
  | "northwest"
  | "nose"
  | "southeast"
  | "return";
export interface PanPacificTowerPlanVertex {
  point: [number, number];
  face: PanPacificTowerFace;
}
export const PAN_PACIFIC_TOWER = {
  base: 25.495826721191406,
  crownStart: 74.2,
  mainRoof: 78.4,
  crownTop: 80.2,
  // Small skyline object from Handford20, not the large aerial skylight.
  // Position across the near face is observed; shallow depth/inset are inferred.
  crown: { nearFaceU: 0.6, inset: 1.65, width: 6, depth: 2.8, height: 1.8 },
  longAxis: [
    Math.cos((28.6 * Math.PI) / 180),
    -Math.sin((28.6 * Math.PI) / 180),
  ] as const,
  southeastAxis: [
    Math.sin((28.6 * Math.PI) / 180),
    Math.cos((28.6 * Math.PI) / 180),
  ] as const,
  levels: [
    { bottom: 25.495826721191406, top: 32.4, noseDepth: 3, noseWidth: 1 },
    { bottom: 32.4, top: 50, noseDepth: 1.5, noseWidth: 0.5 },
    { bottom: 50, top: 74.2, noseDepth: 0, noseWidth: 0 },
    { bottom: 74.2, top: 78.4, noseDepth: 0, noseWidth: 0 },
  ],
  // Raw highest-roof image pixels translated +60,-70px. This is a contact-fit
  // parallax estimate, NOT a directly measured ground footprint.
  planControls: [
    [-142.15268133368633, 91.47296531925839],
    [-163.77650120619546, 83.23531965354063],
    [-167.89532403905437, 79.11649682068175],
    [-168.9250297472691, 72.93826257139342],
    [-163.77650120619546, 69.50591021067768],
    [-163.77650120619546, 65.3870873778188],
    [-144.89856322225893, 58.17914742031575],
    [-134.60150614011172, 62.641205489246204],
    [-105.42651107402794, 47.53885510209697],
    [-100.96445300509748, 48.91179604638326],
    [-97.53210064438176, 52.344148407099],
    [-95.47268922795232, 57.14944171210103],
    [-96.50239493616704, 61.61149978103148],
    [-99.93474729688276, 65.73032261389037],
    [-136.31768232046957, 86.32443677818479],
    [-138.7203289729706, 90.44325961104367],
  ] as readonly (readonly [number, number])[],
  nearPanePixels: [
    571, 594, 607, 630, 652, 665, 688, 711, 724, 747, 770, 784, 807, 830, 844,
    868,
  ],
  nearMajorRows: 16,
  nearTransomFraction: 0.47,
  southeastPaleStep: 0.48,
  southeastNearPaleBottom: 53.1,
  noseWindowPhotoY: [180, 227, 277, 326, 374, 423, 476, 528, 580, 632, 704],
  glassInset: 0.14,
  backingInset: 0.61,
} as const;

export const PAN_PACIFIC_TOWER_WINDOW_CENTRES =
  PAN_PACIFIC_TOWER.noseWindowPhotoY
    .map(
      (y) =>
        PAN_PACIFIC_TOWER.mainRoof -
        ((y - 98) / (733 - 98)) *
          (PAN_PACIFIC_TOWER.mainRoof - PAN_PACIFIC_TOWER.base),
    )
    .sort((a, b) => a - b);

/** Circular I→L→N nose is independently cap-audited at20 segments. The width
 * term grows only toward the SE, preserving the constrained NW cap clearance. */
export function towerPlan(
  noseDepth = 0,
  noseWidth = 0,
): PanPacificTowerPlanVertex[] {
  const d = PAN_PACIFIC_TOWER,
    c = d.planControls;
  const ring: PanPacificTowerPlanVertex[] = [];
  const add = (point: readonly [number, number], face: PanPacificTowerFace) =>
    ring.push({ point: [...point], face });
  add(c[0], "near");
  add(c[1], "spine");
  for (let i = 1; i <= 8; i++) {
    const t = i / 8,
      v = 1 - t;
    add(
      [
        v * v * c[1][0] + 2 * v * t * c[2][0] + t * t * c[3][0],
        v * v * c[1][1] + 2 * v * t * c[2][1] + t * t * c[3][1],
      ],
      i < 3 ? "spine" : "rear",
    );
  }
  for (const i of [4, 5, 6]) add(c[i], "rear");
  add(c[7], "northwest");
  const [a, b, f] = [c[8], c[11], c[13]];
  const den =
    2 * (a[0] * (b[1] - f[1]) + b[0] * (f[1] - a[1]) + f[0] * (a[1] - b[1]));
  const aa = a[0] ** 2 + a[1] ** 2,
    bb = b[0] ** 2 + b[1] ** 2,
    ff = f[0] ** 2 + f[1] ** 2;
  const cx =
    (aa * (b[1] - f[1]) + bb * (f[1] - a[1]) + ff * (a[1] - b[1])) / den;
  const cz =
    (aa * (f[0] - b[0]) + bb * (a[0] - f[0]) + ff * (b[0] - a[0])) / den;
  const radius = Math.hypot(a[0] - cx, a[1] - cz);
  const start = Math.atan2(a[1] - cz, a[0] - cx);
  let end = Math.atan2(f[1] - cz, f[0] - cx);
  while (end < start) end += 2 * Math.PI;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      theta = start + (end - start) * t;
    add(
      [
        cx +
          radius * Math.cos(theta) +
          d.longAxis[0] * noseDepth +
          d.southeastAxis[0] * noseWidth * t,
        cz +
          radius * Math.sin(theta) +
          d.longAxis[1] * noseDepth +
          d.southeastAxis[1] * noseWidth * t,
      ],
      i === 20 ? "southeast" : "nose",
    );
  }
  add(c[14], "return");
  add(c[15], "return");
  return ring;
}
