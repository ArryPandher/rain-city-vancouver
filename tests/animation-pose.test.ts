import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { animationPose } from "../src/game/animation-pose.ts";

test("repeated bicycle lean cannot accumulate on a constant animation track", () => {
  const root = new T.Group(),
    bone = new T.Bone();
  bone.name = "spine";
  root.add(bone);
  const mixer = new T.AnimationMixer(root),
    track = new T.QuaternionKeyframeTrack(
      "spine.quaternion",
      [0, 1],
      [0, 0, 0, 1, 0, 0, 0, 1],
    );
  mixer.clipAction(new T.AnimationClip("idle", 1, [track])).play();
  const pose = animationPose([bone]),
    lean = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.45);
  for (let i = 0; i < 600; i++) {
    pose.restore();
    mixer.update(1 / 60);
    pose.capture();
    bone.quaternion.premultiply(lean);
    assert.ok(bone.quaternion.angleTo(lean) < 1e-7);
  }
  pose.restore();
  mixer.update(1 / 60);
  pose.capture();
  assert.ok(bone.quaternion.angleTo(new T.Quaternion()) < 1e-7);
});
test("animated joint motion remains intact while procedural offsets are isolated", () => {
  const root = new T.Group(),
    bone = new T.Bone();
  bone.name = "arm";
  root.add(bone);
  const end = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 1),
    mixer = new T.AnimationMixer(root);
  mixer
    .clipAction(
      new T.AnimationClip("turn", 2, [
        new T.QuaternionKeyframeTrack(
          "arm.quaternion",
          [0, 2],
          [0, 0, 0, 1, ...end.toArray()],
        ),
      ]),
    )
    .play();
  const pose = animationPose([bone]),
    extra = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.6);
  for (let i = 1; i <= 60; i++) {
    pose.restore();
    mixer.update(1 / 60);
    pose.capture();
    const expected = new T.Quaternion().slerp(end, i / 120);
    assert.ok(bone.quaternion.clone().normalize().angleTo(expected) < 1e-5);
    bone.quaternion.premultiply(extra);
  }
});
