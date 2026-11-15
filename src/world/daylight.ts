import * as T from "three";

// Calibrated from the unclamped 2K Rustig Koppie Pure Sky solar disc.
// Rotate only around vertical: keep the photographed horizon level.
export const DAYLIGHT_SKY_ROTATION = 0.6112152105481597;
export const DAYLIGHT_SUN_HEIGHT = 149.61315223935466;

/** Target-to-sun direction: east at 28.288°, a plausible Vancouver summer
 * morning. The sky turns around vertical only; other weather keeps its offset. */
export function sunOffset(weather: string, target = new T.Vector3()) {
  return weather === "day"
    ? target.set(278, DAYLIGHT_SUN_HEIGHT, 0)
    : target.set(-220, 110, 170);
}
