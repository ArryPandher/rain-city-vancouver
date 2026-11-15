import * as T from "three";

/** World-space allowance for PCF taps plus shadow normal/depth offsets.
 * Two texel diagonals per radius cover the filtered tap footprint conservatively. */
export function directionalShadowMargin(sun: T.DirectionalLight): number {
  const shadow = sun.shadow,
    camera = shadow.camera;
  const values = [
    camera.left,
    camera.right,
    camera.top,
    camera.bottom,
    camera.near,
    camera.far,
    shadow.mapSize.x,
    shadow.mapSize.y,
    shadow.radius,
    shadow.normalBias,
    shadow.bias,
  ];
  if (
    !values.every(Number.isFinite) ||
    shadow.mapSize.x <= 0 ||
    shadow.mapSize.y <= 0 ||
    camera.right <= camera.left ||
    camera.top <= camera.bottom ||
    camera.far <= camera.near ||
    shadow.radius < 0
  )
    return Infinity;
  const texel = Math.hypot(
    (camera.right - camera.left) / shadow.mapSize.x,
    (camera.top - camera.bottom) / shadow.mapSize.y,
  );
  return (
    2 * Math.max(1, shadow.radius) * texel +
    Math.abs(shadow.normalBias) +
    Math.abs(shadow.bias) * (camera.far - camera.near)
  );
}

/** Necessary (conservative) half-space test for a sphere swept indefinitely
 * away from a directional light. It may keep excess casters but never rejects
 * a sphere point whose shadow ray reaches the receiver frustum. */
export function shadowSphereReachesView(
  sphere: T.Sphere,
  awayFromSun: T.Vector3,
  frustum: T.Frustum,
): boolean {
  if (
    !Number.isFinite(sphere.radius) ||
    sphere.radius < 0 ||
    ![
      sphere.center.x,
      sphere.center.y,
      sphere.center.z,
      awayFromSun.x,
      awayFromSun.y,
      awayFromSun.z,
    ].every(Number.isFinite) ||
    awayFromSun.lengthSq() < 1e-12
  )
    return true;
  let enter = 0,
    leave = Infinity;
  for (const plane of frustum.planes) {
    const clearance =
      plane.distanceToPoint(sphere.center) + sphere.radius + 0.001;
    const rate = plane.normal.dot(awayFromSun);
    if (Math.abs(rate) < 1e-12) {
      if (clearance < 0) return false;
    } else if (rate > 0) enter = Math.max(enter, -clearance / rate);
    else leave = Math.min(leave, -clearance / rate);
  }
  return enter <= leave;
}

/** Dedicated tree-slot policy. Call before shadow traversal, after world matrix
 * updates. Return value tells the caller to invalidate a cached shadow map.
 * Pass no view to restore complete casting before reflection/cube captures.
 * Never changes visibility, geometry, materials or level selection. */
export class TreeShadowReceivers {
  private readonly frustum = new T.Frustum();
  private readonly matrix = new T.Matrix4();
  private readonly sphere = new T.Sphere();
  private readonly direction = new T.Vector3();
  private readonly target = new T.Vector3();
  private renderedPolicy: Map<number, boolean> | undefined;
  private successfulState:
    | Readonly<{
        tested: number;
        retained: number;
        rejected: number;
        intentionalNoncasters: number;
      }>
    | undefined;
  get state() {
    return this.successfulState;
  }
  /** Scope the receiver policy to one synchronous render. Always restores the
   * caller's exact flags, including intentional non-casters and thrown draws. */
  render<R>(
    meshes: Iterable<T.InstancedMesh>,
    camera: T.Camera,
    sun: T.DirectionalLight,
    draw: (changed: boolean) => R,
  ): R {
    const records = Array.from(meshes, (mesh) => ({
      mesh,
      cast: mesh.castShadow,
    }));
    try {
      // Only existing casters are eligible; never enable an intentional non-caster.
      this.update(
        records.filter((r) => r.cast).map((r) => r.mesh),
        camera,
        sun,
      );
      const desired = new Map(
        records.map(({ mesh }) => [mesh.id, mesh.castShadow]),
      );
      const changed =
        !this.renderedPolicy ||
        this.renderedPolicy.size !== desired.size ||
        [...desired].some(
          ([id, cast]) => this.renderedPolicy!.get(id) !== cast,
        );
      const result = draw(changed);
      // Only successful synchronous draws become the comparison baseline.
      this.renderedPolicy = desired;
      const tested = records.filter((r) => r.cast).length;
      const retained = records.filter(
        (r) => r.cast && desired.get(r.mesh.id),
      ).length;
      this.successfulState = Object.freeze({
        tested,
        retained,
        rejected: tested - retained,
        intentionalNoncasters: records.length - tested,
      });
      return result;
    } catch (error) {
      this.renderedPolicy = undefined;
      throw error;
    } finally {
      for (const { mesh, cast } of records) mesh.castShadow = cast;
    }
  }

  update(
    meshes: Iterable<T.InstancedMesh>,
    camera?: T.Camera,
    sun?: T.DirectionalLight,
  ) {
    if (camera && sun) {
      this.frustum.setFromProjectionMatrix(
        this.matrix.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      sun.getWorldPosition(this.direction);
      sun.target.getWorldPosition(this.target);
      this.direction.subVectors(this.target, this.direction).normalize();
    }
    let changed = false;
    for (const mesh of meshes) {
      let cast = true;
      if (camera && sun) {
        if (!mesh.boundingSphere) mesh.computeBoundingSphere();
        this.sphere.copy(mesh.boundingSphere!).applyMatrix4(mesh.matrixWorld);
        this.sphere.radius += directionalShadowMargin(sun);
        cast = shadowSphereReachesView(
          this.sphere,
          this.direction,
          this.frustum,
        );
      }
      if (mesh.castShadow !== cast) {
        mesh.castShadow = cast;
        changed = true;
      }
    }
    return changed;
  }
}
