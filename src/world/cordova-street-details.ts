import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import type { Batcher } from "./geometry";
import type { CollisionWorld } from "./collision";

type Furniture = { kind: "lamp" | "sign"; x: number; z: number };
type Support = Pick<
  CollisionWorld,
  "groundHeight" | "blocked" | "onStreet" | "water"
>;

/** Photo-fitted positions, not surveyed poles. The 2013 modern 325 Howe view
 * shows the corner mast, yellow signal, Cordova blade and club parking marker.
 * The mast is outside the new apron/rail and the existing vehicle envelope.
 * No curb is added: local OSM roads explicitly have sidewalk:none, and a
 * coherent raised finish requires its own ground/support reconciliation.
 */
export const CORDOVA_STREET_DETAILS = {
  signal: [430, -397] as const,
  parking: [414.8, -413.1] as const,
};

/** Original simple vector lettering; no font file, canvas or texture. Strokes
 * are flat sign paint, not extruded illuminated letters or floating labels. */
const strokes: Record<string, number[][]> = {
  C: [[0.8, 0.87, 0.63, 1, 0.2, 1, 0, 0.8, 0, 0.2, 0.2, 0, 0.63, 0, 0.8, 0.13]],
  O: [
    [
      0.2, 0, 0, 0.2, 0, 0.8, 0.2, 1, 0.6, 1, 0.8, 0.8, 0.8, 0.2, 0.6, 0, 0.2,
      0,
    ],
  ],
  R: [
    [0, 0, 0, 1, 0.55, 1, 0.8, 0.8, 0.8, 0.65, 0.55, 0.5, 0, 0.5],
    [0.4, 0.5, 0.85, 0],
  ],
  D: [[0, 0, 0, 1, 0.5, 1, 0.8, 0.75, 0.8, 0.25, 0.5, 0, 0, 0]],
  V: [[0, 1, 0.4, 0, 0.8, 1]],
  A: [
    [0, 0, 0.4, 1, 0.8, 0],
    [0.2, 0.43, 0.6, 0.43],
  ],
  S: [
    [
      0.8, 0.85, 0.63, 1, 0.2, 1, 0, 0.8, 0.1, 0.6, 0.65, 0.4, 0.8, 0.2, 0.6, 0,
      0.15, 0, 0, 0.15,
    ],
  ],
  T: [
    [0, 1, 0.8, 1],
    [0.4, 1, 0.4, 0],
  ],
  P: [[0, 0, 0, 1, 0.55, 1, 0.8, 0.8, 0.8, 0.65, 0.55, 0.5, 0, 0.5]],
};

