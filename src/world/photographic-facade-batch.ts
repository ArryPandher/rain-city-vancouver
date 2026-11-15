import * as T from "three";

/** Consolidate draws, not culling cells. Detached source meshes remain in
 * World.chunks, where the existing distance/shadow policy updates their flags.
 * The batch copies those flags per pass before Three's individual frustum test.
 */
export function batchPhotographicFacades(
  parent: T.Object3D,
  chunks: readonly T.Mesh[],
  materials: readonly T.Material[],
  multiDraw: boolean,
): T.BatchedMesh[] {
  if (!multiDraw) return [];
  const result: T.BatchedMesh[] = [];
  for (const material of materials) {
    const sources = chunks.filter(
      (mesh) =>
        mesh.parent === parent &&
        mesh.material === material &&
        !mesh.userData.detail,
    );
    if (sources.length < 2 || material.transparent) continue;
    const vertices = sources.reduce(
      (n, mesh) => n + mesh.geometry.attributes.position.count,
      0,
    );
    const indices = sources.reduce(
      (n, mesh) => n + (mesh.geometry.index?.count ?? 0),
      0,
    );
    const batch = new T.BatchedMesh(
      sources.length,
      vertices,
      indices,
      material,
    );
    batch.name = `Photographic facade cells: ${material.name || (material as T.MeshStandardMaterial).map?.name || result.length}`;
    batch.castShadow = batch.receiveShadow = true;
    batch.perObjectFrustumCulled = true;
    const instances = sources.map((source) => {
      source.updateMatrix();
      const geometry = batch.addGeometry(source.geometry);
      const instance = batch.addInstance(geometry);
      batch.setMatrixAt(instance, source.matrix);
      return instance;
    });
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    const beforeRender = batch.onBeforeRender;
    const beforeShadow = batch.onBeforeShadow;
    let shadowPass = false;
    batch.onBeforeRender = function (...args) {
      for (let i = 0; i < sources.length; i++)
        batch.setVisibleAt(
          instances[i],
          sources[i].visible && (!shadowPass || sources[i].castShadow),
        );
      beforeRender.apply(this, args);
    };
    batch.onBeforeShadow = function (...args) {
      shadowPass = true;
      try {
        // Three's original shadow hook invokes onBeforeRender with shadowCamera.
        beforeShadow.apply(this, args);
      } finally {
        shadowPass = false;
      }
    };
    parent.add(batch);
    sources.forEach((source) => source.removeFromParent());
    result.push(batch);
  }
  return result;
}
