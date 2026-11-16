/** HOTEL31→36 only. Source envelope and decoded datums are firm; photo-zone
 * correspondence/depths are bounded reconstruction estimates, not a survey. */
export type PanPacificNearPodiumTier = "lower" | "middle" | "upper";
export const PAN_PACIFIC_NEAR_PODIUM = {
  floor: 7.798935890197754,
  glassInset: 0.18,
  backingInset: 0.7,
  spineWidth: 2.4,
  spineCurveDepth: 0.45,
  // Exact endpoints of retained face30; decoded quantization differs from the
  // ideal mapped vertex by≤5mm. Narrow connector faces close only that seam.
  retainedStart: {
    lower: [-171.6993865966797, 100.5189437866211],
    middle: [-169.32501220703125, 98.63139343261719],
    upper: [-163.7648162841797, 94.21570587158203],
  },
  sourceVertices: [
    [-171.70341857925, 100.5215001861888],
    [-152.4840787213336, 108.78140640305682],
    [-146.43583161050722, 104.1727794841559],
    [-142.1156551023319, 106.36577345230344],
    [-136.68457606351242, 108.88159394435938],
    [-130.75250176666518, 106.12087057286077],
  ] as readonly (readonly [number, number])[],
  tiers: {
    lower: { scale: 1, bottom: 7.6537394523620605, top: 14.802530288696289 },
    middle: {
      scale: 0.94,
      bottom: 14.648794174194336,
      top: 20.200424194335938,
    },
    upper: { scale: 0.8, bottom: 20.046688079833984, top: 25.495826721191406 },
  },
  // Original Handford20 pixels, approximately±5px; trees hide the far return.
  photoZones: {
    paleRoundedSpine: [
      [329, 997],
      [414, 1029],
      [414, 1266],
      [343, 1266],
    ],
    tallGlazedField: [
      [427, 1028],
      [487, 1036],
      [487, 1261],
      [427, 1262],
    ],
    pairedOpeningField: [
      [500, 1030],
      [568, 1033],
      [568, 1198],
      [499, 1198],
    ],
    middleSpine: [
      [374, 955],
      [479, 982],
      [479, 1008],
      [374, 994],
    ],
    upperSpine: [
      [449, 846],
      [566, 884],
      [566, 948],
      [449, 944],
    ],
  },
  panePixels: [427, 449, 469, 487],
} as const;
