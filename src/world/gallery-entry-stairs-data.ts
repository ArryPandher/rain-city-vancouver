import source from "./gallery-rear-entry-data.json";

/** Photo-informed two-flight interpretation; footprint/back and upper datum
 * register to the retained gallery. Counts and going are estimates, not survey. */
export const GALLERY_REAR_STEPS = {
  origin: [-123.12046, 49.28287] as const,
  minU: -7.75,
  maxU: 3.95,
  startV: 12.1 + source.translationV,
  upperLanding: 0.7,
  upperCount: 20,
  tread: 0.34,
  middleLanding: 1,
  lowerCount: 4,
  lowerTread: 0.36,
  count: 24,
  rise: 3.28 / 24,
  datum: 0.08,
  top: 3.2,
  endV: 12.1 + source.translationV + 0.7 + 20 * 0.34 + 1 + 4 * 0.36,
};
export type GalleryStairSurface = {
  minV: number;
  maxV: number;
  y: number;
  kind: "landing" | "tread";
  flight: 0 | 1 | 2;
  index: number;
};
/** Decoded retained foundation cap boundary after removal of the old stair.
 * Source-local u/v, pinned to gallery-rear-entry-data.json's GLB hash. */
export const GALLERY_STAIR_CAP_EDGE = [
  [-8.872893333435059, 23.81922721862793],
  [0.4129771292209625, 23.621566772460938],
  [19.451900482177734, 23.1803035736084],
] as const;
export const GALLERY_RETAINED_CAP_Y = 3.199517011642456;
export function galleryStairBackV(u: number) {
  const [a, b] =
    u < GALLERY_STAIR_CAP_EDGE[1][0]
      ? [GALLERY_STAIR_CAP_EDGE[0], GALLERY_STAIR_CAP_EDGE[1]]
      : [GALLERY_STAIR_CAP_EDGE[1], GALLERY_STAIR_CAP_EDGE[2]];
  return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]);
}
const S = GALLERY_REAR_STEPS;
export const GALLERY_STAIR_SURFACES: readonly GalleryStairSurface[] = (() => {
  const result: GalleryStairSurface[] = [];
  let v = S.startV;
  const add = (
    length: number,
    y: number,
    kind: GalleryStairSurface["kind"],
    flight: GalleryStairSurface["flight"],
    index: number,
  ) => {
    result.push({ minV: v, maxV: v + length, y, kind, flight, index });
    v += length;
  };
  add(S.upperLanding, S.top, "landing", 0, 0);
  for (let i = 0; i < S.upperCount; i++)
    add(S.tread, S.top - i * S.rise, "tread", 1, i);
  add(S.middleLanding, S.top - S.upperCount * S.rise, "landing", 0, 1);
  for (let i = 0; i < S.lowerCount; i++)
    add(S.lowerTread, S.top - (S.upperCount + i) * S.rise, "tread", 2, i);
  return result;
})();

export function galleryStairLocalHeight(v: number) {
  return GALLERY_STAIR_SURFACES.find(
    (s) => v >= s.minV - 1e-9 && v < s.maxV - 1e-9,
  )?.y;
}
