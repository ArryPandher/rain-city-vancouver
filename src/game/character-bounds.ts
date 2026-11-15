import * as T from "three";

/** Whole-character envelope, intentionally shared in shape but never by object.
 * It covers locomotion and procedural arm/leg poses, not only the bind pose.
 * Mesh-local spheres follow the body/root transforms, including a fallen actor.
 * Camera and shadow frusta remain independent; no visibility flag is changed.
 */
export function installCharacterBounds(root: T.Object3D, height: number) {
  root.updateWorldMatrix(true, true);
  const envelope = new T.Sphere(new T.Vector3(0, height / 2, 0), height * 0.8);
  root.traverse((object) => {
    const mesh = object as T.Mesh & { boundingSphere: T.Sphere };
    if (!mesh.isMesh) return;
    const rootToMesh = new T.Matrix4()
      .copy(mesh.matrixWorld)
      .invert()
      .multiply(root.matrixWorld);
    mesh.boundingSphere = envelope.clone().applyMatrix4(rootToMesh);
    mesh.frustumCulled = true;
  });
}
