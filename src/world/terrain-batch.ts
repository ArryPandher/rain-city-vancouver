import * as T from "three";

/** Dedicated adapter for terrainMeshes' identity-transform, world-coordinate
 * tiles and reviewed forest/cliff/coastal shader stack. Call once before any
 * source renders; caller owns its buffers. Unsupported/failed setup is atomic. */
export function batchTerrainTiles(
  parent: T.Object3D,
  tiles: readonly T.Mesh[],
  multiDraw: boolean,
): T.BatchedMesh[] {
  if (!multiDraw) return [];
  const identity = new T.Matrix4();
  const groups = new Map<T.Material, T.Mesh[]>();
  for (const tile of tiles) {
    tile.updateMatrix();
    const material = tile.material,
      g = tile.geometry;
    if (
      tile.name !== "Stanley terrain" ||
      tile.constructor !== T.Mesh ||
      tile.parent !== parent ||
      !tile.matrix.equals(identity) ||
      !tile.frustumCulled ||
      Array.isArray(material) ||
      !(material instanceof T.MeshStandardMaterial) ||
      material.transparent ||
      !material
        .customProgramCacheKey()
        .endsWith("-stanley-cliff-v1-coastal-cover-v1") ||
      tile.customDepthMaterial ||
      tile.customDistanceMaterial ||
      g.groups.length ||
      !g.index ||
      g.drawRange.start !== 0 ||
      g.drawRange.count !== Infinity ||
      tile.onBeforeRender !== T.Object3D.prototype.onBeforeRender ||
      tile.onBeforeShadow !== T.Object3D.prototype.onBeforeShadow ||
      tile.onAfterRender !== T.Object3D.prototype.onAfterRender ||
      tile.onAfterShadow !== T.Object3D.prototype.onAfterShadow ||
      Object.keys(g.attributes).sort().join() !== "normal,position,uv" ||
      Object.values(g.attributes).some(
        (a) =>
          !(a instanceof T.BufferAttribute) ||
          a.normalized ||
          !(a.array instanceof Float32Array) ||
          a.usage !== T.StaticDrawUsage,
      )
    )
      continue;
    let group = groups.get(material);
    if (!group) groups.set(material, (group = []));
    group.push(tile);
  }
  const staged: {
    batch: T.BatchedMesh;
    sources: T.Mesh[];
    bounds: T.BufferGeometry[];
  }[] = [];
  try {
    for (const sources of groups.values()) {
      if (sources.length < 2) continue;
      // Retain policy distinctions even if a caller supplies nonstandard tiles.
      if (
        sources.some(
          (s) =>
            s.receiveShadow !== sources[0].receiveShadow ||
            s.layers.mask !== sources[0].layers.mask ||
            s.renderOrder !== sources[0].renderOrder,
        )
      )
        continue;
      const batch = new T.BatchedMesh(
        sources.length,
        sources.reduce((n, s) => n + s.geometry.attributes.position.count, 0),
        sources.reduce((n, s) => n + s.geometry.index!.count, 0),
        sources[0].material as T.Material,
      );
      const stage = { batch, sources, bounds: [] as T.BufferGeometry[] };
      staged.push(stage);
      batch.name = `Terrain cells: ${(sources[0].material as T.Material).name || "coastal ground"}`;
      batch.castShadow = true;
      batch.receiveShadow = sources[0].receiveShadow;
      batch.layers.mask = sources[0].layers.mask;
      batch.renderOrder = sources[0].renderOrder;
      batch.perObjectFrustumCulled = true;
      const ids = sources.map((source) => {
        const id = batch.addInstance(batch.addGeometry(source.geometry));
        batch.setMatrixAt(id, identity);
        source.geometry.computeBoundingBox();
        source.geometry.computeBoundingSphere();
        const bounds = new T.BufferGeometry();
        bounds.boundingBox = source.geometry.boundingBox!.clone();
        bounds.boundingSphere = source.geometry.boundingSphere!.clone();
        stage.bounds.push(bounds);
        return id;
      });
      const render = batch.onBeforeRender,
        shadow = batch.onBeforeShadow;
      let shadowPass = false;
      batch.onBeforeRender = function (...args) {
        sources.forEach((s, i) =>
          batch.setVisibleAt(
            ids[i],
            s.visible && (!shadowPass || s.castShadow),
          ),
        );
        render.apply(this, args);
      };
      batch.onBeforeShadow = function (...args) {
        shadowPass = true;
        try {
          shadow.apply(this, args);
        } finally {
          shadowPass = false;
        }
      };
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      const bytes = (geometries: T.BufferGeometry[]) => {
        const buffers = new Set<ArrayBufferLike>();
        for (const g of geometries) {
          if (g.index) buffers.add(g.index.array.buffer);
          for (const a of Object.values(g.attributes))
            buffers.add(a.array.buffer);
        }
        return [...buffers].reduce((n, b) => n + b.byteLength, 0);
      };
      const internal = batch as unknown as {
        _matricesTexture: T.DataTexture;
        _indirectTexture: T.DataTexture;
      };
      batch.userData.terrainBatchMemory = {
        sourceCount: sources.length,
        releasedOwnedSourceGeometryBytes: bytes(sources.map((s) => s.geometry)),
        retainedSourceGeometryBytes: 0,
        packedGeometryBytes: bytes([batch.geometry]),
        matrixAndIndirectionTextureBytes:
          internal._matricesTexture.image.data!.byteLength +
          internal._indirectTexture.image.data!.byteLength,
      };
    }
  } catch (error) {
    for (const { batch } of staged) batch.dispose();
    throw error;
  }
  // No source detaches/releases until every batch and bounds record is prepared.
  for (const { batch, sources, bounds } of staged) {
    parent.add(batch);
    sources.forEach((s, i) => {
      s.removeFromParent();
      s.geometry = bounds[i];
    });
  }
  return staged.map((s) => s.batch);
}