export function buildCordovaStreetDetails(
  batch: Batcher,
  support: Support,
  existing: readonly Furniture[] = [],
): Furniture[] {
  const previousOffset = batch.offsetY;
  batch.offsetY = 0;
  const mesh = new ArchitecturalMesh(batch, 427, -402);
  const material = {
    metal: new T.MeshStandardMaterial({
      name: "Cordova galvanized signal mast",
      color: 0xabb1ad,
      metalness: 0.55,
      roughness: 0.48,
    }),
    dark: new T.MeshStandardMaterial({
      name: "Cordova signal housing and unlit lenses",
      color: 0x19241f,
      roughness: 0.78,
    }),
    yellow: new T.MeshStandardMaterial({
      name: "Cordova yellow signal backplate",
      color: 0xd7a82b,
      roughness: 0.62,
    }),
    green: new T.MeshStandardMaterial({
      name: "Cordova green sign enamel",
      color: 0x174b42,
      roughness: 0.66,
    }),
    white: new T.MeshStandardMaterial({
      name: "Cordova sign paint",
      color: 0xd8dfd4,
      roughness: 0.7,
    }),
    red: new T.MeshStandardMaterial({
      name: "Cordova red signal lens",
      color: 0x761d11,
      emissive: 0xe4290b,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    }),
  };
  const made: Furniture[] = [];
  const clear = ([x, z]: readonly [number, number]) =>
    !support.water(x, z) &&
    !support.blocked(x, z, 0.2) &&
    !support.onStreet(x, z, 0.25) &&
    !existing.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2);
  // A local sign frame: x across its face, y up, z toward the viewer/approach.
  const frame = (origin: Vertex3, nx: number, nz: number) => {
    const length = Math.hypot(nx, nz);
    nx /= length;
    nz /= length;
    return {
      angle: Math.atan2(nx, nz),
      p: (x: number, y: number, z = 0): Vertex3 => [
        origin[0] + x * nz + z * nx,
        origin[1] + y,
        origin[2] - x * nx + z * nz,
      ],
    };
  };
  type Frame = ReturnType<typeof frame>;
  const plate = (
    f: Frame,
    w: number,
    h: number,
    depth: number,
    m: T.Material,
    y = 0,
    z = 0,
  ) => mesh.box(f.p(0, y, z), w, h, depth, m, f.angle);
  const paint = (
    f: Frame,
    text: string,
    height: number,
    y: number,
    z: number,
    m: T.Material,
  ) => {
    const widths = [...text].map((c) => (c === " " ? 0.5 : 1.1));
    // Centre the painted footprint, excluding the final inter-letter advance.
    let cursor = (-(widths.reduce((a, b) => a + b, 0) - 0.3) * height) / 2;
    for (const [i, character] of [...text].entries()) {
      for (const path of strokes[character] ?? [])
        for (let j = 0; j < path.length - 2; j += 2) {
          const ax = cursor + path[j] * height,
            ay = y + path[j + 1] * height;
          const bx = cursor + path[j + 2] * height,
            by = y + path[j + 3] * height;
          const length = Math.hypot(bx - ax, by - ay),
            half = height * 0.045;
          const dx = (-(by - ay) / length) * half,
            dy = ((bx - ax) / length) * half;
          mesh.quad(
            m,
            f.p(ax + dx, ay + dy, z),
            f.p(ax - dx, ay - dy, z),
            f.p(bx - dx, by - dy, z),
            f.p(bx + dx, by + dy, z),
          );
        }
      cursor += widths[i] * height;
    }
  };
  const post = (
    x: number,
    z: number,
    ground: number,
    height: number,
    radius: number,
  ) => {
    mesh.beam(
      [x, ground - 0.055, z],
      [x, ground + height, z],
      radius,
      material.metal,
      12,
    );
    mesh.box(
      [x, ground + 0.055, z],
      radius * 3.3,
      0.11,
      radius * 3.3,
      material.metal,
    );
  };
  try {
    if (clear(CORDOVA_STREET_DETAILS.signal)) {
      const [x, z] = CORDOVA_STREET_DETAILS.signal,
        ground = support.groundHeight(x, z);
      post(x, z, ground, 8.1, 0.105);
      const arm = frame([x, ground, z], 1, -1);
      // The mast's substantial crossarm is the source-visible street silhouette.
      const armEnd = arm.p(-6.35, 5.9);
      mesh.beam(arm.p(0, 5.9), armEnd, 0.07, material.metal, 10);
      mesh.beam(arm.p(0, 6.7), arm.p(-1.3, 5.9), 0.045, material.metal, 8);
      const head = frame([armEnd[0], ground + 5.5, armEnd[2]], 1, -1);
      plate(head, 0.59, 1.42, 0.035, material.yellow);
      plate(head, 0.37, 1.22, 0.19, material.dark, 0, 0.11);
      for (const [i, y] of [0.38, 0, -0.38].entries()) {
        const disc = new T.CylinderGeometry(0.145, 0.145, 0.035, 20);
        disc.rotateX(Math.PI / 2);
        disc.rotateY(head.angle);
        disc.translate(...head.p(0, y, 0.222));
        mesh.add(disc, i === 0 ? material.red : material.dark);
        // Open visor tube, not a cap over the visible lens.
        const hood = new T.CylinderGeometry(
          0.16,
          0.16,
          0.18,
          16,
          1,
          true,
          Math.PI / 2,
          Math.PI * 1.6,
        );
        hood.rotateX(Math.PI / 2);
        hood.rotateY(head.angle);
        hood.translate(...head.p(0, y + 0.01, 0.27));
        mesh.add(hood, material.dark);
      }
      const signPoint = arm.p(-4.4, 5.42);
      const sign = frame(signPoint, 1, -1);
      plate(sign, 2.03, 0.4, 0.045, material.green);
      paint(sign, "CORDOVA ST", 0.185, -0.0925, 0.026, material.white);
      // Curved luminaire arm shares the reference mast; no new point light.
      const curve = new T.CatmullRomCurve3(
        [
          arm.p(0, 7.9),
          arm.p(-0.4, 8.4),
          arm.p(-1.5, 8.58),
          arm.p(-2.5, 8.44),
        ].map((p) => new T.Vector3(...p)),
      );
      mesh.add(new T.TubeGeometry(curve, 10, 0.052, 8, false), material.metal);
      mesh.box(arm.p(-2.55, 8.39), 0.82, 0.16, 0.29, material.metal, arm.angle);
      mesh.box(arm.p(-2.55, 8.3), 0.58, 0.025, 0.21, material.white, arm.angle);
      made.push({ kind: "sign", x, z });
    }
    if (clear(CORDOVA_STREET_DETAILS.parking)) {
      const [x, z] = CORDOVA_STREET_DETAILS.parking,
        ground = support.groundHeight(x, z);
      post(x, z, ground, 3.65, 0.042);
      const sign = frame([x, ground + 3.3, z], 0.72, -0.69);
      plate(sign, 0.62, 0.89, 0.035, material.green);
      plate(sign, 0.52, 0.77, 0.006, material.white, 0.01, 0.023);
      paint(sign, "P", 0.47, -0.2, 0.03, material.green);
      // A simple entrance-direction chevron; no invented price or tenant name.
      mesh.quad(
        material.green,
        sign.p(-0.11, -0.29, 0.031),
        sign.p(0, -0.39, 0.031),
        sign.p(0.11, -0.29, 0.031),
        sign.p(0, -0.335, 0.031),
      );
      made.push({ kind: "sign", x, z });
    }
    mesh.finish();
    return made;
  } finally {
    batch.offsetY = previousOffset;
  }
}
