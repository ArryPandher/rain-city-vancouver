import * as T from "three";
import type { VehicleModel } from "./vehicles";
import { batchCarWheels, syncCarWheelBatches } from "./wheel-batching";
const levels = new WeakMap<
  T.Object3D,
  { far: VehicleModel; nearObjects: T.Object3D[]; distant: boolean }
>();
/** Conservative ranges: a 4.9 m car spans ~14 px at 200 m / 670 px / 62°.
 * Existing source simplification error .003 is subpixel here; hysteresis avoids
 * repeated changes. No fading shaders interfere with wheel/depth callbacks. */
export function useDistantCar(
  distance: number,
  previous: boolean,
  driven: boolean,
) {
  return !driven && distance > (previous ? 200 : 240);
}
export function attachCarLOD(
  near: VehicleModel,
  far: VehicleModel,
  multiDraw: boolean,
) {
  if (levels.has(near.group)) return;
  batchCarWheels(far.group, multiDraw);
  const nearObjects = near.group.children.slice();
  far.group.name = "Distant source car";
  far.group.visible = false;
  near.group.add(far.group);
  levels.set(near.group, { far, nearObjects, distant: false });
}
export function updateCarLOD(
  near: VehicleModel,
  distance: number,
  driven: boolean,
) {
  const record = levels.get(near.group);
  if (!record) return;
  const distant = useDistantCar(distance, record.distant, driven);
  if (distant !== record.distant) {
    record.nearObjects.forEach((object) => (object.visible = !distant));
    record.far.group.visible = distant;
    record.distant = distant;
  }
  if (distant) syncCarLOD(near);
}
export function syncCarLOD(near: VehicleModel) {
  const record = levels.get(near.group);
  if (!record?.distant) return;
  const far = record.far;
  near.wheels.forEach((wheel, i) =>
    far.wheels[i].rotation.copy(wheel.rotation),
  );
  near.front.forEach((wheel, i) => far.front[i].rotation.copy(wheel.rotation));
  far.body.position.copy(near.body.position);
  far.body.quaternion.copy(near.body.quaternion);
  far.brakes.emissive.copy(near.brakes.emissive);
  far.brakes.emissiveIntensity = near.brakes.emissiveIntensity;
  far.headlights.emissive.copy(near.headlights.emissive);
  far.headlights.emissiveIntensity = near.headlights.emissiveIntensity;
  syncCarWheelBatches(far.group);
}
