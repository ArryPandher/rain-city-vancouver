import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import { Batcher } from "./geometry";
import { pointInPoly, type CityData, type Point } from "./data";
import type { Materials } from "./materials";
import type { CollisionWorld } from "./collision";
import {
  harbourWays,
  harbourPaths,
  pathDistance,
  HARBOUR_FLIGHTS,
  HARBOUR_LANDING,
  harbourGroundHeight,
} from "./harbour-green-site";

// Photo-derived flanking exterior, not a survey or an assertion of current tenancy.
// Local u runs along the fountain piers; d runs uphill from the middle landing.
const origin = harbourWays.w48271068.pts[1];
const length = Math.hypot(12.06, 6.61);
const ux = 12.06 / length,
  uz = 6.61 / length;
export const frontagePoint = (u: number, d: number): Point => [
  origin[0] + ux * u - uz * d,
  origin[1] + uz * u + ux * d,
];
export const HARBOUR_FRONTAGE_BAYS = [-16.2, -12.5, -8.8, 8.8, 12.5, 16.2].map(
  (u) => ({ u, width: 3.7, front: 3.6, back: 7.1 }),
);
export const FRONTAGE_CANOPY = {
  eaveDepth: -0.82,
  ridgeDepth: 0.48,
  eaveHeight: -0.48,
  ridgeHeight: 0.13,
};

/** Reject a complete bay rather than silently placing scenery across a route. */
export function frontageBayClear(
  bay: (typeof HARBOUR_FRONTAGE_BAYS)[number],
  data: CityData,
) {
  // World-space bounds of the entire expanded sample grid (not just bay centre).
  // A building can enclose the bay while every one of its vertices lies outside.
  const corners = [
    frontagePoint(bay.u - bay.width / 2 - 0.2, bay.front - 1.02),
    frontagePoint(bay.u + bay.width / 2 + 0.21, bay.front - 1.02),
    frontagePoint(bay.u + bay.width / 2 + 0.21, bay.back + 0.36),
    frontagePoint(bay.u - bay.width / 2 - 0.2, bay.back + 0.36),
  ];
  const minX = Math.min(...corners.map((p) => p[0])),
    maxX = Math.max(...corners.map((p) => p[0])),
    minZ = Math.min(...corners.map((p) => p[1])),
    maxZ = Math.max(...corners.map((p) => p[1]));
  const buildings = data.buildings.filter((b) => {
    let x0 = Infinity,
      x1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity;
    for (let i = 0; i < b.pts.length; i += 2) {
      x0 = Math.min(x0, b.pts[i]);
      x1 = Math.max(x1, b.pts[i]);
      z0 = Math.min(z0, b.pts[i + 1]);
      z1 = Math.max(z1, b.pts[i + 1]);
    }
    return x0 <= maxX && x1 >= minX && z0 <= maxZ && z1 >= minZ;
  });
  const trees: Point[] = [];
  const tree = (x: number, z: number) => {
    if (
      x >= minX - 1.1 &&
      x <= maxX + 1.1 &&
      z >= minZ - 1.1 &&
      z <= maxZ + 1.1
    )
      trees.push([x, z]);
  };
  for (let i = 0; i < (data.trees?.length ?? 0); i += 2)
    tree(data.trees[i], data.trees[i + 1]);
  for (const t of data.publicTrees?.trees ?? []) tree(t[1], t[2]);
  const samples: Point[] = [];
  for (
    let u = bay.u - bay.width / 2 - 0.2;
    u <= bay.u + bay.width / 2 + 0.21;
    u += 0.25
  )
    for (let d = bay.front - 1.02; d <= bay.back + 0.36; d += 0.25) {
      const p = frontagePoint(u, d);
      if (
        HARBOUR_FLIGHTS.some((f) => pointInPoly(...p, f.pts)) ||
        pointInPoly(...p, HARBOUR_LANDING.pts) ||
        harbourPaths.some(
          (path) => pathDistance(...p, path.pts).d < path.width / 2 + 0.35,
        ) ||
        buildings.some((b) => pointInPoly(...p, b.pts))
      )
        return false;
      samples.push(p);
    }
  for (const [x, z] of trees)
    if (samples.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.1)) return false;
  return true;
}

