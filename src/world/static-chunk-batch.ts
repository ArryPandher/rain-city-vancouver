import * as T from "three";

/** Consolidate draws, not culling cells. Detached source meshes remain in
 * World.chunks, where the existing distance/shadow policy updates their flags.
 * The batch copies those flags per pass before Three's individual frustum test.
 */
export function batchStaticChunks(
  parent: T.Object3D,
  chunks: readonly T.Mesh[],
  multiDraw: boolean,
  options: {
    /** Caller guarantees sole ownership of generated source buffers and that
     * they have never rendered. Do not use for externally shared geometry. */
    releaseOwnedPreRenderGeometry?: boolean;
  } = {},
): T.BatchedMesh[] {
  if (!multiDraw) return [];
  const result: T.BatchedMesh[] = [];
  const groups = new Map<string, T.Mesh[]>();
  for (const mesh of chunks) {
    if (!eligible(mesh, parent)) continue;
    const material = mesh.material as T.Material;
    const layout = Object.entries(mesh.geometry.attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, a]) =>
          `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`,
      )
      .join("/");
    const key = `${material.uuid}/${!!mesh.userData.detail}/${mesh.receiveShadow}/${mesh.layers.mask}/${mesh.renderOrder}/${layout}`;
    let group = groups.get(key);
    if (!group) groups.set(key, (group = []));
    group.push(mesh);
  }
  for (const sources of groups.values()) {
    if (sources.length < 2) continue;
    const material = sources[0].material as T.Material;
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
    batch.name = `Static cells: ${material.name || (material as T.MeshStandardMaterial).map?.name || result.length}`;
    batch.castShadow = true;
    batch.receiveShadow = sources[0].receiveShadow;
    batch.layers.mask = sources[0].layers.mask;
    batch.renderOrder = sources[0].renderOrder;
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
    recordMemory(batch, sources);
    if (options.releaseOwnedPreRenderGeometry)
      releaseOwnedGeometry(batch, sources);
    result.push(batch);
  }
  return result;
}

function eligible(mesh: T.Mesh, parent: T.Object3D) {
  const material = mesh.material;
  const geometry = mesh.geometry;
  return (
    mesh.constructor === T.Mesh &&
    mesh.parent === parent &&
    mesh.frustumCulled &&
    !Array.isArray(material) &&
    material instanceof T.MeshStandardMaterial &&
    !material.transparent &&
    material.onBeforeCompile === T.Material.prototype.onBeforeCompile &&
    material.customProgramCacheKey ===
      T.Material.prototype.customProgramCacheKey &&
    !mesh.customDepthMaterial &&
    !mesh.customDistanceMaterial &&
    mesh.onBeforeRender === T.Object3D.prototype.onBeforeRender &&
    mesh.onAfterRender === T.Object3D.prototype.onAfterRender &&
    mesh.onBeforeShadow === T.Object3D.prototype.onBeforeShadow &&
    mesh.onAfterShadow === T.Object3D.prototype.onAfterShadow &&
    geometry.index !== null &&
    geometry.drawRange.start === 0 &&
    geometry.drawRange.count === Infinity &&
    Object.keys(geometry.morphAttributes).length === 0 &&
    Object.values(geometry.attributes).every(
      (a) =>
        !("isInstancedBufferAttribute" in a) &&
        ("usage" in a
          ? a.usage === T.StaticDrawUsage
          : a.data.usage === T.StaticDrawUsage),
    )
  );
}

type BufferSet = Set<ArrayBufferLike>;
const memoryRecords = new WeakMap<
  T.Object3D,
  {
    sources: T.Mesh[];
    releasedBytes: number;
    source: BufferSet;
    packed: BufferSet;
    textures: BufferSet;
  }
