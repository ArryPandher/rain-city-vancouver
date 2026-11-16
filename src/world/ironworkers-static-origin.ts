import * as T from "three";
/** Ironworkers builders emit world-coordinate vertices. Static batching chooses
 * its distance-culling cell from the object's position, so move the vertex
 * origin into the bridge while preserving every world-space surface. */
export function registerIronworkersStaticOrigins(root: T.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh)
      return;
    object.geometry.computeBoundingBox();
    const centre = object.geometry.boundingBox!.getCenter(new T.Vector3());
    object.geometry.translate(-centre.x, -centre.y, -centre.z);
    object.position.add(
      centre.multiply(object.scale).applyQuaternion(object.quaternion),
    );
    object.updateMatrix();
  });
}
