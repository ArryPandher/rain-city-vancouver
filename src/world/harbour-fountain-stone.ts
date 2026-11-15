import * as T from "three";
import type { ArchitecturalMesh, Vertex3 } from "./architectural-mesh";
import type { Materials } from "./materials";
import { fountainWorld, HARBOUR_POOL_LEVEL } from "./harbour-green-site";

/** Shared exterior materials; no photograph pixels or sign lettering. */
export function fountainStoneMaterials(m: Materials) {
  const stone = new T.MeshStandardMaterial({
    name: "Harbour fountain dressed stone",
    color: 0xb0b2a5,
    roughness: 0.87,
  });
  stone.map = m.texture("cast-concrete/color.jpg", true);
  stone.normalMap = m.texture("cast-concrete/normal.jpg");
  stone.normalScale.set(0.045, 0.045);
  const inset = new T.MeshStandardMaterial({
    name: "Harbour fountain recessed stone panel",
    color: 0x737e77,
    roughness: 0.91,
  });
  inset.map = stone.map;
  const metal = new T.MeshStandardMaterial({
    name: "Harbour fountain dark nozzle plate",
    color: 0x303b39,
    metalness: 0.55,
    roughness: 0.48,
  });
  return { stone, inset, metal };
}

/** Replaces only the old 1.12 m body / 1.30 m cap / pyramid geometry.
 * Keep the caller's existing obstacle and trunk collision unchanged.
 * Peak remains pool level + 1.90; maximum pyramid footprint remains identical.
 */
export function buildFountainStonePier(
  mesh: ArchitecturalMesh,
  u: number,
  v: number,
  m: ReturnType<typeof fountainStoneMaterials>,
) {
  const [x, z] = fountainWorld(u, v),
    angle = -Math.atan2(6.61, 12.06);
  const p = (a: number, h: number, b: number): Vertex3 => [
    x + a * Math.cos(angle) + b * Math.sin(angle),
    HARBOUR_POOL_LEVEL + h,
    z - a * Math.sin(angle) + b * Math.cos(angle),
  ];
  const box = (
    a: number,
    h: number,
    b: number,
    w: number,
    height: number,
    d: number,
    mat: T.Material,
  ) => mesh.box(p(a, h, b), w, height, d, mat, angle);
  // Smaller core lets the face panels sit physically behind the stone surrounds.
  box(0, 0.57, 0, 0.94, 1.14, 0.94, m.stone);
  for (let face = 0; face < 4; face++) {
    const turn = (face * Math.PI) / 2;
    const fp = (a: number, h: number, depth: number): Vertex3 =>
      p(
        a * Math.cos(turn) + depth * Math.sin(turn),
        h,
        -a * Math.sin(turn) + depth * Math.cos(turn),
      );
    const fb = (
      a: number,
      h: number,
      depth: number,
      w: number,
      height: number,
      d: number,
      mat: T.Material,
    ) => mesh.box(fp(a, h, depth), w, height, d, mat, angle + turn);
    // A real 8 mm shadow joint separates the plinth from the upper dressed blocks.
    fb(0, 0.19, 0.515, 1.12, 0.38, 0.09, m.stone);
    fb(0, 0.388, 0.486, 1.1, 0.016, 0.028, m.inset);
    for (const a of [-0.465, 0.465])
      fb(a, 0.767, 0.515, 0.19, 0.742, 0.09, m.stone);
    fb(0, 1.055, 0.515, 0.75, 0.17, 0.09, m.stone);
    fb(0, 0.442, 0.515, 0.75, 0.09, 0.09, m.stone);
    fb(0, 0.733, 0.488, 0.74, 0.49, 0.025, m.inset);
    // Source shows a dark V-shaped spout/plate on a subset of faces. Keep outer
    // sides quieter; no invented plaques, lettering, plumbing or current branding.
    if (face === 0 || face === (u < 7 ? 1 : 3)) {
      const a = fp(-0.3, 0.925, 0.518),
        b = fp(0.3, 0.925, 0.518),
        c = fp(0, 0.545, 0.518);
      mesh.beam(a, b, 0.018, m.metal, 6);
      mesh.beam(a, c, 0.018, m.metal, 6);
      mesh.beam(b, c, 0.018, m.metal, 6);
      fb(0, 0.947, 0.528, 0.65, 0.055, 0.052, m.metal);
    }
  }
  // Stepped neck and projecting bed under the unchanged pyramid silhouette.
  box(0, 1.175, 0, 1.3, 0.11, 1.3, m.stone);
  box(0, 1.262, 0, 1.2, 0.058, 1.2, m.inset);
  box(0, 1.307, 0, 1.27, 0.032, 1.27, m.stone);
  const cap = new T.ConeGeometry(0.93, 0.58, 4);
  cap.rotateY(Math.PI / 4 + angle);
  cap.translate(x, HARBOUR_POOL_LEVEL + 1.61, z);
  mesh.add(cap, m.stone);
}
