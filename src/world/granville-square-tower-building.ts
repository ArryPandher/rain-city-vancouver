import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import { buildGranvilleSquareTower } from "./granville-square-tower";
import { createGranvilleSquareTowerMaterials } from "./granville-square-tower-materials";
import { GRANVILLE_SQUARE_TOWER_ID as ID } from "./granville-square-tower-data";
import { GRANVILLE_SQUARE_OFFICE_PROBE } from "./granville-square-tower-glazing";
import { centroid } from "./data";
import {
  createGranvilleSquareEntranceSite,
  createGranvilleSquareEntranceGeometry,
  createGranvilleSquareCanopyGlass,
} from "./granville-square-entrance";

/** Root calls before the generic fallback. Does not replace the parkade or wing. */
export function granvilleSquareTower(
  building: Building,
  batch: Batcher,
  library: Materials,
  reflections: ReflectionProbeSpec[],
  groundHeight?: (x: number, z: number) => number,
) {
  if (building.id !== ID) return false;
  const m = createGranvilleSquareTowerMaterials(library);
  if (!buildGranvilleSquareTower(batch, building, m, groundHeight))
    return false;
  const originalOffset = batch.offsetY,
    site = createGranvilleSquareEntranceSite(
      groundHeight ?? (() => originalOffset),
    ),
    entrance = createGranvilleSquareEntranceGeometry(site),
    canopyGlass = createGranvilleSquareCanopyGlass(),
    [x, z] = centroid(building.pts);
  batch.offsetY = 0;
  batch.add(entrance.frame, m.frame, x, z);
  batch.add(entrance.glass, canopyGlass, x, z);
  batch.offsetY = originalOffset;
  reflections.push({
    name: "Granville Square southeast exterior",
    position: [...GRANVILLE_SQUARE_OFFICE_PROBE],
    materials: [m.glass, m.lobbyGlass, m.frame, canopyGlass],
    intensity: { day: 0.85, night: 0.85 },
  });
  return true;
}
