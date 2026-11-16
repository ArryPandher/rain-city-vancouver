/** Rear portico fit to the official2023 oblique elevation trace and independent
 * 2006 rear photograph. Five shafts/four openings correct the prior four-shaft reading.
 * Metres are fitted estimates within retained source pediment/base anchors. */
export const GALLERY_PORTICO = {
  shaftU: [-8.8, -5.3625, -1.925, 1.5125, 4.95],
  shaftV: 23.5,
  baseTop: 3.421237564118808,
  shaftShoulder: 11.45,
  capitalBottom: 11.48,
  capitalTop: 12.05,
  entablatureBottom: 12.05,
  bannerTop: 11.55,
  capitalWidth: 1.4,
  capitalDepth: 1.18,
  scrollRadius: 0.225,
  scrollOffset: 0.455,
  scrollCentreY: 11.72,
  // Repaired original trim. Keep both original plinth cylinders/caps intact.
  replacedTrimRanges: [
    [1162, 1369],
    [1436, 1643],
  ],
  sourceTrimPositions: 1644,
  sourceTrimIndices: 7560,
  sourceTrianglesRemoved: 712,
} as const;

export function galleryPorticoSourceTriangle(ids: readonly number[]) {
  return GALLERY_PORTICO.replacedTrimRanges.some(([first, last]) =>
    ids.every((id) => id >= first && id <= last),
  );
}

/** [radius, local height], shared by the rendered lathe and finite contact. */
export const GALLERY_PORTICO_SHAFT_PROFILE = [
  [0.554, GALLERY_PORTICO.baseTop - 0.002],
  [0.554, 3.46],
  [0.54, 3.56],
  [0.42, 3.73],
  [0.403, 3.8],
  [0.375, 7.8],
  [0.344, GALLERY_PORTICO.shaftShoulder],
  [0.39, 11.49],
  [0.43, 11.54],
  [0.43, 11.6],
] as const;
