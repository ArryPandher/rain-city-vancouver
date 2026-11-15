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
  attachCarLOD,
  updateCarLOD,
  syncCarLOD,
  useDistantCar,
} from "../src/world/car-lod";
import { batchCarWheels } from "../src/world/wheel-batching";
async function raw(file: string) {
  const bytes = await readFile(`public/models/${file}.glb`),
    loader = new GLTFLoader();
  loader.register(() => ({
    name: "no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    )
  ).scene;
}
function visibleTriangles(root: T.Object3D) {
  let total = 0;
  root.traverseVisible((o) => {
    if (o instanceof T.Mesh) total += o.geometry.index!.count / 3;
  });
  return total;
}
test("source-derived distant level preserves concept frame, wheels and near render geometry", async () => {
  const high = buildDetailedCarTemplate(
    await raw("car-concept"),
    () => new T.Texture(),
  );
  const traffic = await raw("car-traffic");
  const legacy = buildDetailedCarTemplate(
    traffic.clone(true),
    () => new T.Texture(),
  );
  const aligned = buildDetailedCarTemplate(
    traffic.clone(true),
    () => new T.Texture(),
    high,
  );
  assert.deepEqual(
    aligned.userData.sourceNormalization,
    high.userData.sourceNormalization,
  );
  console.log(
    "Separate normalization matrix maximum drift:",
    Math.max(
      ...legacy.userData.sourceNormalization.map((v: number, i: number) =>
        Math.abs(v - high.userData.sourceNormalization[i]),
      ),
    ),
  );
  for (const name of [
    "WheelFrontL",
    "WheelFrontR",
    "WheelRearL",
    "WheelRearR",
  ]) {
    assert.deepEqual(
      aligned.getObjectByName(name)!.position.toArray(),
      high.getObjectByName(name)!.position.toArray(),
    );
    assert.deepEqual(
      aligned.getObjectByName(name)!.userData.sourceWheelNeutral,
      high.getObjectByName(name)!.userData.sourceWheelNeutral,
    );
    assert.equal(
      aligned.getObjectByName(name + "Spin")!.userData.rollingRadius,
      high.getObjectByName(name + "Spin")!.userData.rollingRadius,
    );
  }
  high.updateMatrixWorld(true);
  aligned.updateMatrixWorld(true);
  const a = new T.Box3().setFromObject(high, true),
    b = new T.Box3().setFromObject(aligned, true);
  const drift = Math.max(
    ...a.min.toArray().map((v, i) => Math.abs(v - b.min.toArray()[i])),
    ...a.max.toArray().map((v, i) => Math.abs(v - b.max.toArray()[i])),
  );
  assert.ok(drift < 0.02, `silhouette bounding extents drift ${drift}`);
  console.log(
    `Aligned silhouette envelope maximum drift ${drift} m; tyre-ground minimum ${a.min.y} → ${b.min.y} m.`,
  );
  for (const capable of [false, true]) {
    const near = cloneDetailedCar(high),
      far = cloneDetailedCar(aligned);
    const nearGeometry = new Map<T.Mesh, T.BufferGeometry>();
    near.group.traverse((o) => {
      if (o instanceof T.Mesh) nearGeometry.set(o, o.geometry);
    });
    batchCarWheels(near.group, capable);
    const before = visibleTriangles(near.group);
    assert.equal(before, 185379);
    attachCarLOD(near, far, capable);
    assert.equal(visibleTriangles(near.group), before);
    updateCarLOD(near, 300, false);
    assert.equal(visibleTriangles(near.group), 47077);
    near.wheels.forEach((w, i) => (w.rotation.x = 2 + i * 0.2));
    near.front.forEach((w) => (w.rotation.y = 0.45));
    near.body.rotation.z = 0.03;
    near.body.position.y = 0.006;
    near.brakes.emissiveIntensity = 2;
    syncCarLOD(near);
    far.wheels.forEach((w, i) =>
      assert.deepEqual(w.rotation.toArray(), near.wheels[i].rotation.toArray()),
    );
    far.front.forEach((w, i) =>
      assert.deepEqual(w.rotation.toArray(), near.front[i].rotation.toArray()),
    );
    assert.deepEqual(far.body.position.toArray(), near.body.position.toArray());
    assert.equal(far.brakes.emissiveIntensity, 2);
    // Caliper source carriers stay on steer nodes; wheel batching retains these
    // transforms when draw meshes detach, covered by actual wheel batching tests.
    assert.equal(
      far.group.getObjectByName("WheelFrontLSpin")!.parent,
      far.group.getObjectByName("WheelFrontL"),
    );
    updateCarLOD(near, 220, false);
    assert.equal(visibleTriangles(near.group), 47077);
    updateCarLOD(near, 199, false);
    assert.equal(visibleTriangles(near.group), 185379);
    updateCarLOD(near, 400, false);
    updateCarLOD(near, 400, true);
    assert.equal(visibleTriangles(near.group), 185379);
    nearGeometry.forEach((geometry, mesh) =>
      assert.equal(mesh.geometry, geometry),
    );
  }
});
test("conservative hysteresis cannot simplify the driven car", () => {
  assert.equal(useDistantCar(240, false, false), false);
  assert.equal(useDistantCar(241, false, false), true);
  assert.equal(useDistantCar(220, true, false), true);
  assert.equal(useDistantCar(200, true, false), false);
  assert.equal(useDistantCar(1000, true, true), false);
});
