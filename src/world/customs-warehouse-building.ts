import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { buildCustomsWarehouse } from "./customs-warehouse";
import { createCustomsWarehouseMaterials } from "./customs-warehouse-materials";

/** Exact-building dispatch: no generic photo wall or invented retail frontage.
 * The masonry base itself closes below the shared street, so this building
 * does not need the generic concrete foundation strip.
 */
export function customsWarehouse(
  building: Building,
  batch: Batcher,
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
) {
  if (building.id !== "w1363485360") return false;
  const materials = createCustomsWarehouseMaterials(library);
  if (!buildCustomsWarehouse(batch, building, materials)) return false;
  reflections.push({
    name: "Customs Warehouse Howe Cordova windows",
    // Just outside the mapped street corner, between the lower window bands.
    // One static capture is an approximate shared environment, not ray tracing.
    position: [441.05, batch.offsetY + 11.7, -387.1],
    materials: [materials.glass],
    intensity: { day: 0.8, night: 0.75 },
  });
  return true;
}
