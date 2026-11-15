import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import { buildPwcPlace } from "./pwc-place";
import { createPwcPlaceMaterials } from "./pwc-place-materials";
import { PWC_PLACE_ID } from "./pwc-place-site";

/** Root calls this before generic architecture; no parkade or neighbour dispatch. */
export function pwcPlace(
  building: Building,
  batch: Batcher,
  library: Materials,
  reflections: ReflectionProbeSpec[],
  groundHeight?: (x: number, z: number) => number,
) {
  if (building.id !== PWC_PLACE_ID) return false;
  const m = createPwcPlaceMaterials(library),
    baseY = batch.offsetY;
  if (!buildPwcPlace(batch, building, m, groundHeight)) return false;
  reflections.push({
    name: "PwC Place Howe exterior",
    position: [469, baseY + 35, -437],
    materials: [m.glass, m.spandrel, m.metal],
    intensity: { day: 0.85, night: 0.85 },
  });
  reflections.push({
    name: "PwC Place street lobby",
    position: [461, baseY + 3.5, -419],
    materials: [m.lobbyGlass],
    intensity: { day: 1, night: 1 },
  });
  return true;
}