export function buildHarbourFrontage(
  parent: T.Object3D,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
) {
  if (!collision.harbour) return [];
  const batch = new Batcher(parent, 64),
    mesh = new ArchitecturalMesh(batch, ...origin);
  const stone = new T.MeshStandardMaterial({
    name: "Bute frontage pale stone",
    color: 0x9d9f91,
    roughness: 0.92,
  });
  stone.map = m.texture("cast-concrete/color.jpg", true);
  stone.normalMap = m.texture("cast-concrete/normal.jpg");
  stone.normalScale.set(0.08, 0.08);
  const frame = new T.MeshStandardMaterial({
    name: "Bute frontage charcoal metal",
    color: 0x303b37,
    metalness: 0.35,
    roughness: 0.65,
  });
  const glass = new T.MeshStandardMaterial({
    name: "Bute frontage recessed glazing",
    color: 0x243b3e,
    metalness: 0.45,
    roughness: 0.23,
    envMapIntensity: 0.65,
  });
  const recess = new T.MeshStandardMaterial({
    name: "Bute frontage shadowed soffit",
    color: 0x3e4740,
    roughness: 0.96,
  });
  // The historical photograph shows light grey sloping infill between dark ribs,
  // not a horizontal open pergola. Opaque exterior panels avoid expensive glass.
  const canopy = new T.MeshStandardMaterial({
    name: "Bute frontage grey sloped canopy",
    color: 0x84938f,
    metalness: 0.18,
    roughness: 0.55,
  });
  const angle = -Math.atan2(uz, ux);
  const p = (u: number, y: number, d: number): Vertex3 => {
    const [x, z] = frontagePoint(u, d);
    return [x, y, z];
  };
  const box = (
    u: number,
    y: number,
    d: number,
    w: number,
    h: number,
    depth: number,
    mat: T.Material,
  ) => mesh.box(p(u, y, d), w, h, depth, mat, angle);
  for (const bay of HARBOUR_FRONTAGE_BAYS) {
    if (!frontageBayClear(bay, data)) continue;
    const { u, width, front, back } = bay;
    const ring = [
      [u - width / 2, front],
      [u + width / 2, front],
      [u + width / 2, back],
      [u - width / 2, back],
    ].map(([a, b]) => frontagePoint(a, b));
    // Front follows the landing grade; rear is buried in the existing uphill bank.
    const grade = (q: Point) =>
      harbourGroundHeight(...q) ?? collision.groundHeight(...q);
    const frontY = Math.min(grade(ring[0]), grade(ring[1]));
    const roof = Math.max(6.38, ...ring.map(grade).map((y) => y + 0.18));
    const low = Math.min(...ring.map(grade)) - 0.12;
    mesh.skin([[...ring, ring[0]]], low, roof - 0.14, stone);
    // Glazed display/door planes sit behind projecting masonry jambs; no interior.
    box(
      u,
      (frontY + 0.42 + roof - 0.45) / 2,
      front - 0.018,
      width - 0.55,
      roof - 0.45 - frontY - 0.42,
      0.055,
      glass,
    );
    for (const off of [-width / 2 + 0.13, width / 2 - 0.13])
      box(
        u + off,
        (frontY + roof) / 2,
        front - 0.15,
        0.26,
        roof - frontY,
        0.3,
        stone,
      );
    box(u, roof - 0.35, front - 0.12, width, 0.3, 0.26, recess);
    box(u, frontY + 0.21, front - 0.12, width, 0.42, 0.28, stone);
    for (const off of [-0.58, 0.58])
      box(
        u + off,
        (frontY + roof - 0.4) / 2,
        front - 0.075,
        0.055,
        roof - 0.4 - frontY,
        0.09,
        frame,
      );
    box(u, roof - 0.14, (front + back) / 2, width, 0.22, back - front, stone);
    // A visible low eave and rising panels reproduce the source's canopy profile.
    const c = FRONTAGE_CANOPY,
      run = c.ridgeDepth - c.eaveDepth,
      rise = c.ridgeHeight - c.eaveHeight,
      slope = Math.atan2(rise, run),
      canopyLength = Math.hypot(run, rise);
    const sloping = (
      offset: number,
      w: number,
      thickness: number,
      mat: T.Material,
    ) => {
      const g = new T.BoxGeometry(w, thickness, canopyLength);
      g.rotateX(-slope);
      g.rotateY(angle);
      g.translate(
        ...p(
          u + offset,
          roof + (c.eaveHeight + c.ridgeHeight) / 2,
          front + (c.eaveDepth + c.ridgeDepth) / 2,
        ),
      );
      mesh.add(g, mat);
    };
    sloping(0, width - 0.12, 0.055, canopy);
    for (let off = -width / 2 + 0.08; off < width / 2; off += 0.46)
      sloping(off, 0.07, 0.12, frame);
    box(u, roof + c.eaveHeight, front + c.eaveDepth, width, 0.17, 0.16, frame);
    box(
      u,
      roof + c.eaveHeight - 0.13,
      front + c.eaveDepth + 0.03,
      width,
      0.06,
      0.1,
      stone,
    );
    // Balustrade is visible above the low wings, with an open central stair gap.
    for (let off = -width / 2 + 0.16; off < width / 2; off += 0.46)
      box(u + off, roof + 0.64, front + 0.75, 0.085, 0.98, 0.085, stone);
    box(u, roof + 1.15, front + 0.75, width, 0.14, 0.2, stone);
    for (const off of [-width / 2 + 0.12, width / 2 - 0.12]) {
      box(u + off, roof + 0.63, front + 0.75, 0.24, 1.04, 0.26, stone);
      box(u + off, roof + 1.19, front + 0.75, 0.31, 0.13, 0.33, stone);
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      collision.addBarrier(...a, ...b, 0.16, roof + 1.22);
    }
  }
  mesh.finish();
  const chunks = batch.finish();
  for (const c of chunks) c.name = "Bute stair flanking terrace frontage";
  return chunks;
}
