import * as T from "three";

/** Keep identical instances in compact spatial batches, allowing Three to cull
 * them independently for the view camera and each light's shadow camera.
 * Slots are reused after movement; the whole city's cells are never retained.
 */
export class SpatialInstances {
  tiles: T.InstancedMesh[] = [];
  constructor(
    public source: T.InstancedMesh,
    private parent: T.Object3D,
    public cellSize = 24,
    private instanceAttributes: string[] = [],
  ) {}
  update() {
    const source = this.source,
      groups = new Map<string, number[]>(),
      matrices = source.instanceMatrix.array;
    for (let i = 0; i < source.count; i++) {
      const key = `${Math.floor(matrices[i * 16 + 12] / this.cellSize)},${Math.floor(matrices[i * 16 + 14] / this.cellSize)}`;
      let group = groups.get(key);
      if (!group) {
        group = [];
        groups.set(key, group);
      }
      group.push(i);
    }
    let slot = 0;
    for (const indices of groups.values()) {
      let tile = this.tiles[slot];
      if (!tile || tile.instanceMatrix.count < indices.length) {
        let geometry = tile?.geometry ?? source.geometry;
        if (!tile && this.instanceAttributes.length) {
          geometry = new T.BufferGeometry();
          geometry.setIndex(source.geometry.index);
          for (const [name, attribute] of Object.entries(
            source.geometry.attributes,
          ))
            geometry.setAttribute(
              name,
              this.instanceAttributes.includes(name)
                ? attribute.clone()
                : attribute,
            );
          geometry.boundingBox = source.geometry.boundingBox?.clone() ?? null;
          geometry.boundingSphere =
            source.geometry.boundingSphere?.clone() ?? null;
        }
        if (tile) {
          this.parent.remove(tile);
          // InstancedMesh.dispose releases only its matrix/color buffers. The
          // shared vertex geometry and materials must survive this resize.
          tile.dispose();
        }
        tile = new T.InstancedMesh(
          geometry,
          source.material,
          Math.min(
            source.instanceMatrix.count,
            Math.max(8, 2 ** Math.ceil(Math.log2(indices.length))),
          ),
        );
        tile.name = `${source.name} cell ${slot}`;
        tile.instanceMatrix.setUsage(T.DynamicDrawUsage);
        tile.customDepthMaterial = source.customDepthMaterial;
        tile.customDistanceMaterial = source.customDistanceMaterial;
        tile.frustumCulled = true;
        tile.castShadow = source.castShadow;
        tile.receiveShadow = source.receiveShadow;
        this.parent.add(tile);
        this.tiles[slot] = tile;
      }
      tile.visible = true;
      tile.count = indices.length;
      if (source.instanceColor && !tile.instanceColor)
        tile.instanceColor = new T.InstancedBufferAttribute(
          new Float32Array(tile.instanceMatrix.count * 3),
          3,
        ).setUsage(T.DynamicDrawUsage);
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        (tile.instanceMatrix.array as Float32Array).set(
          (matrices as Float32Array).subarray(i * 16, i * 16 + 16),
          j * 16,
        );
        if (source.instanceColor)
          (tile.instanceColor!.array as Float32Array).set(
            (source.instanceColor.array as Float32Array).subarray(
              i * 3,
              i * 3 + 3,
            ),
            j * 3,
          );
        for (const name of this.instanceAttributes) {
          const from = source.geometry.getAttribute(name),
            to = tile.geometry.getAttribute(name),
            size = from.itemSize;
          (to.array as Float32Array).set(
            (from.array as Float32Array).subarray(i * size, (i + 1) * size),
            j * size,
          );
        }
      }
      tile.instanceMatrix.needsUpdate = true;
      if (tile.instanceColor) tile.instanceColor.needsUpdate = true;
      for (const name of this.instanceAttributes)
        tile.geometry.getAttribute(name).needsUpdate = true;
      tile.computeBoundingSphere();
      slot++;
    }
    for (; slot < this.tiles.length; slot++) {
      this.tiles[slot].count = 0;
      this.tiles[slot].visible = false;
    }
    // Preserve the complete staging arrays for the next update and diagnostics.
    source.visible = false;
  }
}
