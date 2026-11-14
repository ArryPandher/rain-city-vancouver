import * as T from "three";
import type { VehicleModel } from "../world/vehicles";
import { SpatialInstances } from "../world/spatial-instances";

type Part = {
  mesh: T.Mesh;
  material: T.MeshStandardMaterial;
  visible: boolean;
};
type Entry = { part: Part };
type Batch = {
  source: T.InstancedMesh;
  cells: SpatialInstances;
  entries: Entry[];
};

/** Repeated cars keep their original parts and animation hierarchy as gameplay
 * surfaces. Only their draw submissions are shared. The occupied car retains
 * independent materials, including its changing brake lights. */
export class VehicleInstances {
  readonly root = new T.Group();
  readonly batches = new Map<string, Batch>();
  private models = new Map<VehicleModel, Part[]>();
  enabled = true;
  stats = { vehicles: 0, parts: 0, draws: 0 };
  constructor(scene: T.Scene) {
    this.root.name = "Instanced traffic parts";
    scene.add(this.root);
  }
  register(model: VehicleModel) {
    if (model.kind !== "car" || this.models.has(model)) return;
    const parts: Part[] = [];
    model.group.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        o.material instanceof T.MeshStandardMaterial &&
        o.material.userData.vehicleBatchKey &&
        !o.material.transparent
      )
        parts.push({ mesh: o, material: o.material, visible: o.visible });
    });
    this.models.set(model, parts);
  }
  update(current?: VehicleModel) {
    this.stats = { vehicles: 0, parts: 0, draws: 0 };
    for (const batch of this.batches.values()) batch.entries.length = 0;
    for (const [model, parts] of this.models) {
      for (const part of parts) {
        part.mesh.visible = part.visible;
        part.mesh.userData.vehicleInstanceSource = false;
      }
      if (!this.enabled || model === current || !model.group.visible) continue;
      model.group.updateWorldMatrix(true, true);
      let included = false;
      for (const part of parts) {
        if (!part.visible) continue;
        // Keep intentionally hidden animation branches out of the batch.
        let parent = part.mesh.parent,
          visible = true;
        while (parent && parent !== model.group) {
          visible &&= parent.visible;
          parent = parent.parent;
        }
        if (!visible) continue;
        const m = part.material;
        // These materials are controlled clones of the same loaded template.
        // Diffuse tint varies per instance; emission changes require a new batch.
        const key = [
          part.mesh.geometry.uuid,
          m.userData.vehicleBatchKey,
          m.emissive.getHexString(),
          m.emissiveIntensity,
          part.mesh.castShadow,
          part.mesh.receiveShadow,
        ].join("/");
        let batch = this.batches.get(key);
        if (!batch) {
          const material = m.clone();
          material.color.set(0xffffff);
          const source = new T.InstancedMesh(part.mesh.geometry, material, 32);
          source.name = `Traffic ${m.name}`;
          source.castShadow = part.mesh.castShadow;
          source.receiveShadow = part.mesh.receiveShadow;
          source.count = 0;
          batch = {
            source,
            cells: new SpatialInstances(source, this.root, 220),
            entries: [],
          };
          this.batches.set(key, batch);
        }
        batch.entries.push({ part });
        part.mesh.visible = false;
        part.mesh.userData.vehicleInstanceSource = true;
        included = true;
        this.stats.parts++;
      }
      if (included) this.stats.vehicles++;
    }
    for (const batch of this.batches.values()) {
      if (batch.entries.length > batch.source.instanceMatrix.count) {
        const old = batch.source;
        batch.source = new T.InstancedMesh(
          old.geometry,
          old.material,
          2 ** Math.ceil(Math.log2(batch.entries.length)),
        );
        batch.source.name = old.name;
        batch.source.castShadow = old.castShadow;
        batch.source.receiveShadow = old.receiveShadow;
        batch.cells.source = batch.source;
        old.dispose();
      }
      batch.source.count = batch.entries.length;
      batch.entries.forEach(({ part }, i) => {
        batch.source.setMatrixAt(i, part.mesh.matrixWorld);
        batch.source.setColorAt(i, part.material.color);
      });
      batch.cells.update();
      this.stats.draws += batch.cells.tiles.filter((t) => t.visible).length;
    }
  }
}

/** Batched render sources retain their original raycast geometry and parentage. */
export function visibleHitSurface(object: T.Object3D) {
  return object.visible || object.userData.vehicleInstanceSource === true;
}
