import * as T from "three";
import type { ArchitecturalMesh, Vertex3 } from "./architectural-mesh";

/** Official2023 and Vanderhill2006 exposed east-wing sills. Metric profiles
 * are fitted estimates; original aperture/portico anchors remain authoritative. */
export const GALLERY_UPPER_WINDOW_STONE = {
  porticoEast: 7.15,
  facadeA: [19.452, 23.181],
  facadeB: [0.413, 23.62],
  bays: 6,
  windowWidth: 1.65,
  windowBottom: 9.55,
  sillOverhang: 0.19,
  bracketInset: 0.18,
  bracketWidth: 0.19,
  // [inward depth, height below the existing window bottom]. The narrow
  // underside notch is a real drip recess, not a painted shadow stripe.
  sillProfile: [
    [0.025, -0.016],
    [-0.29, -0.045],
    [-0.29, -0.13],
    [-0.265, -0.15],
    [-0.252, -0.15],
    [-0.252, -0.125],
    [-0.236, -0.125],
    [-0.236, -0.15],
    [-0.2, -0.15],
    [-0.175, -0.21],
    [-0.12, -0.24],
    [0.025, -0.24],
  ],
  bracketProfile: [
    [0.025, -0.195],
    [-0.2, -0.195],
    [-0.2, -0.265],
    [-0.194, -0.3],
    [-0.177, -0.34],
    [-0.145, -0.378],
    [-0.104, -0.411],
    [-0.071, -0.441],
    [-0.05, -0.469],
    [-0.045, -0.49],
    [0.025, -0.49],
  ],
  courseProfile: [
    [0.025, -0.045],
    [-0.065, -0.045],
    [-0.065, -0.085],
    [-0.04, -0.13],
    [0.025, -0.13],
  ],
} as const;
type Profile = readonly (readonly [number, number])[];

/** Closed extrusion in the facade's along/Y/inward-depth frame. */
export function galleryWindowStoneProfile(
  left: number,
  right: number,
  bottom: number,
  profile: Profile,
) {
  const shape = new T.Shape();
  profile.forEach(([depth, y], i) =>
    i ? shape.lineTo(-depth, y) : shape.moveTo(-depth, y),
  );
  shape.closePath();
  const g = new T.ExtrudeGeometry(shape, {
    depth: right - left,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1,
  });
  // Shape X is outward, extrusion Z is along. Rotation gives positive-inward Z.
  g.rotateY(Math.PI / 2);
  g.translate(left, bottom, 0);
  return g;
}
function add(
  mesh: ArchitecturalMesh,
  stone: T.Material,
  left: number,
  right: number,
  bottom: number,
  profile: Profile,
  at: (along: number, y: number, depth: number) => Vertex3,
) {
  if (right - left < 0.001) return;
  const g = galleryWindowStoneProfile(left, right, bottom, profile);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    p.setXYZ(i, ...at(p.getX(i), p.getY(i), p.getZ(i)));
  g.computeVertexNormals();
  mesh.add(g, stone);
}
/** Shared render/contact extrusions for the four exposed bays and connecting
 * course. Five central banner-backed openings retain their previous profiles. */
export function galleryUpperWindowStoneParts() {
  const d = GALLERY_UPPER_WINDOW_STONE;
  const dx = d.facadeB[0] - d.facadeA[0],
    dz = d.facadeB[1] - d.facadeA[1];
  const length = Math.hypot(dx, dz),
    alongX = dx / length;
  const parts: {
    left: number;
    right: number;
    bottom: number;
    profile: Profile;
  }[] = [];
  let cursor = 0;
  const push = (left: number, right: number, profile: Profile) => {
    if (right > left)
      parts.push({ left, right, bottom: d.windowBottom, profile });
  };
  for (let i = 0; i < d.bays; i++) {
    const centre = ((i + 0.5) * length) / d.bays;
    const l = centre - d.windowWidth / 2,
      r = centre + d.windowWidth / 2;
    if (d.facadeA[0] + alongX * (r + d.sillOverhang) <= d.porticoEast) continue;
    push(cursor, l - d.sillOverhang, d.courseProfile);
    push(l - d.sillOverhang, r + d.sillOverhang, d.sillProfile);
    for (const centre of [l + d.bracketInset, r - d.bracketInset])
      push(
        centre - d.bracketWidth / 2,
        centre + d.bracketWidth / 2,
        d.bracketProfile,
      );
    cursor = r + d.sillOverhang;
  }
  push(
    cursor,
    Math.min(
      length,
      (d.porticoEast + (0.025 * dz) / length - d.facadeA[0]) / alongX,
    ),
    d.courseProfile,
  );
  return parts;
}
export function addGalleryUpperWindowStone(
  mesh: ArchitecturalMesh,
  stone: T.Material,
  at: (along: number, y: number, depth: number) => Vertex3,
) {
  for (const part of galleryUpperWindowStoneParts())
    add(mesh, stone, part.left, part.right, part.bottom, part.profile, at);
}

const contactParts = galleryUpperWindowStoneParts();
/** Exact sphere/extruded-polygon contact, including the real drip void. Ground
 * and ordinary body routes cannot reach this elevated assembly. */
export function galleryUpperWindowStoneCameraBlocked(
  u: number,
  v: number,
  y: number,
  radius: number,
) {
  const d = GALLERY_UPPER_WINDOW_STONE;
  const localY = y - 0.08;
  if (
    localY + radius < d.windowBottom - 0.49 ||
    localY - radius > d.windowBottom - 0.016
  )
    return false;
  const dx = d.facadeB[0] - d.facadeA[0],
    dz = d.facadeB[1] - d.facadeA[1];
  const length = Math.hypot(dx, dz),
    tx = dx / length,
    tz = dz / length;
  const along = (u - d.facadeA[0]) * tx + (v - d.facadeA[1]) * tz;
  const depth = -(u - d.facadeA[0]) * tz + (v - d.facadeA[1]) * tx;
  for (const p of contactParts) {
    const da = Math.max(p.left - along, 0, along - p.right);
    if (da > radius) continue;
    const h = localY - p.bottom;
    let inside = false,
      nearest = Infinity;
    for (let i = 0, j = p.profile.length - 1; i < p.profile.length; j = i++) {
      const [ax, ay] = p.profile[j],
        [bx, by] = p.profile[i];
      if (ay > h !== by > h && depth < ((bx - ax) * (h - ay)) / (by - ay) + ax)
        inside = !inside;
      const vx = bx - ax,
        vy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((depth - ax) * vx + (h - ay) * vy) / (vx * vx + vy * vy)),
      );
      nearest = Math.min(
        nearest,
        (depth - ax - t * vx) ** 2 + (h - ay - t * vy) ** 2,
      );
    }
    if (da * da + (inside ? 0 : nearest) < radius * radius) return true;
  }
  return false;
}
