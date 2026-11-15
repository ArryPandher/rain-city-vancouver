import * as T from "three";
import type { TreeInstance } from "./detailed-trees";

export interface FallbackTreeBatchController {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
}
export function getFallbackTreeBatchController(
  parent: T.Object3D,
): FallbackTreeBatchController | undefined {
  return parent.userData.fallbackTreeBatchController;
}

const envelopes = new WeakMap<
  T.BufferAttribute | T.InterleavedBufferAttribute,
  { full: T.Box3; lower: T.Box3 }
>();
/** O(1) conservative stem envelope after one scan per shared position attribute.
 * The shader interpolates each lower vertex between its original position and
 * x/z scaled by stem. The union contains both endpoints and their full segment.
 * Above y=.5 the geometry is unchanged. No per-tree vertex scans on cell entry.
 */
export function fallbackTreeBounds(
  geometry: T.BufferGeometry,
  stem: number,
  target = new T.Box3(),
) {
  const position = geometry.getAttribute("position");
  let envelope = envelopes.get(position);
  if (!envelope) {
    envelope = { full: new T.Box3(), lower: new T.Box3() };
    const p = new T.Vector3();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i);
      envelope.full.expandByPoint(p);
      if (p.y < 0.5) envelope.lower.expandByPoint(p);
    }
    envelopes.set(position, envelope);
  }
  target.copy(envelope.full);
  const lower = envelope.lower;
  if (!lower.isEmpty()) {
    target.min.x = Math.min(target.min.x, lower.min.x * stem);
    target.min.z = Math.min(target.min.z, lower.min.z * stem);
    target.max.x = Math.max(target.max.x, lower.max.x * stem);
    target.max.z = Math.max(target.max.z, lower.max.z * stem);
  }
  return target.expandByScalar(0.08);
}
function stemMaterial(source: T.Material, texture: T.DataTexture) {
  const material = source.clone(),
    compile = source.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(source, shader, renderer);
    shader.uniforms.fallbackTreeStem = { value: texture };
    // The volume callback also uses the instance transform for view-slice
    // weighting and inverse-scale normal reconstruction. In BatchedMesh the
    // identical selected transform is batchingMatrix, declared by batching_vertex.
    shader.vertexShader = shader.vertexShader
      .replace(/\binstanceMatrix\b/g, "batchingMatrix")
      .replace(
        "attribute float treeStemScale;",
        "uniform highp sampler2D fallbackTreeStem;\nfloat treeStemScale;",
      )
      .replace(
        "#include <batching_vertex>",
        `#include <batching_vertex>
int treeId = int(getIndirectIndex(gl_DrawID));
int treeTextureWidth = textureSize(fallbackTreeStem, 0).x;
treeStemScale = texelFetch(fallbackTreeStem, ivec2(treeId % treeTextureWidth, treeId / treeTextureWidth), 0).r;`,
      );
  };
  material.customProgramCacheKey = () =>
    source.customProgramCacheKey() + "/fallback-tree-batch-v2";
  return material;
}
type Part = {
  source: T.InstancedMesh;
  material: T.Material;
  slot: number;
  high: T.BufferGeometry;
  low: T.BufferGeometry;
};
/** Preserve vertex arrays verbatim; only select the existing material's indices. */
function payload(source: T.BufferGeometry, slot: number) {
  const g = new T.BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes))
    if (name !== "treeStemScale") g.setAttribute(name, attr);
  const groups = source.groups.filter((group) => group.materialIndex === slot);
  if (source.groups.length) {
    const indices: number[] = [];
    for (const group of groups)
      for (let i = group.start; i < group.start + group.count; i++)
        indices.push(source.index!.getX(i));
    g.setIndex(indices);
  } else g.setIndex(source.index);
  return g;
}
function buffers(geometry: T.BufferGeometry, into: Set<ArrayBufferLike>) {
  for (const attr of [geometry.index, ...Object.values(geometry.attributes)]) {
    if (!attr) continue;
    into.add(
      "data" in attr
        ? (attr as T.InterleavedBufferAttribute).data.array.buffer
        : attr.array.buffer,
    );
  }
}

