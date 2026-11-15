import * as T from "three";

/** Source front axles are posed 30 degrees for display. Remove that pose before
 * the game's steering/spin hierarchy acts, retaining source tyre/rim surfaces. */
export function wheelFrame(source: T.Object3D, carTransform: T.Matrix4) {
  const matrix = carTransform.clone().multiply(source.matrixWorld);
  const center = new T.Vector3().setFromMatrixPosition(matrix);
  const axle = new T.Vector3(1, 0, 0).transformDirection(matrix);
  const neutral = new T.Quaternion().setFromUnitVectors(
    axle,
    new T.Vector3(1, 0, 0),
  );
  return { center, neutral };
}
export function canonicalWheelGeometry(
  mesh: T.Mesh,
  carTransform: T.Matrix4,
  frame: ReturnType<typeof wheelFrame>,
) {
  const geometry = mesh.geometry
    .clone()
    .applyMatrix4(carTransform.clone().multiply(mesh.matrixWorld));
  geometry.translate(-frame.center.x, -frame.center.y, -frame.center.z);
  geometry.applyQuaternion(frame.neutral);
  return geometry;
}
export function tyreRadius(geometry: T.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  let radius = 0;
  for (let i = 0; i < positions.count; i++)
    radius = Math.max(radius, Math.hypot(positions.getY(i), positions.getZ(i)));
  return radius;
}
