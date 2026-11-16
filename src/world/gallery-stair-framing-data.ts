import { geo } from "./data";
import { GALLERY_BISTRO as B } from "./gallery-bistro-data";
import source from "./gallery-rear-entry-data.json";
import {
  GALLERY_REAR_STEPS as S,
  GALLERY_STAIR_SURFACES as SURFACES,
  galleryStairBackV,
} from "./gallery-entry-stairs-data";

/** Source-local gallery coordinates. The retained tread geometry fixes the
 * landing datum; terrace depth/width and rail gauge are photographic estimates. */
export const GALLERY_STAIR_FRAMING = {
  minV: S.startV - 0.18, // bounded penetration into the retained foundation
  maxV: SURFACES.find((s) => s.kind === "landing" && s.index === 1)!.minV, // upper flight only
  top: S.top,
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
    const upper = SURFACES.filter((s) => s.flight === 1);
    const lower = SURFACES.filter((s) => s.flight === 2);
    const landing = SURFACES.find(
      (s) => s.kind === "landing" && s.index === 1,
    )!;
    const point = (v: number, y: number): GalleryRail["a"] => [
      u,
      y + D.railHeight,
      v,
    ];
    const centre = (s: (typeof SURFACES)[number]) =>
      point((s.minV + s.maxV) / 2, s.y);
    const path = [
      point(S.startV + 0.2, S.top),
      centre(upper[0]),
      centre(upper.at(-1)!),
      point(landing.minV + 0.1, landing.y),
      point(landing.maxV - 0.1, landing.y),
      centre(lower[0]),
      centre(lower.at(-1)!),
      point(S.endV - 0.02, lower.at(-1)!.y),
    ];
    for (let i = 1; i < path.length; i++) add(path[i - 1], path[i]);
    const supports = [
      SURFACES[0],
      ...upper.filter((_, i) => i % 5 === 0 || i === upper.length - 1),
      landing,
      lower[0],
      lower.at(-1)!,
    ];
    for (const s of supports) {
      const v = (s.minV + s.maxV) / 2;
      add([u, s.y - 0.025, v], point(v, s.y));
    }
  }
  for (const [i, t] of D.terraces.entries()) {
    const outer = i === 0 ? t.minU + 0.13 : t.maxU - 0.13;
    const inner = i === 0 ? t.maxU - 0.13 : t.minU + 0.13;
    const back = Math.max(
        D.minV + 0.25,
        galleryStairBackV(outer) + 0.1,
        i === 1 ? B.frontV : -Infinity,
      ),
      front = D.maxV - 0.13;
    const y = D.top + 1.04;
    // Two rails close the exposed terrace edges; existing gallery closes back.
    for (const h of [y, D.top + 0.52]) {
      add([outer, h, back], [outer, h, front]);
      add([outer, h, front], [inner, h, front]);
    }
    const posts = Math.ceil((front - back) / 1.7);
    for (let j = 0; j <= posts; j++) {
      const v = back + ((front - back) * j) / posts;
      add([outer, D.top - 0.025, v], [outer, y, v]);
    }
    add([inner, D.top - 0.025, front], [inner, y, front]);
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
