import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makeDetailedCharacterFromTemplate } from "../src/game/detailed-character";

async function model(name: string) {
  const bytes = await readFile(
    new URL(`../public/models/${name}.glb`, import.meta.url),
  );
  const loader = new GLTFLoader();
  // Keep actual geometry, skins and animations; image decoding needs a browser.
  loader.register(() => ({
    name: "test-no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  return loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}

for (const [name, variant, triangles] of [
  ["rain-city-protagonist", 0, 34906],
  ["rain-city-protagonist", 4, 34906],
  ["rain-city-pedestrian", 3, 42321],
] as const) {
  test(`${name} variant ${variant}: actual animated vertices remain inside independent mesh bounds`, async () => {
    const source = await model(name);
    const actor = makeDetailedCharacterFromTemplate(source, variant);
    const second = makeDetailedCharacterFromTemplate(source, variant);
    const meshes: T.SkinnedMesh[] = [];
    actor.group.traverse((o) => {
      if ((o as T.Mesh).isMesh) meshes.push(o as T.SkinnedMesh);
    });
    assert.equal(
      meshes.reduce((sum, m) => sum + m.geometry.index!.count / 3, 0),
      triangles,
    );
    const other: T.SkinnedMesh[] = [];
    second.group.traverse((o) => {
      if ((o as T.Mesh).isMesh) other.push(o as T.SkinnedMesh);
    });
    meshes.forEach((m, i) => {
      assert.equal(m.geometry, other[i].geometry);
      assert.notEqual(m.boundingSphere, other[i].boundingSphere);
      assert.equal(m.frustumCulled, true);
      assert.equal(m.castShadow, true);
    });
    const vertex = new T.Vector3();
    let time = 0,
      maximumFraction = 0;
    // Real mixer transitions plus full gait/cycle phases and world/root transforms.
    for (const [speed, aim, bike] of [
      [0, false, false],
      [2.2, false, false],
      [5.2, false, false],
      [2.2, true, false],
      [0, true, false],
      [0, false, true],
    ] as const) {
      for (let frame = 0; frame < 32; frame++) {
        time += 0.1;
        actor.group.position.set(570, 7.88, -640);
        actor.group.rotation.set(0, 1.7, frame >= 24 ? Math.PI / 2 : 0);
        actor.group.scale.set(1.1, 0.95, 1.05);
        actor.update(time, speed, aim, bike, (frame / 32) * Math.PI * 4);
        actor.group.updateMatrixWorld(true);
        for (const mesh of meshes) {
          mesh.skeleton?.update();
          const sphere = mesh.boundingSphere!;
          const worldSphere = sphere.clone().applyMatrix4(mesh.matrixWorld);
          for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            mesh.getVertexPosition(i, vertex);
            const fraction = vertex.distanceTo(sphere.center) / sphere.radius;
            maximumFraction = Math.max(maximumFraction, fraction);
            assert.ok(
              vertex
                .clone()
                .applyMatrix4(mesh.matrixWorld)
                .distanceTo(worldSphere.center) <= worldSphere.radius,
              "transformed render-pass sphere contains vertex",
            );
            assert.ok(
              fraction <= 1,
              `${mesh.name} pose ${speed}/${aim}/${bike}/${frame}: ${fraction}`,
            );
          }
        }
      }
    }
    console.log(
      `${name} variant ${variant}: maximum bound radius fraction ${maximumFraction.toFixed(4)}`,
    );
  });
}

test("camera rejection does not suppress a valid offscreen shadow caster", async () => {
  const actor = makeDetailedCharacterFromTemplate(
    await model("rain-city-protagonist"),
  );
  actor.group.position.set(20, 0, 0);
  actor.group.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 1, 10);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const shadow = new T.OrthographicCamera(-40, 40, 40, -40, 0.1, 100);
  shadow.position.set(0, 30, 20);
  shadow.lookAt(0, 0, 0);
  shadow.updateMatrixWorld(true);
  const frustum = (c: T.Camera) =>
    new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        c.projectionMatrix,
        c.matrixWorldInverse,
      ),
    );
  actor.group.traverse((o) => {
    if (!(o as T.Mesh).isMesh) return;
    assert.equal(frustum(camera).intersectsObject(o), false);
    assert.equal(frustum(shadow).intersectsObject(o), true);
    assert.equal(o.visible, true);
  });
  assert.equal(actor.group.visible, true);
});
