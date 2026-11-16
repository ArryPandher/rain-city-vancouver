/** Photograph measurements are in the unscaled 2048 × 1713 Handford20 image.
 * This is a bounded reconstruction, not a surveyed elevation. The reference is
 * not a runtime texture; source mesh attribution remains Codriver / OSM. */
export const PAN_PACIFIC_HOWE_PHOTO_TRACE = {
  image: "Handford-MCM-CanadaPlace-20-WEB.jpg",
  size: [2048, 1713],
  vanishingPoint: [2321.6835551214745, 1361.7259186912465],
  bandLines: [
    [
      [996, 941],
      [1497, 1100],
    ],
    [
      [990, 1203],
      [1485, 1262],
    ],
  ],
  supportEndpointsX: [952, 1484],
  // y marks the capital/shaft contact, not a second projective constraint.
  supports: [
    { pixel: [955, 1224], confidence: "tree-obscured" },
    { pixel: [1102, 1237], confidence: "visible" },
    { pixel: [1206, 1248], confidence: "visible" },
    { pixel: [1294, 1258], confidence: "visible" },
    { pixel: [1367, 1267], confidence: "visible" },
    { pixel: [1431, 1274], confidence: "visible" },
  ],
  uncertainFarReturnPixel: [1465, 1278],
  glazingEndpointsX: [996, 1497],
  mullionPixelsX: [
    996, 1020, 1042, 1066, 1089, 1109, 1132, 1152, 1171, 1189, 1207, 1224, 1241,
    1257, 1273, 1288, 1302, 1316, 1330, 1344, 1357, 1369, 1381, 1393, 1404,
    1415, 1425, 1435, 1445, 1455, 1464, 1473, 1481, 1489, 1497,
  ],
  // Recessed gallery wall has fine pale vertical panels. Samples are from
  // unobstructed patches; gaps behind columns/planters are inferred below.
  galleryWallEndpointsX: [970, 1484],
  galleryPanelSeamPixelsX: [
    970, 979, 987, 995, 1003, 1011, 1019, 1027, 1035, 1043, 1051, 1059, 1067,
    1096, 1104, 1112, 1120, 1127, 1134, 1141, 1148, 1155, 1162, 1169, 1176,
    1227, 1233, 1239, 1245, 1251, 1257, 1263, 1269, 1275, 1310, 1315, 1320,
    1325, 1330, 1335, 1377, 1382, 1387, 1392, 1397, 1402, 1407, 1412, 1417,
    1446, 1450, 1454, 1458, 1462, 1466, 1470, 1474, 1478, 1484,
  ],
  // Visible dark upper rectangle only. Its bottom/possible door continuation
  // is obscured by terrace masonry, so no door or transparent pane is inferred.
  galleryServiceRecessPixels: [
    [1072, 1233],
    [1084, 1256],
  ],
  lowerWindowPixelsX: [
    [1078, 1120],
    [1135, 1174],
    [1187, 1223],
    [1237, 1485],
  ],
} as const;

/** One-dimensional projective rectification using the along-face vanishing
 * point. Different image depths have separately registered endpoints. */
export function panPacificPhotoStation(
  x: number,
  endpoints: readonly [number, number],
): number {
  const v = PAN_PACIFIC_HOWE_PHOTO_TRACE.vanishingPoint[0];
  return (
    (x - endpoints[0]) /
    (v - x) /
    ((endpoints[1] - endpoints[0]) / (v - endpoints[1]))
  );
}

/** Fill only occluded panel intervals at the median rectified seam pitch.
 * These inferred seams carry no claim of an exact hidden panel count. */
function galleryPanelStations(): number[] {
  const observed = PAN_PACIFIC_HOWE_PHOTO_TRACE.galleryPanelSeamPixelsX.map(
    (x) =>
      panPacificPhotoStation(
        x,
        PAN_PACIFIC_HOWE_PHOTO_TRACE.galleryWallEndpointsX,
      ),
  );
  const gaps = observed
    .slice(1)
    .map((u, i) => u - observed[i])
    .sort((a, b) => a - b);
  const pitch = gaps[Math.floor(gaps.length / 2)];
  return observed.flatMap((u, i) => {
    if (i === observed.length - 1) return [u];
    const count = Math.max(1, Math.round((observed[i + 1] - u) / pitch));
    return Array.from(
      { length: count },
      (_, j) => u + ((observed[i + 1] - u) * j) / count,
    );
  });
}

export const PAN_PACIFIC_HOWE_RUN = [
  [-130.7525017667, 106.1208705729],
  [-120.9504206147, 100.9445142506],
  [-108.3674527358, 94.1651572612],
  [-90.2227114033, 84.1464030898],
  [-84.3414627125, 80.8958739586],
  [-76.4126681809, 76.5098860215],
] as const;
export const PAN_PACIFIC_HOWE_RUN_STATIONS = [
  0, 11.0849203734, 25.3779523062, 46.104917187, 52.8246661254, 61.8857186531,
] as const;
export const PAN_PACIFIC_HOWE_LENGTH = 61.8857186531;
export type PanPacificHoweTier = "lower" | "middle" | "upper";
export const PAN_PACIFIC_HOWE_PODIUM = {
  floor: 7.7989358902,
  // This vertical skirt closes the already-raised PIER edge. No floor is added.
  retainingBottom: 3.7,
  recess: 2.8,
  columnInset: 0.69,
  columnRadius: 0.43,
  galleryY: 10.85,
  galleryInset: 1.08,
  guardHeight: 1.08,
  galleryWall: {
    bottom: 11.02,
    top: 13.48,
    panelBoundaries: galleryPanelStations(),
    recess: {
      start: panPacificPhotoStation(
        1072,
        PAN_PACIFIC_HOWE_PHOTO_TRACE.galleryWallEndpointsX,
      ),
      end: panPacificPhotoStation(
        1084,
        PAN_PACIFIC_HOWE_PHOTO_TRACE.galleryWallEndpointsX,
      ),
      bottom: 11.95,
      top: 13.3,
    },
  },
  lowerBeamBottom: 14.26,
  tiers: {
    lower: { scale: 1, bottom: 7.653739, top: 14.802531 },
    middle: { scale: 0.94, bottom: 14.648794, top: 20.200424 },
    upper: { scale: 0.8, bottom: 20.046688, top: 25.495827 },
  },
  // The near, partly hidden support is set 0.62m from the preserved end face:
  // its visible centre trace has uncertainty greater than this adjustment.
  supports: PAN_PACIFIC_HOWE_PHOTO_TRACE.supports.map(
    ({ pixel, confidence }, index) => ({
      u:
        index === 0
          ? 0.62 / PAN_PACIFIC_HOWE_LENGTH
          : panPacificPhotoStation(
              pixel[0],
              PAN_PACIFIC_HOWE_PHOTO_TRACE.supportEndpointsX,
            ),
      tracedU: panPacificPhotoStation(
        pixel[0],
        PAN_PACIFIC_HOWE_PHOTO_TRACE.supportEndpointsX,
      ),
      confidence,
    }),
  ),
  paneBoundaries: PAN_PACIFIC_HOWE_PHOTO_TRACE.mullionPixelsX.map((x) =>
    panPacificPhotoStation(x, PAN_PACIFIC_HOWE_PHOTO_TRACE.glazingEndpointsX),
  ),
  lowerWindowGroups: PAN_PACIFIC_HOWE_PHOTO_TRACE.lowerWindowPixelsX.map(
    (pair) =>
      pair.map((x) => panPacificPhotoStation(x, [990, 1485])) as [
        number,
        number,
      ],
  ),
} as const;
