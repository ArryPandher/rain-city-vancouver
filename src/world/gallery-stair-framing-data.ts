import { geo } from "./data";
import source from "./gallery-rear-entry-data.json";
import { GALLERY_REAR_STEPS as S } from "./gallery-rear-entry";

/** Source-local gallery coordinates. The retained tread geometry fixes the
 * landing datum; terrace depth/width and rail gauge are photographic estimates. */
export const GALLERY_STAIR_FRAMING = {
  minV: S.startV - 0.18, // bounded penetration into the retained foundation
  maxV: S.startV + S.tread * 9, // leave the lowest three treads open
  top: S.count * S.rise,
  bottom: -S.datum, // gallery group is +.08m; public forecourt ground is y0
  datum: S.datum,
  terraces: [
    // The left retained rear wing ends at u−8.872. Keep the added terrace
    // entirely supported by that real foundation return.
    { minU: S.minU - 1.08, maxU: S.minU },
    { minU: S.maxU, maxU: S.maxU + 1.8 },
  ],
  railRadius: 0.027,
  railHeight: 0.96,
} as const;
export type GalleryRail = {
  a: [number, number, number];
  b: [number, number, number];
};
export function galleryStairRails(): GalleryRail[] {
  const D = GALLERY_STAIR_FRAMING;
  const rails: GalleryRail[] = [];
  const add = (a: GalleryRail["a"], b: GalleryRail["b"]) =>
    rails.push({ a, b });
  for (const u of [S.minU + 0.35, S.maxU - 0.35]) {
    // Posts land on retained tread centres; top follows the pitch line.
    const points = [0, 4, 8, 11].map((i) => {
      const v = S.startV + (i + 0.5) * S.tread;
      const y = (S.count - i) * S.rise;
      add([u, y - 0.025, v], [u, y + D.railHeight, v]);
      return [u, y + D.railHeight, v] as GalleryRail["a"];
    });
    add(points[0], points[3]);
    // Short horizontal ends remain inside the stair footprint.
    add([u, points[0][1], S.startV + 0.015], points[0]);
    add(points[3], [u, points[3][1], S.startV + S.count * S.tread - 0.015]);
  }
  for (const [i, t] of D.terraces.entries()) {
    const outer = i === 0 ? t.minU + 0.13 : t.maxU - 0.13;
    const inner = i === 0 ? t.maxU - 0.13 : t.minU + 0.13;
    const back = D.minV + 0.25,
      front = D.maxV - 0.13;
    const y = D.top + 1.04;
    // Two rails close the exposed terrace edges; existing gallery closes back.
    for (const h of [y, D.top + 0.52]) {
      add([outer, h, back], [outer, h, front]);
      add([outer, h, front], [inner, h, front]);
    }
    for (const [u, v] of [
      [outer, back],
      [outer, (back + front) / 2],
      [outer, front],
      [inner, front],
    ])
      add([u, D.top - 0.025, v], [u, y, v]);
  }
  return rails;
}
const origin = geo(S.origin[1], S.origin[0]);
const c = Math.cos(source.angle),
  s = Math.sin(source.angle);
export function galleryStairWorld(u: number, v: number): [number, number] {
  return [origin[0] + c * u - s * v, origin[1] + s * u + c * v];
}
export function galleryStairLocal(x: number, z: number): [number, number] {
  return [
    c * (x - origin[0]) + s * (z - origin[1]),
    -s * (x - origin[0]) + c * (z - origin[1]),
  ];
}
