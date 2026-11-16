import * as T from "three";
import { DAYLIGHT_SKY_ROTATION, sunOffset } from "./daylight";

export type DebugDaylightOrientation = "southeast" | "southwest";
const up = new T.Vector3(0, 1, 0);
const yaw = (orientation: DebugDaylightOrientation = "southeast") =>
  orientation === "southwest" ? -Math.PI / 2 : 0;

/** Debug comparison only. The existing authored SE baseline is unchanged;
 * SW rotates the same measured HDR disc and direct light around vertical. */
export function comparisonSunOffset(
  weather: string,
  target = new T.Vector3(),
  orientation: DebugDaylightOrientation = "southeast",
) {
  sunOffset(weather, target);
  if (weather === "day" && orientation === "southwest")
    target.applyAxisAngle(up, yaw(orientation));
  return target;
}

type DirectionalState = {
  weather: string;
  scene: T.Scene;
  sun: T.DirectionalLight;
  water: Pick<T.ShaderMaterial, "uniforms">;
};

/** Changes direction only: no light, material, exposure or weather scalars. */
export function applyDaylightOrientation(
  state: DirectionalState,
  orientation: DebugDaylightOrientation = "southeast",
) {
  comparisonSunOffset(state.weather, state.sun.position, orientation).add(
    state.sun.target.position,
  );
  const rotation = DAYLIGHT_SKY_ROTATION + yaw(orientation),
    day = state.weather === "day";
  state.scene.backgroundRotation.set(0, day ? rotation : 2.3, 0);
  state.scene.environmentRotation.set(0, day ? rotation : 1.2, 0);
  state.water.uniforms.sunDir.value
    .copy(state.sun.position)
    .sub(state.sun.target.position)
    .normalize();
}

export function daylightOrientationProfile(
  state: DirectionalState,
  orientation: DebugDaylightOrientation = "southeast",
) {
  const direction = state.sun.position
    .clone()
    .sub(state.sun.target.position)
    .normalize();
  return {
    selected: orientation,
    active: state.weather === "day" ? orientation : "weather-default",
    azimuthDegrees:
      (T.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z)) + 360) % 360,
    elevationDegrees: T.MathUtils.radToDeg(Math.asin(direction.y)),
    direction: direction.toArray(),
  };
}

/** Shared UI action keeps a changed solar direction from showing stale local
 * cubes or shadows. Existing capture scheduling/budgets remain responsible for
 * recapture; invalidation exposes the newly rotated distant sky in the interim. */
export function changeDebugDaylightOrientation(
  world: { setDebugDaylightOrientation(value: DebugDaylightOrientation): void },
  orientation: DebugDaylightOrientation,
  shadowMap: { needsUpdate: boolean },
  reflections?: { invalidate(): void },
) {
  world.setDebugDaylightOrientation(orientation);
  shadowMap.needsUpdate = true;
  reflections?.invalidate();
}
