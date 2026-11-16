import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import { buildTerminalCity } from "./terminal-city";
import {
  buildTerminalCityClub,
  TERMINAL_CITY_CLUB_ID,
  TERMINAL_CITY_CLUB_RING,
} from "./terminal-city-club";
import { TERMINAL_CITY_ID } from "./terminal-city-site";
import {
  createTerminalCityMaterials,
  createTerminalCityClubMaterials,
  type TerminalCityMaterials,
} from "./terminal-city-materials";
import { facadeFrame } from "./architectural-mesh";

/** Mineral/metal finishes are shared; tower and club own separate receivers.
 * State belongs to one architecture build, never to a global material cache. */
export function createTerminalCityAssembly(
  library: Pick<Materials, "texture">,
  reflections: ReflectionProbeSpec[],
) {
  let materials: TerminalCityMaterials | undefined;
  let clubMaterials: TerminalCityMaterials | undefined;
  let towerProbe: ReflectionProbeSpec | undefined;
  let clubProbe: ReflectionProbeSpec | undefined;
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
    const tower = building.id === TERMINAL_CITY_ID;
    if (!tower) clubMaterials ??= createTerminalCityClubMaterials(materials);
    const built = tower
      ? buildTerminalCity(batch, building, materials)
      : buildTerminalCityClub(batch, building, clubMaterials!);
    if (built && tower && !towerProbe) {
      towerProbe = {
        name: "Terminal City Hornby exterior",
        // Outside the mapped building footprints, overlooking the long facade.
        // Tower-only static approximation; not an interior or ray-traced view.
        position: [309, baseY + 45, -399],
        materials: [materials.glass, materials.spandrel],
        intensity: { day: 0.9, night: 0.9 },
      };
      reflections.push(towerProbe);
    }
    if (built && !tower && !clubProbe) {
      const front = facadeFrame(
        TERMINAL_CITY_CLUB_RING[1],
        TERMINAL_CITY_CLUB_RING[2],
      );
      clubProbe = {
        name: "Terminal City Cordova club exterior",
        resolution: 256,
        // 4.5m outside the mapped street face, at the broad ribbon's height.
        // Captures actual Cordova surroundings, not the distant Hornby view.
        // Still a single-point approximation for the higher setback glazing.
        position: front.p(front.length / 2, baseY + 9, -4.5),
        materials: [clubMaterials!.glass, clubMaterials!.spandrel],
        intensity: { day: 0.9, night: 0.9 },
      };
      reflections.push(clubProbe);
    }
    if (built && towerProbe && tower) towerProbe.position[1] = baseY + 45;
    if (built && clubProbe && !tower) clubProbe.position[1] = baseY + 9;
    return built;
  };
}
