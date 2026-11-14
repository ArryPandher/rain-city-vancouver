import type { Building } from "./data";
import { isHouse, isIndustrial, isUtilityBuilding } from "./building-use";

export function footprintArea(points: number[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 2) {
    const next = (i + 2) % points.length;
    sum += points[i] * points[next + 1] - points[next] * points[i + 1];
  }
  return Math.abs(sum) / 2;
}

/** Missing heights are explicit building-type estimates, in metres. */
export function buildingHeight(building: Building) {
  if (building.height && Number.isFinite(building.height))
    return Math.max(2.4, Math.min(400, building.height));
  if (building.levels && Number.isFinite(building.levels))
    return Math.max(
      isIndustrial(building.kind) ? 5.4 : 2.4,
      building.levels * 3.2,
    );
  if (isUtilityBuilding(building.kind)) return 3.2;
  if (isHouse(building.kind)) return 6.4;
  if (isIndustrial(building.kind)) return 6.5;
  if (building.kind === "retail") return 6.4;
  if (building.kind === "apartments" || building.kind === "residential")
    return 9.6;
  if (building.kind === "office" || building.kind === "hotel") return 12.8;
  const area = footprintArea(building.pts);
  return area < 160 ? 6.4 : area < 700 ? 9.6 : 12.8;
}
