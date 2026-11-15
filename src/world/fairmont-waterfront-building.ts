import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import { buildFairmontWaterfront } from "./fairmont-waterfront";
import { createFairmontWaterfrontMaterials } from "./fairmont-waterfront-materials";
import { FAIRMONT_WATERFRONT_ID } from "./fairmont-waterfront-site";

/** Root integration calls this before the generic shell dispatch. */
export function fairmontWaterfront(
  building: Building,
  batch: Batcher,
  library: Materials,
  reflections: ReflectionProbeSpec[],
) {
  if (building.id !== FAIRMONT_WATERFRONT_ID) return false;
  const baseY = batch.offsetY;
  const materials = createFairmontWaterfrontMaterials(library);
  if (!buildFairmontWaterfront(batch, building, materials)) return false;
  reflections.push({
    name: "Fairmont Waterfront harbour exterior",
    position: [472, baseY + 35, -520],
    materials: [materials.glass, materials.metal, materials.canopyGlass],
    intensity: { day: 0.9, night: 0.9 },
  });
  return true;
}
