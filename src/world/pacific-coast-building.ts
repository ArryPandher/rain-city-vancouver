import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { buildPacificCoast } from "./pacific-coast";
import { createPacificCoastMaterials } from "./pacific-coast-materials";

/** The 325 Howe replacement owns its complete facade and below-grade base. */
export function pacificCoast(
  building: Building,
  batch: Batcher,
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
) {
  if (building.id !== "w143683962") return false;
  const materials = createPacificCoastMaterials(library);
  if (!buildPacificCoast(batch, building, materials)) return false;
  reflections.push({
    name: "325 Howe Cordova paired windows",
    // Outside the street corner; a shared static environment approximation.
    position: [431.2, batch.offsetY + 10.8, -398.8],
    materials: [materials.glass],
    intensity: { day: 0.8, night: 0.75 },
  });
  return true;
}
