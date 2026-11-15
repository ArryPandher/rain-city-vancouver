import * as T from "three";

type WheelRecord = { parent: T.Object3D; local: T.Matrix4; instance: number };
type WheelBatch = { batch: T.BatchedMesh; records: WheelRecord[] };
const cars = new WeakMap<T.Object3D, WheelBatch[]>();
// Canonical source geometries are shared by car clones. Pack once per ordered
// geometry set; immutable packed vertex/index buffers are then shared too.
const packed = new Map<string, T.BufferGeometry>();

export function batchCarWheels(
  car: T.Group,
  multiDraw: boolean,
): T.BatchedMesh[] {
  if (!multiDraw) return [];
  const existing = cars.get(car);
  if (existing) return existing.map((entry) => entry.batch);
  const groups = new Map<T.Material, T.Mesh[]>();
  for (const name of [
    "WheelFrontL",
    "WheelFrontR",
    "WheelRearL",
    "WheelRearR",
  ]) {
    car.getObjectByName(name)?.traverse((object) => {
      const mesh = object as T.Mesh;
      if (
        !mesh.isMesh ||
        Array.isArray(mesh.material) ||
        mesh.material.transparent
      )
        return;
      let group = groups.get(mesh.material);
      if (!group) groups.set(mesh.material, (group = []));
      group.push(mesh);
    });
  }
  const entries: WheelBatch[] = [];
  for (const [material, sources] of groups) {
    // Do not combine different shadow/visibility policies or unsupported parts.
    if (
      sources.length !== 4 ||
      sources.some((s) => !s.visible || !s.castShadow || !s.receiveShadow)
    )
      continue;
    const batch = new T.BatchedMesh(
      4,
      sources.reduce(
        (sum, mesh) => sum + mesh.geometry.attributes.position.count,
        0,
      ),
      sources.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? 0), 0),
      material,
    );
    batch.name = `Car wheels: ${material.name}`;
    batch.castShadow = batch.receiveShadow = true;
    batch.perObjectFrustumCulled = true;
    const records = sources.map((source) => {
      source.updateMatrix();
      const geometry = batch.addGeometry(source.geometry);
      return {
        parent: source.parent!,
        local: source.matrix.clone(),
        instance: batch.addInstance(geometry),
      };
    });
    const key = sources.map((source) => source.geometry.uuid).join("/");
    const shared = packed.get(key);
    if (shared) {
      batch.geometry.dispose();
      batch.geometry = shared;
    } else packed.set(key, batch.geometry);
    car.add(batch);
    sources.forEach((source) => source.removeFromParent());
    entries.push({ batch, records });
  }
  cars.set(car, entries);
  syncCarWheelBatches(car);
  return entries.map((entry) => entry.batch);
}

const matrix = new T.Matrix4();
/** Called after physics updates steer/spin/root transforms. No vertex changes. */
export function syncCarWheelBatches(car: T.Object3D) {
  const entries = cars.get(car);
  if (!entries?.length) return;
  for (const { batch, records } of entries) {
    for (const record of records) {
      matrix.copy(record.local);
      // Accumulate only the retained wheel carrier chain in car-local space;
      // do not traverse/update the expensive car body a second time per frame.
      for (
        let parent: T.Object3D | null = record.parent;
        parent && parent !== car;
        parent = parent.parent
      ) {
        if (parent.matrixAutoUpdate) parent.updateMatrix();
        matrix.premultiply(parent.matrix);
      }
      batch.setMatrixAt(record.instance, matrix);
    }
    // Four rigid wheel parts per batch: cheap, current aggregate bounds prevent
    // clipping while steering; Three still culls each part per render pass.
    batch.computeBoundingSphere();
  }
}
