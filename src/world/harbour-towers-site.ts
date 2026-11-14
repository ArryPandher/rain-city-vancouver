import polygonClipping from "polygon-clipping";
import map from "./harbour-towers-map.json";
import type { Point } from "./data";

/** OSM supplies the stepped plan, ASPAC the overall architectural scale.
 * Three's 135m OSM tag conflicts with ASPAC's 116m; retain the source values
 * in the JSON and proportion the upper parts to the developer's stated height.
 * Podium grades and intermediate floor spacing remain interpretations. */
export const harbourTowers = map.buildings.map((b, index) => {
  const podium = b.parts[0].sourceHeight;
  const max = Math.max(...b.parts.map((p) => p.sourceHeight));
  const scale = (h: number) =>
    h <= podium
      ? h
      : podium + ((h - podium) * (b.height - podium)) / (max - podium);
  return {
    ...b,
    index,
    podium,
    parts: b.parts.map((p) => {
      let pts = p.pts as Point[];
      const area = pts.reduce((a, p, i) => {
        const q = pts[(i + 1) % pts.length];
        return a + p[0] * q[1] - q[0] * p[1];
      }, 0);
      if (area < 0) pts = [...pts].reverse();
      return {
        ...p,
        pts,
        height: scale(p.sourceHeight),
        minHeight: scale(p.minHeight),
      };
    }),
  };
});
export type HarbourTower = (typeof harbourTowers)[number];
export const harbourTower = (id: string) =>
  harbourTowers.find((b) => b.id === id);
export function harbourTowerSection(
  b: HarbourTower,
  y: number,
): polygonClipping.MultiPolygon {
  const parts = b.parts.filter(
    (p, i) => (i === 0 ? y < b.podium : y >= p.minHeight) && p.height > y,
  );
  return parts.length
    ? polygonClipping.union(
        [parts[0].pts],
        ...parts.slice(1).map((p) => [p.pts]),
      )
    : [];
}
export function harbourTowerRoof(b: HarbourTower, y: number) {
  return polygonClipping.difference(
    harbourTowerSection(b, y - 0.001),
    harbourTowerSection(b, y + 0.001),
  );
}
export function harbourTowerLevels(b: HarbourTower) {
  const floors = [0, b.podium / 3, (2 * b.podium) / 3, b.podium];
  for (let i = 1; i <= b.levels - 3; i++)
    floors.push(b.podium + ((b.height - b.podium) * i) / (b.levels - 3));
  return [
    ...new Set([...floors, ...b.parts.flatMap((p) => [p.minHeight, p.height])]),
  ].sort((a, b) => a - b);
}
