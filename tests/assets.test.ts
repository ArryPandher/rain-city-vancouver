import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { bakeGeometry } from "../src/world/geometry";
test("quantized landmark vertices retain their metre-scale size and translation", () => {
  const source = new T.BufferGeometry();
  source.setAttribute(
    "position",
    new T.BufferAttribute(
      new Int16Array([32767, 0, -32767, 0, 32767, 0]),
      3,
      true,
    ),
  );
  source.setAttribute(
    "normal",
    new T.BufferAttribute(new Int8Array([0, 127, 0, 0, 127, 0]), 3, true),
  );
  const matrix = new T.Matrix4().compose(
    new T.Vector3(35, 4, -12),
    new T.Quaternion(),
    new T.Vector3(150, 80, 250),
  );
  const result = bakeGeometry(source, matrix).getAttribute("position");
  assert.deepEqual(
    [result.getX(0), result.getY(0), result.getZ(0)],
    [185, 4, -262],
  );
  assert.equal(result.getY(1), 84);
  assert.equal(source.getAttribute("position").getX(0), 1);
});

test("optimized street-tree attributes have matching vertex counts", async () => {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const document = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .read("public/models/vancouver-street-tree.glb");
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const count = primitive.getAttribute("POSITION")!.getCount();
      assert.ok(count > 0);
      for (const semantic of primitive.listSemantics()) {
        assert.equal(
          primitive.getAttribute(semantic)!.getCount(),
          count,
          `${mesh.getName()} ${semantic}`,
        );
      }
    }
  }
});

test("protagonist includes a complete rig and fitted locomotion clips", async () => {
  const { NodeIO } = await import("@gltf-transform/core");
  const document = await new NodeIO().read(
    "public/models/rain-city-protagonist.glb",
  );
  const root = document.getRoot();
  const joints = new Set(
    root
      .listSkins()[0]
      .listJoints()
      .map((joint) => joint.getName()),
  );
  for (const name of [
    "pelvis",
    "spine_01",
    "head",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
    "middle_01_r",
    "thigh_l",
    "calf_l",
    "foot_l",
  ])
    assert.ok(joints.has(name), `missing pose attachment ${name}`);
  for (const name of ["idle", "walk", "run"]) {
    const animation = root
      .listAnimations()
      .find((clip) => clip.getName() === name);
    assert.ok(animation, `missing ${name} animation`);
    assert.ok(animation.listChannels().length >= 50);
    for (const channel of animation.listChannels()) {
      assert.ok(joints.has(channel.getTargetNode()!.getName()));
      assert.ok(
        Array.from(channel.getSampler()!.getOutput()!.getArray()!).every(
          Number.isFinite,
        ),
      );
    }
  }
});