>();
function geometryBuffers(geometries: T.BufferGeometry[]): BufferSet {
  const buffers: BufferSet = new Set();
  for (const geometry of geometries) {
    if (geometry.index) buffers.add(geometry.index.array.buffer);
    for (const attribute of Object.values(geometry.attributes))
      buffers.add(attribute.array.buffer);
  }
  return buffers;
}
const bufferBytes = (buffers: BufferSet) =>
  [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
function recordMemory(batch: T.BatchedMesh, sources: T.Mesh[]) {
  const internal = batch as unknown as {
    _matricesTexture: T.DataTexture;
    _indirectTexture: T.DataTexture;
  };
  const record = {
    sources,
    releasedBytes: 0,
    source: geometryBuffers(sources.map((source) => source.geometry)),
    packed: geometryBuffers([batch.geometry]),
    textures: new Set<ArrayBufferLike>(),
  };
  for (const texture of [internal._matricesTexture, internal._indirectTexture])
    if (texture.image.data) record.textures.add(texture.image.data.buffer);
  memoryRecords.set(batch, record);
  batch.userData.staticBatchMemory = {
    sourceCount: sources.length,
    retainedSourceGeometryBytes: bufferBytes(record.source),
    packedGeometryBytes: bufferBytes(record.packed),
    matrixAndIndirectionTextureBytes: bufferBytes(record.textures),
  };
}

/** Called only by requested diagnostics. Include off-camera/invisible batches;
 * deduplicate backing buffers across all registered batches, not only attributes.
 */
export function staticBatchMemoryProfile(scene: T.Object3D) {
  const sources = new Set<T.Mesh>(),
    source: BufferSet = new Set(),
    packed: BufferSet = new Set(),
    textures: BufferSet = new Set();
  let batchCount = 0,
    releasedOwnedSourceGeometryBytes = 0;
  scene.traverse((object) => {
    const record = memoryRecords.get(object);
    if (!record) return;
    batchCount++;
    releasedOwnedSourceGeometryBytes += record.releasedBytes;
    record.sources.forEach((mesh) => sources.add(mesh));
    record.source.forEach((buffer) => source.add(buffer));
    record.packed.forEach((buffer) => packed.add(buffer));
    record.textures.forEach((buffer) => textures.add(buffer));
  });
  return {
    scope:
      "All registered static architecture/street-detail/ground batches in the loaded scene, including invisible and off-camera cells; excludes photographic-facade and wheel batches and unbatched geometry.",
    note: "CPU backing-buffer byte lengths, uniquely counted across this scope. Released-owned bytes are historical, not retained in the total. Excludes GPU driver allocation, JS object overhead and material/image textures; not a process-RAM or GPU-memory measurement.",
    batchCount,
    sourceCount: sources.size,
    releasedOwnedSourceGeometryBytes,
    retainedSourceGeometryBytes: bufferBytes(source),
    packedGeometryBytes: bufferBytes(packed),
    matrixAndIndirectionTextureBytes: bufferBytes(textures),
    totalUniqueBackingBufferBytes: bufferBytes(
      new Set([...source, ...packed, ...textures]),
    ),
  };
}

function releaseOwnedGeometry(batch: T.BatchedMesh, sources: T.Mesh[]) {
  const record = memoryRecords.get(batch)!;
  record.releasedBytes = bufferBytes(record.source);
  for (const source of sources) {
    const original = source.geometry;
    if (!original.boundingBox) original.computeBoundingBox();
    if (!original.boundingSphere) original.computeBoundingSphere();
    const bounds = new T.BufferGeometry();
    bounds.boundingBox = original.boundingBox!.clone();
    bounds.boundingSphere = original.boundingSphere!.clone();
    source.geometry = bounds;
  }
  // Dropping mesh references alone is insufficient: diagnostics must not retain
  // the backing buffers. No dispose call is needed for never-uploaded geometry.
  record.source.clear();
  batch.userData.staticBatchMemory.retainedSourceGeometryBytes = 0;
  batch.userData.staticBatchMemory.releasedOwnedSourceGeometryBytes =
    record.releasedBytes;
}
