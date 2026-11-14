import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { SpatialInstances } from "../src/world/spatial-instances.ts";

test("spatial batches preserve geometry, matrices, colors and custom stem attributes", () => {
  const scene = new T.Scene(),
    geometry = new T.BoxGeometry(1, 3, 1);
  geometry.setAttribute(
    "treeStemScale",
    new T.InstancedBufferAttribute(new Float32Array([0.5, 0.8, 1.2, 1.8]), 1),
  );
  const source = new T.InstancedMesh(geometry, new T.MeshBasicMaterial(), 4);
  source.castShadow = true;
  scene.add(source);
  for (let i = 0; i < 4; i++) {
    source.setMatrixAt(
      i,
      new T.Matrix4().makeTranslation(i < 2 ? 0 : 80, i * 10, i % 2 ? 30 : -30),
    );
    source.setColorAt(i, new T.Color(i / 4, 0.2, 0.3));
  }
  const batches = new SpatialInstances(source, scene, 24, ["treeStemScale"]);
  batches.update();
  assert.equal(source.visible, false);
  assert.equal(
    batches.tiles.reduce((n, t) => n + t.count, 0),
    4,
  );
  const seen = new Set<number>();
  for (const tile of batches.tiles) {
    assert.equal(
      tile.geometry.getAttribute("position"),
      geometry.getAttribute("position"),
    );
    assert.notEqual(
      tile.geometry.getAttribute("treeStemScale"),
      geometry.getAttribute("treeStemScale"),
    );
    assert.equal(tile.castShadow, true);
    assert.equal(tile.frustumCulled, true);
    const m = new T.Matrix4(),
      c = new T.Color();
    tile.getMatrixAt(0, m);
    tile.getColorAt(0, c);
    const i = Math.round(m.elements[13] / 10);
    seen.add(i);
    assert.ok(Math.abs(c.r - i / 4) < 1e-6);
    assert.ok(
      Math.abs(
        tile.geometry.getAttribute("treeStemScale").getX(0) -
          geometry.getAttribute("treeStemScale").getX(i),
      ) < 1e-6,
    );
    assert.ok(
      tile.boundingSphere!.containsPoint(
        new T.Vector3().setFromMatrixPosition(m),
      ),
    );
  }
  assert.equal(seen.size, 4);
  source.count = 0;
  batches.update();
  assert.equal(batches.tiles.filter((t) => t.visible).length, 0);
  source.count = 1;
  source.setMatrixAt(0, new T.Matrix4().makeTranslation(300, 50, 500));
  batches.update();
  assert.equal(batches.tiles.length, 4);
  assert.equal(batches.tiles[0].count, 1);
  assert.ok(
    batches.tiles[0].boundingSphere!.containsPoint(new T.Vector3(300, 50, 500)),
  );
});
test("view culling rejects foliage behind the camera without removing it from shadow views", () => {
  const scene = new T.Scene(),
    source = new T.InstancedMesh(
      new T.BoxGeometry(2, 2, 2),
      new T.MeshBasicMaterial(),
      2,
    );
  source.setMatrixAt(0, new T.Matrix4().makeTranslation(0, 0, -20));
  source.setMatrixAt(1, new T.Matrix4().makeTranslation(0, 0, 20));
  scene.add(source);
  const batches = new SpatialInstances(source, scene, 16);
  batches.update();
  scene.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld(true);
  const f = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(batches.tiles.filter((t) => f.intersectsObject(t)).length, 1);
  camera.position.z = 50;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  f.setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(batches.tiles.filter((t) => f.intersectsObject(t)).length, 2);
});

test("spatial slots allocate compact buffers and can grow without losing instances", () => {
  const scene = new T.Scene(),
    source = new T.InstancedMesh(
      new T.BoxGeometry(),
      new T.MeshBasicMaterial(),
      1000,
    );
  source.count = 2;
  for (let i = 0; i < 1000; i++) {
    source.setMatrixAt(i, new T.Matrix4().makeTranslation(i % 20, i / 1000, 0));
    source.setColorAt(i, new T.Color(i / 1000, 0, 0));
  }
  scene.add(source);
  const batches = new SpatialInstances(source, scene, 32);
  batches.update();
  const first = batches.tiles[0];
  assert.equal(first.instanceMatrix.count, 8);
  let disposed = false;
  first.addEventListener("dispose", () => {
    disposed = true;
  });
  source.count = 31;
  batches.update();
  const grown = batches.tiles[0];
  assert.equal(disposed, true);
  assert.equal(first.parent, null);
  assert.equal(grown.instanceMatrix.count, 32);
  assert.equal(grown.instanceColor!.count, 32);
  assert.equal(grown.geometry, source.geometry);
  assert.equal(grown.count, 31);
  const m = new T.Matrix4(),
    c = new T.Color();
  grown.getMatrixAt(30, m);
  grown.getColorAt(30, c);
  assert.equal(m.elements[12], 10);
  assert.ok(Math.abs(m.elements[13] - 0.03) < 1e-6);
  assert.ok(Math.abs(c.r - 0.03) < 1e-6);
});
