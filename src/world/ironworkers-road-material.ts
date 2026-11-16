import { IRONWORKERS_ALIGNMENT } from "./ironworkers-alignment";
import type { Materials } from "./materials";
import type { Road } from "./data";
import {
  createCordovaPavementMaterial,
  CORDOVA_AGGREGATE_REPEAT_METRES,
} from "./cordova-pavement-material";

/** Four source-registered Ironworkers carriageways. Match source identity
 * and surface: no bike path, crossing paint, footway or public plaza remap. */
export const IRONWORKERS_ASPHALT_ROADS: ReadonlySet<string> = new Set(
  IRONWORKERS_ALIGNMENT.roadIds,
);
export const IRONWORKERS_AGGREGATE_REPEAT_METRES =
  CORDOVA_AGGREGATE_REPEAT_METRES;
export function hasIronworkersAsphalt(
  road: Pick<Road, "id" | "kind" | "surface">,
) {
  return (
    !!road.id &&
    IRONWORKERS_ASPHALT_ROADS.has(road.id) &&
    road.kind === "primary" &&
    road.surface === "asphalt"
  );
}

/** Reuse the existing matched CC0 crop and its verified sampler transform.
 * The material and three sampler wrappers are independent; Materials' URL
 * cache shares their image Sources with Cordova. No new texture preparation. */
export function createIronworkersRoadMaterial(
  library: Pick<Materials, "asphalt" | "texture">,
) {
  const material = createCordovaPavementMaterial(library);
  material.name = "Ironworkers carriageway fine road aggregate";
  material.userData.ironworkersAsphalt = true;
  for (const map of [material.map, material.normalMap, material.roughnessMap])
    if (map)
      map.name = map.name.replace("Howe Cordova", "Ironworkers carriageway");
  return material;
}
