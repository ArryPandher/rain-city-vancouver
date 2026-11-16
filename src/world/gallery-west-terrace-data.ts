/** Official 2023 Gallery exterior: five narrow columnar conifers above a
 * recessed lower frontage. Locations/heights are bounded photographic fits. */
export const GALLERY_WEST_TERRACE = {
  minU: -27.8,
  maxU: -9.4,
  frontV: 28.3,
  beamBackV: 27.15,
  rearV: 24.15,
  capY: 3.199517011642456,
  datum: 0.08,
  bottom: -0.08,
  beamBottom: 2.42,
  ceilingBottom: 2.94,
  planter: { minU: -27.8, maxU: -9.4, minV: 27.05, maxV: 28.1 },
  planterHeight: 0.64,
  wall: 0.12,
  piers: [-27.25, -21.55, -15.85, -10.15],
  pierWidth: 0.65,
  trees: [
    { u: -26.4, v: 27.58, height: 5.5, width: 0.98 },
    { u: -22.65, v: 27.58, height: 6.5, width: 1.08 },
    { u: -18.9, v: 27.58, height: 7.3, width: 1.2 },
    { u: -15.15, v: 27.58, height: 6.1, width: 1.05 },
    { u: -11.4, v: 27.58, height: 9.5, width: 1.48 },
  ],
} as const;
export type GalleryWestBox = {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  bottom: number;
  top: number;
  role: "stone" | "metal" | "glass";
  openTop?: boolean;
};
/** Every hard rendered member and contact volume uses this same finite list. */
export function galleryWestTerraceBoxes(): GalleryWestBox[] {
  const d = GALLERY_WEST_TERRACE,
    p = d.planter;
  const boxes: GalleryWestBox[] = [
    {
      minU: d.minU,
      maxU: d.maxU,
      minV: d.beamBackV,
      maxV: d.frontV,
      bottom: d.beamBottom,
      top: d.capY,
      role: "stone",
      openTop: true,
    },
    {
      minU: d.minU,
      maxU: d.maxU,
      minV: d.rearV,
      maxV: d.beamBackV,
      bottom: d.ceilingBottom,
      top: d.capY,
      role: "stone",
      openTop: true,
    },
    {
      minU: d.minU,
      maxU: d.minU + 0.22,
      minV: d.rearV,
      maxV: d.beamBackV,
      bottom: d.bottom,
      top: d.ceilingBottom,
      role: "stone",
    },
    {
      minU: d.maxU - 0.22,
      maxU: d.maxU,
      minV: d.rearV,
      maxV: d.beamBackV,
      bottom: d.bottom,
      top: d.ceilingBottom,
      role: "stone",
    },
    {
      minU: d.minU + 0.22,
      maxU: d.maxU - 0.22,
      minV: d.rearV,
      maxV: d.rearV + 0.1,
      bottom: d.bottom,
      top: d.ceilingBottom,
      role: "glass",
    },
  ];
  for (const u of d.piers)
    boxes.push({
      minU: u - d.pierWidth / 2,
      maxU: u + d.pierWidth / 2,
      minV: d.frontV - 0.8,
      maxV: d.frontV - 0.15,
      bottom: d.bottom,
      top: d.beamBottom,
      role: "stone",
    });
  for (const [minU, maxU, minV, maxV] of [
    [p.minU, p.maxU, p.minV, p.minV + d.wall],
    [p.minU, p.maxU, p.maxV - d.wall, p.maxV],
    [p.minU, p.minU + d.wall, p.minV + d.wall, p.maxV - d.wall],
    [p.maxU - d.wall, p.maxU, p.minV + d.wall, p.maxV - d.wall],
  ])
    boxes.push({
      minU,
      maxU,
      minV,
      maxV,
      bottom: d.capY,
      top: d.capY + d.planterHeight,
      role: "stone",
    });
  for (let i = 0; i <= 6; i++) {
    const u = d.minU + 0.22 + ((d.maxU - d.minU - 0.44) * i) / 6;
    boxes.push({
      minU: u - 0.035,
      maxU: u + 0.035,
      minV: d.rearV + 0.09,
      maxV: d.rearV + 0.18,
      bottom: d.bottom,
      top: d.ceilingBottom,
      role: "metal",
    });
  }
  for (const y of [0.08, 2.25, 2.86])
    boxes.push({
      minU: d.minU + 0.22,
      maxU: d.maxU - 0.22,
      minV: d.rearV + 0.09,
      maxV: d.rearV + 0.18,
      bottom: y - 0.04,
      top: y + 0.04,
      role: "metal",
    });
  return boxes;
}
