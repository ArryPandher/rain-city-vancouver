import * as T from "three";

// Calibrated from the unclamped 2K Rustig Koppie Pure Sky solar disc.
// Rotate only around vertical: keep the photographed horizon level.
export const DAYLIGHT_SKY_ROTATION = -0.17418295284928853;
export const DAYLIGHT_SUN_HEIGHT = 149.61315223935466;
const DAYLIGHT_HORIZONTAL_COMPONENT = 278 * Math.SQRT1_2;

/** Southeast at azimuth135°/elevation28.288° separates Howe's long lit face
 * from its shaded Cordova return. This is an authored daylight composition,
 * not a simulation of the HUD clock. Other weather keeps its original offset. */
export function sunOffset(weather: string, target = new T.Vector3()) {
  return weather === "day"
    ? target.set(
        DAYLIGHT_HORIZONTAL_COMPONENT,
        DAYLIGHT_SUN_HEIGHT,
        DAYLIGHT_HORIZONTAL_COMPONENT,
      )
    : target.set(-220, 110, 170);
}
