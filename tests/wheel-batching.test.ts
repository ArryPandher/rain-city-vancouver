import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  buildDetailedCarTemplate,
  cloneDetailedCar,
} from "../src/world/detailed-car";
import {
  batchCarWheels,
  syncCarWheelBatches,
} from "../src/world/wheel-batching";

async function source(file: string) {
  const bytes = await readFile(`public/models/${file}.glb`);
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: "test-no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  return buildDetailedCarTemplate(gltf.scene, () => new T.Texture());
}
function wheelMeshes(car: T.Group) {
  const result: T.Mesh[] = [];
  for (const name of ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"])
    car.getObjectByName(name)!.traverse((o) => {
      if ((o as T.Mesh).isMesh) result.push(o as T.Mesh);
    });
  return result;
}
function pose(car: T.Group, spin: number, steer: number) {
  car.position.set(540, 7.92, -625);
  car.rotation.set(0.08, -1.07, 0.04);
  for (const name of [
    "WheelFrontL",
    "WheelFrontR",
    "WheelRearL",
    "WheelRearR",
  ]) {
    car.getObjectByName(name + "Spin")!.rotation.x = spin;
    car.getObjectByName(name)!.rotation.y = name.includes("Front") ? steer : 0;
  }
  car.updateMatrixWorld(true);
}
for (const [file, triangles] of [
  ["car-concept", 65240],
  ["car-traffic", 18588],
] as const)
  test(`${file}: six batches preserve actual cloned geometry, wheel motion, radius and materials`, async () => {
    const template = await source(file);
    const baseline = cloneDetailedCar(template),
      candidate = cloneDetailedCar(template),
      second = cloneDetailedCar(template);
    const originals = wheelMeshes(baseline.group);
    assert.equal(originals.length, 24);
    assert.equal(
      originals.reduce((n, m) => n + m.geometry.index!.count / 3, 0),
      triangles,
    );
    assert.equal(batchCarWheels(baseline.group, false).length, 0);
    assert.deepEqual(
      wheelMeshes(baseline.group),
      originals,
      "unsupported capability leaves draw hierarchy intact",
    );
    const batches = batchCarWheels(candidate.group, true);
    assert.equal(batches.length, 6);
    assert.equal(wheelMeshes(candidate.group).length, 0);
    assert.deepEqual(
      batchCarWheels(candidate.group, true),
      batches,
      "idempotent",
    );
    const more = batchCarWheels(second.group, true);
    batches.forEach((batch, i) => {
      assert.equal(
        batch.geometry,
        more[i].geometry,
        "packed geometry shared across cars",
      );
      assert.notEqual(
        batch.material,
        more[i].material,
        "per-car material clone remains independent",
      );
      const material = batch.material as T.MeshStandardMaterial;
      const parts = originals.filter(
        (m) => (m.material as T.Material).name === material.name,
      );
      assert.equal(parts.length, 4);
      const old = parts[0].material as T.MeshStandardMaterial;
      assert.equal(material.map, old.map);
      assert.equal(material.normalMap, old.normalMap);
      assert.equal(material.roughness, old.roughness);
      assert.equal(material.metalness, old.metalness);
      assert.deepEqual(material.color.toArray(), old.color.toArray());
      parts.forEach((part, id) => {
        const range = batch.getGeometryRangeAt(id)!;
        for (const [name, attribute] of Object.entries(
          part.geometry.attributes,
        )) {
          const actual = batch.geometry.attributes[name];
          for (let v = 0; v < attribute.count; v++)
            for (let c = 0; c < attribute.itemSize; c++)
              assert.equal(
                actual.getComponent(range.vertexStart + v, c),
                attribute.getComponent(v, c),
                `${name} vertex ${v} component ${c}`,
              );
        }
        assert.deepEqual(
          Array.from(
            batch.geometry.index!.array.slice(
              range.indexStart,
              range.indexStart + range.indexCount,
            ),
            (v) => v - range.vertexStart,
          ),
          Array.from(part.geometry.index!.array),
        );
      });
    });
    const v = new T.Vector3(),
      expected = new T.Vector3(),
      transform = new T.Matrix4();
    for (const [spin, steer] of [
      [0, 0],
      [Math.PI / 2, 0],
      [Math.PI, 0.45],
      [4.8, -0.45],
    ]) {
      pose(baseline.group, spin, steer);
      pose(candidate.group, spin, steer);
      syncCarWheelBatches(candidate.group);
      for (const batch of batches) {
        const parts = originals.filter(
          (m) =>
            (m.material as T.Material).name ===
            (batch.material as T.Material).name,
        );
        for (let id = 0; id < parts.length; id++) {
          batch
            .getMatrixAt(id, transform)
            .premultiply(candidate.group.matrixWorld);
          const positions = parts[id].geometry.attributes.position;
          for (let j = 0; j < positions.count; j++) {
            v.fromBufferAttribute(positions, j).applyMatrix4(transform);
            expected
              .fromBufferAttribute(positions, j)
              .applyMatrix4(parts[id].matrixWorld);
            assert.ok(
              v.distanceTo(expected) < 1e-5,
              `${parts[id].name} transformed vertex`,
            );
          }
        }
      }
      assert.deepEqual(
        candidate.wheels.map((w) => w.userData.rollingRadius),
        baseline.wheels.map((w) => w.userData.rollingRadius),
      );
      assert.equal(
        candidate.group.userData.roadClearance,
        baseline.group.userData.roadClearance,
      );
    }
    const brake = batches.find(
      (b) => (b.material as T.Material).name === "Brake",
    )!;
    const before = brake.getMatrixAt(0, new T.Matrix4()).clone();
    pose(candidate.group, 8.8, -0.45);
    syncCarWheelBatches(candidate.group);
    assert.ok(
      before.elements.every(
        (x, i) =>
          Math.abs(x - brake.getMatrixAt(0, new T.Matrix4()).elements[i]) <
          1e-7,
      ),
      "caliper does not spin",
    );
    assert.notDeepEqual(
      batches[0].getMatrixAt(0, new T.Matrix4()).elements,
      more[0].getMatrixAt(0, new T.Matrix4()).elements,
      "per-car transforms do not leak",
    );
    const bytes = batches.reduce(
      (n, b) =>
        n +
        b.geometry.index!.array.byteLength +
        Object.values(b.geometry.attributes).reduce(
          (sum, a) => sum + a.array.byteLength,
          0,
        ),
      0,
    );
    console.log(
      `${file}: 24 → 6 render objects; ${triangles} exact wheel triangles; ${bytes} packed bytes shared across clones.`,
    );
  });

test("actual wheels retain independent camera and shadow frustum culling after steering", async () => {
  const template = await source("car-traffic");
  const original = cloneDetailedCar(template).group,
    candidate = cloneDetailedCar(template).group;
  const meshes = wheelMeshes(original);
  const batches = batchCarWheels(candidate, true);
  original.getObjectByName("WheelFrontL")!.rotation.y = 0.4;
  candidate.getObjectByName("WheelFrontL")!.rotation.y = 0.4;
  original.updateMatrixWorld(true);
  syncCarWheelBatches(candidate);
  const front = original
    .getObjectByName("WheelFrontL")!
    .getWorldPosition(new T.Vector3());
  const narrow = new T.OrthographicCamera(-0.25, 0.25, 0.3, -0.3, 0.1, 40);
  narrow.position.set(10, front.y, front.z);
  narrow.lookAt(0, front.y, front.z);
  narrow.updateMatrixWorld(true);
  const wide = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 40);
  wide.position.set(0, 5, 15);
  wide.lookAt(0, 0, 0);
  wide.updateMatrixWorld(true);
  const empty = wide.clone();
  empty.position.x = 100;
  empty.lookAt(100, 0, 0);
  empty.updateMatrixWorld(true);
  const renderer = {} as T.WebGLRenderer,
    scene = new T.Scene(),
    depth = new T.MeshDepthMaterial();
  for (const [view, shadow] of [
    [wide, false],
    [narrow, true],
    [empty, false],
    [wide, true],
    [narrow, false],
  ] as const) {
    const f = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        view.projectionMatrix,
        view.matrixWorldInverse,
      ),
    );
    const expected = meshes.filter((mesh) => f.intersectsObject(mesh)).length;
    let actual = 0;
    for (const batch of batches) {
      if (shadow)
        batch.onBeforeShadow(
          renderer,
          batch as unknown as T.Scene,
          wide,
          view,
          batch.geometry,
          depth,
          null as never,
        );
      else
        batch.onBeforeRender(
          renderer,
          scene,
          view,
          batch.geometry,
          batch.material,
          null as never,
        );
      actual += (batch as unknown as { _multiDrawCount: number })
        ._multiDrawCount;
    }
    assert.equal(actual, expected);
    if (view === narrow)
      assert.ok(
        actual > 0 && actual < 24,
        "individual wheel culling, not whole-car visibility",
      );
    if (view === empty) assert.equal(actual, 0);
  }
});
