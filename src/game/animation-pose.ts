import type { Object3D } from "three";

/** Keep procedural IK/lean out of the next AnimationMixer evaluation.
 * Constant animation tracks may skip writes, so mixer.update alone does not
 * restore joints that were altered after the preceding animation frame.
 */
export function animationPose(bones: Iterable<Object3D>) {
  const rotations = Array.from(bones, (bone) => ({
    bone,
    quaternion: bone.quaternion.clone(),
  }));
  return {
    restore() {
      for (const { bone, quaternion } of rotations)
        bone.quaternion.copy(quaternion);
    },
    capture() {
      for (const { bone, quaternion } of rotations)
        quaternion.copy(bone.quaternion);
    },
  };
}
