import * as T from "three";

/** Conservative caster eligibility for the actual finite shadow map, not an
 * arbitrary cell-centre radius. Bounds survive static source-buffer release. */
export class ShadowCasterVolume {
  private frustum = new T.Frustum();
  private view = new T.Matrix4();
  private projectionView = new T.Matrix4();
  private eye = new T.Vector3();
  private target = new T.Vector3();
  private offset = new T.Vector3();
  private box = new T.Box3();
  private sphere = new T.Sphere();

  update(light: T.DirectionalLight, targetOverride?: T.Vector3) {
    light.getWorldPosition(this.eye);
    light.target.getWorldPosition(this.target);
    if (targetOverride) {
      this.offset.subVectors(this.eye, this.target);
      this.target.copy(targetOverride);
      this.eye.copy(this.target).add(this.offset);
    }
    const camera = light.shadow.camera;
    camera.updateProjectionMatrix();
    this.view
      .lookAt(this.eye, this.target, camera.up)
      .setPosition(this.eye)
      .invert();
    this.projectionView.multiplyMatrices(camera.projectionMatrix, this.view);
    this.frustum.setFromProjectionMatrix(this.projectionView);
    return this;
  }

  includes(mesh: T.Mesh) {
    if (mesh.userData.allowShadow === false) return false;
    // Frozen world meshes already have valid world matrices. Released static
    // sources are detached draw records: their batch uses the retained local
    // matrix under World.root (identity), not a live parent chain.
    const released =
      !mesh.geometry.getAttribute("position") && mesh.parent === null;
    if (!released && mesh.matrixWorldAutoUpdate && mesh.matrixAutoUpdate)
      mesh.updateWorldMatrix(false, false);
    const transform = released ? mesh.matrix : mesh.matrixWorld;
    if (mesh instanceof T.InstancedMesh) {
      if (!mesh.boundingSphere) mesh.computeBoundingSphere();
      if (!mesh.boundingSphere) return true;
      this.sphere.copy(mesh.boundingSphere).applyMatrix4(transform);
      return this.frustum.intersectsSphere(this.sphere);
    }
    const geometry = mesh.geometry;
    if (!geometry.boundingBox && geometry.getAttribute("position"))
      geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      this.box.copy(geometry.boundingBox).applyMatrix4(transform);
      return this.frustum.intersectsBox(this.box);
    }
    if (geometry.boundingSphere) {
      this.sphere.copy(geometry.boundingSphere).applyMatrix4(transform);
      return this.frustum.intersectsSphere(this.sphere);
    }
    // Missing bounds cannot safely prove exclusion. Real generated chunks have
    // retained bounds; preserve unusual legacy meshes rather than lose shadows.
    return true;
  }
}
