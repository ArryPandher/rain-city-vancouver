import source from "./canada-place-rigging-map.json";
import concourse from "./canada-place-concourse-data.json";
/** Source mast registration; protective-body sizes/transverse offset are authored estimates.
 * Codriver CC-BY-4.0; geographic placement © OpenStreetMap contributors. */
export type StayPoint = [number, number, number];
export const GROUND_STAY_ORIGIN = [
  644.6983737463511, -622.3401999996099,
] as const;
export const GROUND_STAY_BASE_Y = 7.8;
export const GROUND_STAY_TOP_Y = 10.25;
export const CANADA_PLACE_GROUND_STAYS = source.sails.map((ring, bay) => {
  const mast = ring[0];
  const station = concourse.stations.reduce((a, b) =>
    Math.hypot(a.x - mast[0], a.z - mast[1]) <
    Math.hypot(b.x - mast[0], b.z - mast[1])
      ? a
      : b,
  );
  const normal: [number, number] = [station.nx, station.nz];
  const tangent: [number, number] = [-normal[1], normal[0]];
  const offset = bay === 0 || bay === 4 ? 14.4 : 14.7;
  const center: [number, number] = [
    mast[0] + normal[0] * offset,
    mast[1] + normal[1] * offset,
  ];
  const point = (along: number, out: number, y: number): StayPoint => [
    center[0] + along * tangent[0] + out * normal[0],
    y,
    center[1] + along * tangent[1] + out * normal[1],
  ];
  // 200mm corner chamfers match the rendered base, not an inflated facade mask.
  const perimeter = [
    [-0.75, -1.2],
    [0.75, -1.2],
    [0.95, -1.0],
    [0.95, 1.0],
    [0.75, 1.2],
    [-0.75, 1.2],
    [-0.95, 1.0],
    [-0.95, -1.0],
  ];
  const localFootprint = perimeter.flatMap(([a, o]) => {
    const p = point(a, o, 7.8);
    return [p[0], p[2]];
  });
  const worldFootprint = localFootprint.map(
    (v, i) => v + GROUND_STAY_ORIGIN[i % 2],
  );
  const stays = [-0.42, 0.42].map((along) => ({
    bottom: point(along, 0.4, 9.99),
    top: [
      mast[0] + tangent[0] * along * 0.18,
      46.17,
      mast[1] + tangent[1] * along * 0.18,
    ] as StayPoint,
  }));
  return {
    bay,
    center,
    normal,
    tangent,
    perimeter,
    point,
    localFootprint,
    worldFootprint,
    minY: 7.8,
    maxY: 10.25,
    worldMinY: 7.88,
    worldMaxY: 10.33,
    stays,
  };
});
