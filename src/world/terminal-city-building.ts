import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import { buildTerminalCity } from "./terminal-city";
import {
  buildTerminalCityClub,
  TERMINAL_CITY_CLUB_ID,
} from "./terminal-city-club";
import { TERMINAL_CITY_ID } from "./terminal-city-site";
import {
  createTerminalCityMaterials,
  type TerminalCityMaterials,
} from "./terminal-city-materials";

/** Both registered parcels share one material set and one exterior capture.
 * State belongs to one architecture build, never to a global material cache. */
export function createTerminalCityAssembly(
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
) {
  let materials: TerminalCityMaterials | undefined;
  let probe: ReflectionProbeSpec | undefined;
  return (building: Building, batch: Batcher) => {
    if (
      building.id !== TERMINAL_CITY_ID &&
      building.id !== TERMINAL_CITY_CLUB_ID
    )
      return false;
    materials ??= createTerminalCityMaterials(library);
    // Never cache the first parcel's datum: architecture resets offsetY for
    // each mapped building, and tower/club grades need not be identical.
    const baseY = batch.offsetY;
    const built =
      building.id === TERMINAL_CITY_ID
        ? buildTerminalCity(batch, building, materials)
        : buildTerminalCityClub(batch, building, materials);
    if (built && !probe) {
      probe = {
        name: "Terminal City Hornby exterior",
        // Outside the mapped building footprints, overlooking the long facade.
        // One shared static approximation; not an interior or ray-traced view.
        position: [309, baseY + 45, -399],
        materials: [materials.glass, materials.spandrel],
        intensity: { day: 0.9, night: 0.9 },
      };
      reflections.push(probe);
    }
    // Prefer the main tower's datum independent of parcel build order. A
    // standalone club assembly uses its own datum until the tower is present.
    if (built && probe && building.id === TERMINAL_CITY_ID)
      probe.position[1] = baseY + 45;
    return built;
  };
}
