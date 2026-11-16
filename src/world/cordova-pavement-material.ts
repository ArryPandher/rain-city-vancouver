import * as T from "three";
import type { Materials } from "./materials";
import type { Road } from "./data";

/** Connected Howe/West Cordova approaches and the Canada Place arrival loop.
 * Whole mapped ways retain geometry, grade, markings and collision support. */
export const CORDOVA_PAVEMENT_ROADS = new Set([
  "w50162809",
  "w232195213",
  "w1153403243",
  "w1255588459",
  "w1255990033", // Howe: north of the Cordova approach to Canada Place.
  "w1550614843", // Canada Place: short turn at the arrival intersection.
  "w1255990035", // Canada Place: terminal frontage east section.
  "w706831744", // Canada Place: continuing west frontage.
]);
export const CORDOVA_AGGREGATE_REPEAT_METRES = 1.2;
export function hasCordovaPavement(road: Pick<Road, "id">) {
  return !!road.id && CORDOVA_PAVEMENT_ROADS.has(road.id);
}

export function createCordovaPavementMaterial(
  library: Pick<Materials, "asphalt" | "texture">,
) {
  const result = library.asphalt.clone();
  result.name = "Howe Cordova photographed fine road aggregate";
  for (const [channel, property] of [
    ["color", "map"],
    ["normal", "normalMap"],
    ["roughness", "roughnessMap"],
  ] as const) {
    const map = library
      .texture(`cordova-pavement/${channel}.webp`, channel === "color")
      .clone();
    map.name = `Howe Cordova road ${channel}`;
    map.colorSpace = channel === "color" ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    // World.roads writes metre coordinates divided by5 into all asphalt UVs.
    // Rotate the compact isotropic crop onto the two perpendicular approaches.
    map.repeat.setScalar(5 / CORDOVA_AGGREGATE_REPEAT_METRES);
    map.rotation = Math.PI / 4;
    map.updateMatrix();
    result[property] = map;
  }
  return result;
}