/** Capability-gated adapter for installed broadleaf fallback meshes only.
 * Canonical meshes remain World.chunks/detail-manager records, detached from drawing.
 * Geometry is packed once per distinct source payload, never once per tree.
 * Matrix/color/stem textures update at draw time; no late InstancedMesh uploads.
 */
export function batchFallbackTrees(
  parent: T.Object3D,
  samples: readonly TreeInstance[],
  multiDraw: boolean,
) {
  if (!multiDraw) return [];
  const sources = [...new Set(samples.flatMap((t) => [t.crown, t.trunk]))];
  const identity = new T.Matrix4();
  for (const source of sources)
    if (source.matrixAutoUpdate) source.updateMatrix();
  // Fail closed before detaching anything. This adapter is deliberately not generic.
  if (
    sources.some(
      (s) =>
        s.parent !== parent ||
        !s.matrix.equals(identity) ||
        !s.userData.branchNearGeometry ||
        !s.userData.branchFarGeometry ||
        !s.geometry.getAttribute("treeStemScale") ||
        !s.customDepthMaterial,
    )
  )
    return [];
  const groups = new Map<string, Part[]>();
  for (const source of sources) {
    for (const [slot, material] of [source.material].flat().entries()) {
      const key = `${material.uuid}/${!!source.instanceColor}/${source.layers.mask}/${source.renderOrder}/${source.receiveShadow}`;
      const part = {
        source,
        material,
        slot,
        high: source.userData.branchNearGeometry as T.BufferGeometry,
        low: source.userData.branchFarGeometry as T.BufferGeometry,
      };
      const list = groups.get(key) ?? [];
      list.push(part);
      groups.set(key, list);
    }
  }
  const batches: T.BatchedMesh[] = [],
    packedBuffers = new Set<ArrayBufferLike>(),
    sourceBuffers = new Set<ArrayBufferLike>(),
    textureBuffers = new Set<ArrayBufferLike>(),
    cullingBuffers = new Set<ArrayBufferLike>();
  for (const source of sources) {
    buffers(source.userData.branchNearGeometry, sourceBuffers);
    buffers(source.userData.branchFarGeometry, sourceBuffers);
    sourceBuffers.add(source.instanceMatrix.array.buffer);
    if (source.instanceColor)
      sourceBuffers.add(source.instanceColor.array.buffer);
  }
  let enabled = true;
  const constructionResources: { dispose(): void }[] = [];
  try {
    for (const parts of groups.values()) {
      const count = parts.reduce((n, p) => n + p.source.count, 0);
      const width = Math.min(1024, Math.max(1, count)),
        height = Math.ceil(count / width);
      const stems = new Float32Array(width * height);
      const texture = new T.DataTexture(
        stems,
        width,
        height,
        T.RedFormat,
        T.FloatType,
      );
      texture.needsUpdate = true;
      const material = stemMaterial(parts[0].material, texture),
        depth = stemMaterial(parts[0].source.customDepthMaterial!, texture);
      constructionResources.push(texture, material, depth);
      const geometries: T.BufferGeometry[] = [],
        ids = new Map<T.BufferGeometry, number>();
      // Distinct cell wrappers share the actual position/index attributes. Dedup by
      // their identities and material slot, rather than retaining copied cell buffers.
      const unique: {
        index: T.BufferAttribute | null;
        position: T.BufferAttribute | T.InterleavedBufferAttribute;
        slot: number;
        id: number;
      }[] = [];
      for (const part of parts)
        for (const geometry of [part.high, part.low]) {
          const found = unique.find(
            (u) =>
              u.index === geometry.index &&
              u.position === geometry.attributes.position &&
              u.slot === part.slot,
          );
          if (found) ids.set(geometry, found.id);
          else {
            const id = geometries.length;
            geometries.push(payload(geometry, part.slot));
            ids.set(geometry, id);
            unique.push({
              index: geometry.index,
              position: geometry.attributes.position,
              slot: part.slot,
              id,
            });
          }
        }
      const batch = new T.BatchedMesh(
        count,
        geometries.reduce((n, g) => n + g.attributes.position.count, 0),
        geometries.reduce((n, g) => n + (g.index?.count ?? 0), 0),
        material,
      );
      batches.push(batch);
      batch.name = `Fallback trees: ${parts[0].material.name}`;
      batch.customDepthMaterial = depth;

      batch.castShadow = true;
      batch.receiveShadow = parts[0].source.receiveShadow;
      batch.layers.mask = parts[0].source.layers.mask;
      batch.renderOrder = parts[0].source.renderOrder;
      batch.frustumCulled = false; // per-instance bounds below are authoritative
      batch.perObjectFrustumCulled = false;
      batch.sortObjects = false;
      for (const geometry of geometries) batch.addGeometry(geometry);
      const matrix = new T.Matrix4(),
        color = new T.Color(),
        box = new T.Box3(),
        pv = new T.Matrix4(),
        frustum = new T.Frustum();
      const records = parts.map((part) => ({
        ...part,
        start: 0,
        matrixVersion: -1,
        colorVersion: -1,
        stemVersion: -1,
        allowed: true,
        geometry: null as T.BufferGeometry | null,
        boxes: new Float64Array(part.source.count * 6),
        scales: new Float32Array(part.source.count),
        active: new Uint8Array(part.source.count),
      }));
      let instance = 0;
      for (const record of records) {
        for (const array of [record.boxes, record.scales, record.active])
          cullingBuffers.add(array.buffer);
        const source = record.source,
          geometry = source.geometry;
        const stem = geometry.getAttribute(
          "treeStemScale",
        ) as T.InstancedBufferAttribute;
        record.start = instance;
        for (let i = 0; i < source.count; i++) {
          batch.addInstance(ids.get(geometry)!);
          source.getMatrixAt(i, matrix);
          batch.setMatrixAt(instance, matrix);
          const scale = stem.getX(i);
          fallbackTreeBounds(geometry, scale, box).applyMatrix4(matrix);
          box.min.toArray(record.boxes, i * 6);
          box.max.toArray(record.boxes, i * 6 + 3);
          record.scales[i] = scale;
          record.active[i] = Number(matrix.getMaxScaleOnAxis() >= 1e-8);
          stems[instance] = scale;
          if (source.instanceColor) {
            source.getColorAt(i, color);
            batch.setColorAt(instance, color);
          }
          batch.setVisibleAt(instance, false);
          instance++;
        }
        record.geometry = geometry;
        record.matrixVersion = source.instanceMatrix.version;
        record.stemVersion = stem.version;
        record.colorVersion = source.instanceColor?.version ?? -1;
        record.allowed = false;
      }
      texture.needsUpdate = true;
      const passRecord = { pass: "beauty", considered: 0, visible: 0 };
      batch.userData.fallbackTreePass = passRecord;
      const beforeRender = batch.onBeforeRender,
        beforeShadow = batch.onBeforeShadow;
      let shadowPass = false;
      batch.onBeforeRender = function (...args) {
        if (!enabled) return;
        const camera = args[2];
        pv.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ).multiply(batch.matrixWorld);
        frustum.setFromProjectionMatrix(pv);
        let considered = 0,
          visible = 0;
        for (const record of records) {
          const source = record.source,
            geometry = source.geometry,
            stem = geometry.getAttribute(
              "treeStemScale",
            ) as T.InstancedBufferAttribute;
          const allowedCell =
            source.visible &&
            (!shadowPass || source.castShadow) &&
            ((camera as T.ArrayCamera).isArrayCamera ||
              !source.boundingSphere ||
              frustum.intersectsSphere(source.boundingSphere));
          if (!allowedCell) {
            if (record.allowed)
              for (let i = 0; i < source.count; i++)
                batch.setVisibleAt(record.start + i, false);
            record.allowed = false;
            continue;
          }
          record.allowed = true;
          const matrixChanged =
            record.matrixVersion !== source.instanceMatrix.version;
          const stemChanged = record.stemVersion !== stem.version;
          const geometryChanged = record.geometry !== geometry;
          const colorChanged =
            !!source.instanceColor &&
            record.colorVersion !== source.instanceColor.version;
          for (let i = 0; i < source.count; i++) {
            const id = record.start + i;
            if (geometryChanged) {
              // r182 does not dirty cached draw ranges on a geometry-ID change.
              // A public visibility transition invalidates them even if this
              // tree remains visible in an otherwise unchanged camera frustum.
              batch.setVisibleAt(id, false);
              batch.setGeometryIdAt(id, ids.get(geometry)!);
            }
            if (stemChanged || geometryChanged) {
              const scale = stem.getX(i);
              if (scale !== record.scales[i] || geometryChanged) {
                record.scales[i] = scale;
                stems[id] = scale;
                texture.needsUpdate = true;
              }
            }
            if (matrixChanged || stemChanged || geometryChanged) {
              source.getMatrixAt(i, matrix);
              record.active[i] = Number(matrix.getMaxScaleOnAxis() >= 1e-8);
              batch.setMatrixAt(id, matrix);
              fallbackTreeBounds(geometry, record.scales[i], box).applyMatrix4(
                matrix,
              );
              box.min.toArray(record.boxes, i * 6);
              box.max.toArray(record.boxes, i * 6 + 3);
            }
            if (colorChanged) {
              source.getColorAt(i, color);
              batch.setColorAt(id, color);
            }
            const allowed =
              source.visible &&
              (!shadowPass || source.castShadow) &&
              record.active[i];
            if (allowed) considered++;
            // Array-camera rendering stays conservative until its component frusta
            // are available; ordinary, reflection and shadow cameras use exact bounds.
            box.min.fromArray(record.boxes, i * 6);
            box.max.fromArray(record.boxes, i * 6 + 3);
            const shown =
              !!allowed &&
              ((camera as T.ArrayCamera).isArrayCamera ||
                frustum.intersectsBox(box));
            batch.setVisibleAt(id, shown);
            if (shown) visible++;
          }
          record.geometry = geometry;
          record.matrixVersion = source.instanceMatrix.version;
          record.stemVersion = stem.version;
          record.colorVersion = source.instanceColor?.version ?? -1;
        }
        passRecord.pass = shadowPass ? "shadow" : "beauty";
        passRecord.considered = considered;
        passRecord.visible = visible;
        beforeRender.apply(this, args);
      };
      batch.onBeforeShadow = function (...args) {
        if (!enabled) return;
        shadowPass = true;
        try {
          beforeShadow.apply(this, args);
        } finally {
          shadowPass = false;
        }
      };
      // Canonical matrices, colors, stems and bounds were populated above for
      // every cell before installation. No first-entry geometry/buffer setup.
      buffers(batch.geometry, packedBuffers);
      for (const t of [
        texture,
        ...(Object.values(batch).filter(
          (v) => v instanceof T.DataTexture,
        ) as T.DataTexture[]),
      ])
        textureBuffers.add(t.image.data!.buffer);
      const dispose = batch.dispose.bind(batch);
      batch.dispose = () => {
        dispose();
        texture.dispose();
        material.dispose();
        depth.dispose();
        return batch;
      };
    }
  } catch (error) {
    for (const batch of batches) T.BatchedMesh.prototype.dispose.call(batch);
    for (const resource of constructionResources) resource.dispose();
    throw error;
  }
  // Atomic installation: no new draw enters the scene until all groups succeed.
  parent.add(...batches);
  sources.forEach((source) => source.removeFromParent());
  // Keep only one draw path attached. Canonical state keeps updating through
  // World.chunks and DetailedTrees while either representation is selected.
  const controller: FallbackTreeBatchController = {
    get enabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      if (enabled) {
        sources.forEach((source) => source.removeFromParent());
        parent.add(...batches);
      } else {
        batches.forEach((batch) => batch.removeFromParent());
        parent.add(...sources);
      }
    },
  };
  parent.userData.fallbackTreeBatchController = controller;
  const sum = (set: Set<ArrayBufferLike>) =>
    [...set].reduce((n, buffer) => n + buffer.byteLength, 0);
  const memory = {
    scope:
      "All fallback-tree batches; retained canonical source geometry/instance attributes, packed geometry, textures and packed culling state. Excludes JS object overhead and GPU driver allocation.",
    batches: batches.length,
    sources: sources.length,
    retainedSourceBytes: sum(sourceBuffers),
    packedGeometryBytes: sum(packedBuffers),
    textureBytes: sum(textureBuffers),
    cullingStateBytes: sum(cullingBuffers),
  };
  for (const batch of batches) batch.userData.fallbackTreeMemory = memory;
  return batches;
}
