import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import { buildWaterfrontCentre } from "./waterfront-centre";
import { createWaterfrontCentreMaterials } from "./waterfront-centre-materials";
import { WATERFRONT_CENTRE_ID } from "./waterfront-centre-site";

/** One source-registered replacement and one static exterior reflection capture. */
export function waterfrontCentre(
  building: Building,
  batch: Batcher,
  library: Materials,
  reflections: ReflectionProbeSpec[],
) {
  if (building.id !== WATERFRONT_CENTRE_ID) return false;
  const materials = createWaterfrontCentreMaterials(library);
  if (!buildWaterfrontCentre(batch, building, materials)) return false;
  reflections.push({
    name: "Waterfront Centre northeast exterior",
    // Outside the mapped north/east corner, above the raised public approach.
    // A bounded approximation for the broad harbour-facing reflections.
    position: [393, 36, -555],
    materials: [materials.glass, materials.spandrel],
    intensity: { day: 0.9, night: 0.9 },
  });
  return true;
}
