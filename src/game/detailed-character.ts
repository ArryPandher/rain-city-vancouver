import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Character } from "./character";

let template: GLTF | undefined;
export async function loadDetailedCharacter() {
  template = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}models/rain-city-protagonist.glb`,
  );
}

// Aim a skinned two-bone chain at a point without assuming the asset's bone axes.
function pointBone(bone: T.Object3D, child: T.Object3D, target: T.Vector3) {
  const origin = bone.getWorldPosition(new T.Vector3());
  const from = child.getWorldPosition(new T.Vector3()).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  const world = new T.Quaternion()
    .setFromUnitVectors(from, to)
    .multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(
    bone
      .parent!.getWorldQuaternion(new T.Quaternion())
      .invert()
      .multiply(world),
  );
  bone.updateWorldMatrix(false, true);
}
function reach(
  a: T.Object3D,
  b: T.Object3D,
  c: T.Object3D,
  target: T.Vector3,
  pole: T.Vector3,
) {
  const start = a.getWorldPosition(new T.Vector3());
  const middle = b.getWorldPosition(new T.Vector3());
  const end = c.getWorldPosition(new T.Vector3());
  const upper = start.distanceTo(middle),
    lower = middle.distanceTo(end);
  const axis = target.clone().sub(start);
  const distance = T.MathUtils.clamp(
    axis.length(),
    Math.abs(upper - lower) + 0.001,
    upper + lower - 0.001,
  );
  axis.normalize();
  const bend = pole.clone().sub(start);
  bend.addScaledVector(axis, -bend.dot(axis)).normalize();
  const along =
    (upper * upper + distance * distance - lower * lower) / (2 * distance);
  const elbow = start
    .clone()
    .addScaledVector(axis, along)
    .addScaledVector(
      bend,
      Math.sqrt(Math.max(0, upper * upper - along * along)),
    );
  pointBone(a, b, elbow);
  pointBone(b, c, start.addScaledVector(axis, distance));
}

export function makeDetailedCharacter(): Character | undefined {
  if (!template) return;
  const group = new T.Group();
  group.name = "Rain City protagonist";
  group.userData.detailed = true;
  const body = clone(template.scene);
  group.add(body);
  const bones = new Map<string, T.Object3D>();
  body.traverse((o) => {
    if ((o as T.Bone).isBone) bones.set(o.name, o);
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    // A skinned mesh's rest-pose bounds do not follow its animated limbs.
    mesh.frustumCulled = false;
    const materials = (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ).map((source) => {
      const m = source.clone() as T.MeshStandardMaterial;
      m.envMapIntensity = 0.5;
      if (m.name === "Cloth_tshirt") {
        m.map = null;
        m.color.setHex(0x343d37);
        m.roughness = 0.94;
      } else if (m.name === "Cloth_jeans") {
        m.color.setHex(0x56677b);
        m.roughness = 0.95;
      } else if (m.name === "Skin") {
        m.roughness = 0.66;
        m.normalScale?.setScalar(0.55);
      } else if (m.name.startsWith("Hair")) m.roughness = 0.88;
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  });
  body.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(body);
  const scale = 1.84 / (bounds.max.y - bounds.min.y);
  body.scale.setScalar(scale);
  const floor = 0.11 - bounds.min.y * scale;
  body.position.y = floor;
  const mixer = new T.AnimationMixer(body);
  const actions = new Map(
    template.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
  );
  let current = actions.get("idle")!;
  current.play();
  let last = NaN;
  const rightHand = new T.Group();
  group.add(rightHand);
  const bone = (name: string) => bones.get(name)!;
  const world = (x: number, y: number, z: number) =>
    group.localToWorld(new T.Vector3(x, y, z));
  const attach = (name: string) => {
    const g = new T.Group();
    bone(name).add(g);
    return g;
  };
  const hips = attach("pelvis"),
    head = attach("head");
  const arms = [attach("upperarm_l"), attach("upperarm_r")];
  const legs = [attach("thigh_l"), attach("thigh_r")];
  const update = (
    time: number,
    speed: number,
    aiming: boolean,
    bike = false,
    cyclePhase = 0,
  ) => {
    const dt = Number.isFinite(last)
      ? T.MathUtils.clamp(time - last, 0, 0.1)
      : 1 / 60;
    last = time;
    const name = bike
      ? "idle"
      : speed > 4.2
        ? "run"
        : speed > 0.15
          ? "walk"
          : "idle";
    const next = actions.get(name)!;
    if (next !== current) {
      current.fadeOut(0.18);
      next.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      current = next;
    }
    current.timeScale =
      name === "walk"
        ? T.MathUtils.clamp(speed / 2.2, 0.6, 1.65)
        : name === "run"
          ? speed / 5.2
          : 1;
    mixer.update(dt);
    body.position.y = floor + (bike ? 0.07 : 0);
    body.position.z = bike ? -0.24 : 0;
    group.updateWorldMatrix(true, true);
    if (bike) {
      const spine = bone("spine_01");
      const axis = new T.Vector3(1, 0, 0).applyQuaternion(
        group.getWorldQuaternion(new T.Quaternion()),
      );
      const lean = new T.Quaternion()
        .setFromAxisAngle(axis, 0.45)
        .multiply(spine.getWorldQuaternion(new T.Quaternion()));
      spine.quaternion.copy(
        spine
          .parent!.getWorldQuaternion(new T.Quaternion())
          .invert()
          .multiply(lean),
      );
      spine.updateWorldMatrix(false, true);
    }
    if (aiming || bike) {
      for (const side of ["l", "r"]) {
        const sign = side === "l" ? 1 : -1;
        const hand = bike
          ? world(sign * 0.28, 1.255, 0.405)
          : side === "r"
            ? world(-0.16, 1.36, 0.32)
            : world(-0.1, 1.32, 0.5);
        const elbow = bike
          ? world(sign * 0.45, 1.1, 0.03)
          : world(sign * 0.42, 1.06, 0.03);
        reach(
          bone(`upperarm_${side}`),
          bone(`lowerarm_${side}`),
          bone(`hand_${side}`),
          hand,
          elbow,
        );
      }
    }
    if (bike) {
      const phase = cyclePhase;
      for (const side of ["l", "r"]) {
        const sign = side === "l" ? 1 : -1,
          p = phase + (sign === 1 ? 0 : Math.PI);
        reach(
          bone(`thigh_${side}`),
          bone(`calf_${side}`),
          bone(`foot_${side}`),
          world(
            sign * 0.16,
            0.49 + Math.sin(p) * 0.15,
            -0.05 + Math.cos(p) * 0.15,
          ),
          world(sign * 0.2, 0.85, 0.6),
        );
      }
    }
    if (aiming || bike) {
      for (const side of ["l", "r"]) {
        const hand = bone(`hand_${side}`);
        const localForward = bone(`middle_01_${side}`)
          .position.clone()
          .normalize();
        const localAcross = bone(`index_01_${side}`)
          .position.clone()
          .sub(bone(`pinky_01_${side}`).position);
        localAcross
          .addScaledVector(localForward, -localAcross.dot(localForward))
          .normalize();
        const localNormal = localForward.clone().cross(localAcross).normalize();
        const source = new T.Quaternion().setFromRotationMatrix(
          new T.Matrix4().makeBasis(localAcross, localNormal, localForward),
        );
        const forward =
          side === "r" && !bike
            ? new T.Vector3(0, -0.6, 0.8)
            : new T.Vector3(0, -0.1, 1).normalize();
        const across =
          side === "r" && !bike
            ? new T.Vector3(0, 0.8, 0.6)
            : new T.Vector3(side === "l" ? 1 : -1, 0, 0);
        const normal = forward.clone().cross(across).normalize();
        const rotation = group
          .getWorldQuaternion(new T.Quaternion())
          .multiply(
            new T.Quaternion().setFromRotationMatrix(
              new T.Matrix4().makeBasis(across, normal, forward),
            ),
          )
          .multiply(source.invert());
        hand.quaternion.copy(
          hand
            .parent!.getWorldQuaternion(new T.Quaternion())
            .invert()
            .multiply(rotation),
        );
        hand.updateWorldMatrix(false, true);
        for (const finger of ["index", "middle", "ring", "pinky"]) {
          const first = bone(`${finger}_01_${side}`),
            second = bone(`${finger}_02_${side}`);
          const direction = second
            .getWorldPosition(new T.Vector3())
            .sub(first.getWorldPosition(new T.Vector3()))
            .normalize();
          const inward = new T.Vector3(
            side === "r" && !bike ? 1 : 0,
            side === "r" && !bike ? 0 : bike ? -1 : 1,
            0,
          ).applyQuaternion(group.getWorldQuaternion(new T.Quaternion()));
          const curlAxis = direction.cross(inward).normalize();
          for (let joint = 1; joint <= 3; joint++) {
            const f = bone(`${finger}_0${joint}_${side}`);
            const curl = new T.Quaternion()
              .setFromAxisAngle(curlAxis, joint === 1 ? 0.55 : 1.05)
              .multiply(f.getWorldQuaternion(new T.Quaternion()));
            f.quaternion.copy(
              f
                .parent!.getWorldQuaternion(new T.Quaternion())
                .invert()
                .multiply(curl),
            );
            f.updateWorldMatrix(false, true);
          }
        }
        hand.updateWorldMatrix(false, true);
      }
    }
    // Weapons use a common forward-facing mount at the right palm.
    const palm = bone("hand_r")
      .getWorldPosition(new T.Vector3())
      .lerp(bone("middle_01_r").getWorldPosition(new T.Vector3()), 0.7);
    rightHand.position.copy(group.worldToLocal(palm));
    rightHand.position.y += 0.065;
    rightHand.rotation.set(-Math.PI / 2, 0, 0);
  };
  update(0, 0, false);
  return { group, hips, head, arms, legs, rightHand, update };
}
