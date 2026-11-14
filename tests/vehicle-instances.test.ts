import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  VehicleInstances,
  visibleHitSurface,
} from "../src/rendering/vehicle-instances";
import type { VehicleModel } from "../src/world/vehicles";

function car(
  geometry: T.BufferGeometry,
  color: number,
  x: number,
): VehicleModel {
  const group = new T.Group(),
    body = new T.Group(),
    wheel = new T.Group();
  const material = new T.MeshStandardMaterial({
    color,
    metalness: 0.7,
    roughness: 0.2,
  });
  material.userData.vehicleBatchKey = "shared-car-paint";
  const surface = new T.Mesh(geometry, material);
  surface.castShadow = surface.receiveShadow = true;
  group.add(body);
  body.add(wheel);
  wheel.add(surface);
  group.position.set(x, 2, -20);
  group.rotation.y = 0.6;
  wheel.position.set(0.9, 0.4, 1.4);
  wheel.rotation.x = 1.3;
  return {
    group,
    body,
    wheels: [wheel],
    front: [wheel],
    color,
    kind: "car",
    brakes: material,
    headlights: material,
  };
}
const surfaces = (model: VehicleModel) => {
  const list: T.Mesh[] = [];
  model.group.traverse((o) => {
    if (o instanceof T.Mesh) list.push(o);
  });
  return list;
};

test("traffic shares draw geometry while preserving paint and animated part transforms", () => {
  const scene = new T.Scene(),
    instances = new VehicleInstances(scene);
  const geometry = new T.BoxGeometry(1, 2, 4);
  const a = car(geometry, 0xff2211, 10),
    b = car(geometry, 0x2288ff, 12);
  for (const model of [a, b]) {
    scene.add(model.group);
    instances.register(model);
  }
  instances.update();
  assert.equal(instances.batches.size, 1);
  assert.deepEqual(instances.stats, { vehicles: 2, parts: 2, draws: 1 });
  const batch = [...instances.batches.values()][0],
    tile = batch.cells.tiles[0];
  assert.equal(tile.geometry, geometry);
  assert.equal((tile.material as T.MeshStandardMaterial).metalness, 0.7);
  assert.equal((tile.material as T.MeshStandardMaterial).roughness, 0.2);
  assert.equal(tile.castShadow, true);
  for (const [i, model] of [a, b].entries()) {
    const source = surfaces(model)[0],
      m = new T.Matrix4(),
      color = new T.Color();
    tile.getMatrixAt(i, m);
    tile.getColorAt(i, color);
    source.matrixWorld.elements.forEach((v, j) =>
      assert.ok(Math.abs(v - m.elements[j]) < 1e-5),
    );
    for (const c of ["r", "g", "b"] as const)
      assert.ok(
        Math.abs(
          color[c] - (source.material as T.MeshStandardMaterial).color[c],
        ) < 1e-6,
      );
    assert.equal(source.visible, false);
    assert.equal(visibleHitSurface(source), true);
  }
  const before = new T.Matrix4();
  tile.getMatrixAt(1, before);
  b.group.position.x += 25;
  b.wheels[0].rotation.x += 0.5;
  instances.update();
  const after = new T.Matrix4();
  tile.getMatrixAt(1, after);
  assert.notDeepEqual(before.elements, after.elements);
  assert.ok(
    tile.boundingSphere!.containsPoint(
      new T.Vector3().setFromMatrixPosition(after),
    ),
  );
});

test("occupied or hidden cars restore independent surfaces and ray hits survive batching", () => {
  const scene = new T.Scene(),
    instances = new VehicleInstances(scene);
  const model = car(new T.BoxGeometry(2, 2, 4), 0x445566, 0);
  scene.add(model.group);
  instances.register(model);
  instances.update();
  const source = surfaces(model)[0],
    centre = source.getWorldPosition(new T.Vector3());
  const ray = new T.Raycaster(
    centre.clone().add(new T.Vector3(0, 10, 0)),
    new T.Vector3(0, -1, 0),
  );
  assert.ok(
    ray
      .intersectObject(model.group, true)
      .filter((h) => visibleHitSurface(h.object)).length > 0,
  );
  instances.update(model);
  assert.equal(source.visible, true);
  assert.equal(source.userData.vehicleInstanceSource, false);
  assert.equal(instances.stats.parts, 0);
  model.group.visible = false;
  instances.update();
  assert.equal(instances.stats.parts, 0);
  model.group.visible = true;
  instances.update();
  assert.equal(instances.stats.parts, 1);
  instances.enabled = false;
  instances.update();
  assert.equal(source.visible, true);
  assert.equal(instances.stats.draws, 0);
});

test("growing traffic batches preserve spatial culling and changing light state", () => {
  const scene = new T.Scene(),
    instances = new VehicleInstances(scene),
    geometry = new T.BoxGeometry();
  const models = Array.from({ length: 40 }, (_, i) =>
    car(geometry, 0x445566, i < 20 ? 10 : 500),
  );
  for (const model of models) {
    scene.add(model.group);
    instances.register(model);
  }
  instances.update();
  assert.equal(instances.stats.parts, 40);
  assert.equal(instances.stats.draws, 2);
  const batch = [...instances.batches.values()][0];
  assert.equal(batch.source.instanceMatrix.count, 64);
  assert.equal(
    batch.cells.tiles.reduce((n, t) => n + t.count, 0),
    40,
  );
  models[0].brakes.emissiveIntensity = 3;
  instances.update();
  assert.equal(instances.batches.size, 2);
  assert.equal(instances.stats.parts, 40);
  assert.deepEqual(
    [...instances.batches.values()]
      .map((b) => b.source.count)
      .sort((a, b) => a - b),
    [1, 39],
  );
});
