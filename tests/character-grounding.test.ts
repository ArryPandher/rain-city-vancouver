import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makeDetailedCharacterFromTemplate } from "../src/game/detailed-character";
async function load(name: string) {
  const bytes = fs.readFileSync(`public/models/${name}.glb`),
    loader = new GLTFLoader();
  loader.register(() => ({
    name: "no-images",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  return loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}
for (const [model, variant] of [
  ["rain-city-protagonist", 0],
  ["rain-city-protagonist", 1],
  ["rain-city-pedestrian", 3],
] as const) {
  test(`${model}/${variant}: actual animated soles contact the unchanged root plane`, async (t) => {
    const source = await load(model),
      actor = makeDetailedCharacterFromTemplate(source, variant),
      boots: T.SkinnedMesh[] = [];
    actor.group.traverse((o) => {
      if (o instanceof T.SkinnedMesh && /^Cloth_boots/.test(o.name))
        boots.push(o);
    });
    assert.ok(boots.length);
    assert.ok(
      actor.group.userData.soleProbeCount > 0 &&
        actor.group.userData.soleProbeCount <= 30,
    );
    actor.group.position.set(470, 7.88, -590);
    actor.group.rotation.y = 1.2;
    const inverse = new T.Matrix4(),
      point = new T.Vector3();
    let time = 0,
      min = Infinity,
      max = -Infinity;
    for (const speed of [0, 1.2, 2.2])
      for (let frame = 0; frame < 40; frame++) {
        time += 0.1;
        actor.update(time, speed, frame % 2 === 0);
        actor.group.updateMatrixWorld(true);
        assert.deepEqual(actor.group.position.toArray(), [470, 7.88, -590]);
        inverse.copy(actor.group.matrixWorld).invert();
        let sole = Infinity;
        for (const mesh of boots) {
          mesh.skeleton.update();
          for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            mesh
              .getVertexPosition(i, point)
              .applyMatrix4(mesh.matrixWorld)
              .applyMatrix4(inverse);
            sole = Math.min(sole, point.y);
          }
        }
        min = Math.min(min, sole);
        max = Math.max(max, sole);
      }
    t.diagnostic(
      `all boot vertices idle/walk sole range ${min}..${max}; ${actor.group.userData.soleProbeCount} runtime probes`,
    );
    assert.ok(min > -0.008, `shoe sinks ${min}`);
    assert.ok(max < 0.005, `shoe floats ${max}`);
    // Vehicle path retains its legacy110mm body lift plus70mm seat offset.
    const body = actor.group.children[0],
      grounded = body.position.y;
    actor.update(time + 0.1, 0, false, true, 0);
    const seat = body.position.y;
    actor.update(time + 0.2, 0, false, true, Math.PI);
    assert.equal(body.position.y, seat);
    assert.ok(seat - grounded > 0.12 && seat - grounded < 0.24);
    assert.deepEqual(actor.group.position.toArray(), [470, 7.88, -590]);
  });
}
