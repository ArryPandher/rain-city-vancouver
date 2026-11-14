import polygonClipping from "polygon-clipping";
import { Building, Point, pointInPoly } from "./data";
export const CONVENTION_ID = "w85240507";
export type RoofPlane = {
  name: string;
  outline: Point[];
  height: (e: number, n: number) => number;
};
export function offsetOutline(p: Point[], distance: number): Point[] {
  const area = p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return p.map((a, i) => {
    const previous = p[(i + p.length - 1) % p.length],
      next = p[(i + 1) % p.length];
    const normal = (a: Point, b: Point): Point => {
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [
        ((b[1] - a[1]) / d) * Math.sign(area),
        (-(b[0] - a[0]) / d) * Math.sign(area),
      ];
    };
    const u = normal(previous, a),
      v = normal(a, next),
      denominator = Math.max(0.15, 1 + u[0] * v[0] + u[1] * v[1]);
    return [
      a[0] + (distance * (u[0] + v[0])) / denominator,
      a[1] + (distance * (u[1] + v[1])) / denominator,
    ];
  });
}
/** Local axes follow the mapped north facade, not the downtown 45-degree grid.
 * Roof subdivisions/heights are interpretations of the 2006 plan and photos. */
export function conventionSite(b: Building) {
  const origin: Point = [b.pts[16], b.pts[17]];
  const dx = b.pts[4] - b.pts[14],
    dz = b.pts[5] - b.pts[15],
    length = Math.hypot(dx, dz);
  const east: Point = [dx / length, dz / length];
  const world = (e: number, n: number): Point => [
    origin[0] + e * east[0] + n * east[1],
    origin[1] + e * east[1] - n * east[0],
  ];
  const local = (x: number, z: number): Point => [
    (x - origin[0]) * east[0] + (z - origin[1]) * east[1],
    (x - origin[0]) * east[1] - (z - origin[1]) * east[0],
  ];
  const mapped = Array.from({ length: b.pts.length / 2 }, (_, i) =>
    local(b.pts[i * 2], b.pts[i * 2 + 1]),
  );
  // Smooth out the two shallow roof notches for the ground glazing and promenade.
  const outline = mapped.filter((_, i) => ![3, 4, 5, 6].includes(i));
  const body = offsetOutline(outline, -3.8);
  // Outer promenade follows the mapped cycleway and outer footpath, including
  // the broad northeast corner. A uniform roof buffer would cut across them.
  const platform: Point[] = [
    [173, -29],
    [195, -29],
    [201, -6],
    [192, 16],
    [220, 120],
    [216, 133],
    [195, 135],
    [147, 131.5],
    [49, 133],
    [40, 130],
    [-6, 0],
    [59, -28],
  ];
  const shoreSegments = [4, 5, 6, 7, 8].map(
    (i) => [platform[i], platform[i + 1]] as [Point, Point],
  );
  const baseHeight = (e: number, n: number) =>
    11.4 + 0.018 * (n + 24) + 0.012 * e;
  const clip = (p: Point[]) =>
    polygonClipping
      .intersection([outline], [p])
      .map((p) => p[0].slice(0, -1) as Point[])[0];
  const roofs: RoofPlane[] = [
    {
      name: "central hall",
      outline: clip([
        [58, 8],
        [132, 15],
        [132, 125],
        [50, 125],
      ]),
      height: (_e, n) => 23.5 + (n - 8) * 0.042,
    },
    {
      name: "eastern hall",
      outline: clip([
        [152, -35],
        [230, -35],
        [230, 125],
        [152, 125],
      ]),
      height: (_e, n) => 14.8 + (n + 24) * 0.13,
    },
  ];
  const base = polygonClipping.difference(
    [outline],
    ...roofs.map((r) => [r.outline]),
  );
  const flatWorld = (p: Point[]) => p.flatMap(([e, n]) => world(e, n));
  return {
    world,
    local,
    outline,
    body,
    platform,
    shoreSegments,
    roofs,
    base,
    baseHeight,
    flatWorld,
    footprint: flatWorld(body),
    platformWorld: flatWorld(platform),
    deckHeight: 0.04,
  };
}
export type ConventionSite = ReturnType<typeof conventionSite>;
export function conventionDeckHeight(
  site: ConventionSite | undefined,
  x: number,
  z: number,
) {
  return site && pointInPoly(x, z, site.platformWorld)
    ? site.deckHeight
    : undefined;
}
