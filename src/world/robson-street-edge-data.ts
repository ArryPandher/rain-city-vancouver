/** Hornby/Robson only. Ground-plan fit from mapped 2026 roads/City trees and
 * georeferenced imagery; section widths/heights are estimates, not a survey. */
export const ROBSON_STREET_EDGE = {
  origin: [-130.8, 38.5] as const,
  axis: [Math.SQRT1_2, -Math.SQRT1_2] as const,
  // U follows Hornby northeast; V points southeast toward the public plaza.
  bounds: { minU: -43, maxU: 38, minV: -39, maxV: 14 },
  roadIds: ["w543495974", "w476504051", "w1255620279", "w74366445"],
  protectedIds: [
    "w50098016",
    "w1207329136",
    "w1208383237",
    "w1208383238",
    "w1208383241",
    "w1208383242",
  ],
  gutterWidth: 0.32,
  curbWidth: 0.18,
  curbRise: 0.14,
  roadFinish: 0.094,
  apronExtent: 6.6,
  treeOpeningHalf: 0.72,
  sampleStep: 0.8,
} as const;
export function robsonStreetLocal(x: number, z: number): [number, number] {
  const [cx, cz] = ROBSON_STREET_EDGE.origin;
  return [(x - cx - z + cz) * Math.SQRT1_2, (x - cx + z - cz) * Math.SQRT1_2];
}
export function robsonStreetWorld(u: number, v: number): [number, number] {
  const [cx, cz] = ROBSON_STREET_EDGE.origin;
  return [cx + (u + v) * Math.SQRT1_2, cz + (-u + v) * Math.SQRT1_2];
}
