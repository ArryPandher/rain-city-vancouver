import type { Materials } from "./materials";
import type { Road } from "./data";
import {
  createCordovaPavementMaterial,
  CORDOVA_AGGREGATE_REPEAT_METRES,
} from "./cordova-pavement-material";

/** Four existing asphalt approaches to Hornby/Robson. Match source identity
 * and surface: no bike path, crossing paint, footway or public plaza remap. */
export const ROBSON_ASPHALT_ROADS: ReadonlySet<string> = new Set([
  "w543495974",
  "w476504051",
  "w1255620279",
  "w74366445",
]);
export const ROBSON_AGGREGATE_REPEAT_METRES = CORDOVA_AGGREGATE_REPEAT_METRES;
export function hasRobsonAsphalt(road: Pick<Road, "id" | "kind" | "surface">) {
  return (
    !!road.id &&
    ROBSON_ASPHALT_ROADS.has(road.id) &&
    road.kind === "secondary" &&
    road.surface === "asphalt"
  );
}

/** Reuse the existing matched CC0 crop and its verified sampler transform.
 * The material and three sampler wrappers are independent; Materials' URL
 * cache shares their image Sources with Cordova. No new texture preparation. */
export function createRobsonRoadMaterial(
  library: Pick<Materials, "asphalt" | "texture">,
) {
  const material = createCordovaPavementMaterial(library);
  material.name = "Robson Hornby fine road aggregate";
  material.userData.robsonAsphalt = true;
  for (const map of [material.map, material.normalMap, material.roughnessMap])
    if (map) map.name = map.name.replace("Howe Cordova", "Robson Hornby");
  return material;
}
