import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { CollisionWorld } from "../src/world/collision";
import { makeDetailedCharacterFromTemplate } from "../src/game/detailed-character";
import type { CityData } from "../src/world/data";
import {
  CharacterLocomotion,
  locomotionWeights,
  walkingLocomotion,
  MOVING_CLIPS,
  locomotionClipPhase,
} from "../src/game/locomotion";
const close = (a: number, b: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const empty: CityData = {
  meta: { bbox: [], latC: 0, pxPerMeter: 2, w: 1, h: 1, fetched: "" },
  buildings: [],
  roads: [],
  areas: [],
  trees: [],
  ocean: [],
  pois: [],
};
const assets = new Map<string, Promise<GLTF>>();
function asset(name = "rain-city-protagonist") {
  if (!assets.has(name)) {
    const bytes = fs.readFileSync(`public/models/${name}.glb`),
      loader = new GLTFLoader();
    loader.register(() => ({
      name: "no-images",
      loadTexture: () => Promise.resolve(new T.Texture()),
    }));
    assets.set(
      name,
      loader.parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "",
      ),
    );
  }
  return assets.get(name)!;
}
async function rig(name?: string) {
  const source = await asset(name),
    root = clone(source.scene),
    mixer = new T.AnimationMixer(root);
  const actions = new Map(
    source.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
  );
  return {
    source,
    root,
    mixer,
    actions,
    controller: new CharacterLocomotion(
      actions,
      name === "rain-city-pedestrian" ? 3 : 0,
    ),
  };
}

test("collision-blocked walking settles to idle and emits no footsteps", async () => {
  const collision = new CollisionWorld({
    ...empty,
    buildings: [{ id: "wall", pts: [0, -10, 10, -10, 10, 10, 0, 10] }],
  });
  const { controller, mixer } = await rig();
  const dt = 1 / 60;
  let position = { x: -0.361, z: 0 },
    distance = 0.7,
    steps = 0;
  for (let i = 0; i < 30; i++) {
    controller.update(dt, 3.2, false);
    mixer.update(dt);
  }
  for (let i = 0; i < 60; i++) {
    const moved = collision.move(position.x, position.z, 3.2 * dt, 0, 0.36, 0);
    assert.equal(moved.hit, true);
    const motion = walkingLocomotion(position, moved, dt, true, distance);
    close(motion.speed, 0);
    distance = motion.footstepDistance;
    steps += Number(motion.step);
    controller.update(dt, motion.speed, false);
    mixer.update(dt);
    position = moved;
  }
  assert.equal(steps, 0);
  close(distance, 0.7);
  assert.deepEqual(controller.snapshot().targets, { idle: 1 });
  assert.deepEqual(
    controller.snapshot().clips.map((c) => [c.name, c.weight]),
    [["idle", 1]],
  );
});

test("rail sliding uses actual tangential velocity and distance; airborne travel cannot emit steps", () => {
  const collision = new CollisionWorld(empty);
  collision.addBarrier(0, -20, 0, 20, 0.025, 2);
  const dt = 1 / 60,
    component = 3.2 / Math.sqrt(2);
  let position = { x: -0.39, z: 0 },
    distance = 0,
    steps = 0;
  for (let i = 0; i < 120; i++) {
    const moved = collision.move(
      position.x,
      position.z,
      component * dt,
      component * dt,
      0.36,
      0,
    );
    const motion = walkingLocomotion(position, moved, dt, true, distance);
    close(motion.speed, component);
    close(motion.x, 0);
    close(motion.z, component);
    steps += Number(motion.step);
    distance = motion.footstepDistance;
    position = moved;
  }
  assert.equal(steps, 5);
  close(position.x, -0.39);
  close(position.z, component * 2);
  const air = walkingLocomotion(
    { x: 0, z: 0 },
    { x: 0, z: 3.2 },
    1,
    false,
    0.7,
  );
  close(air.speed, 3.2);
  close(air.footstepDistance, 0.7);
  assert.equal(air.step, false);
});

test("grounded armed directions continuously blend with correct left sign and backward diagonals", () => {
  const weights = (x: number, z: number, facing = 0) =>
    locomotionWeights(2, false, { x, z, grounded: true }, facing);
  assert.deepEqual(weights(0, 2), { walk: 1 });
  assert.deepEqual(weights(0, -2), { walk_back: 1 });
  assert.deepEqual(weights(2, 0), { strafe_left: 1 });
  assert.deepEqual(weights(-2, 0), { strafe_right: 1 });
  assert.deepEqual(weights(1, 1), { walk: 0.5, strafe_left: 0.5 });
  assert.deepEqual(weights(-1, 1), { walk: 0.5, strafe_right: 0.5 });
  assert.deepEqual(weights(1, -1), { walk_back: 0.5, strafe_left: 0.5 });
  assert.deepEqual(weights(-1, -1), { walk_back: 0.5, strafe_right: 0.5 });
  close(weights(2, 0, Math.PI / 2).walk!, 1);
  close(weights(0, -2, Math.PI / 2).strafe_left!, 1);
  for (const boundary of [
    0,
    Math.PI / 4,
    Math.PI / 2,
    (3 * Math.PI) / 4,
    Math.PI,
  ]) {
    const a = weights(Math.sin(boundary - 1e-5), Math.cos(boundary - 1e-5));
    const b = weights(Math.sin(boundary + 1e-5), Math.cos(boundary + 1e-5));
    for (const name of MOVING_CLIPS)
      assert.ok(Math.abs((a[name] ?? 0) - (b[name] ?? 0)) < 0.0001);
  }
  // No directional context means the existing holstered turn-to-travel behavior.
  assert.deepEqual(locomotionWeights(3.2, false), { walk: 1 });
  assert.deepEqual(locomotionWeights(6.8, false), { run: 1 });
  assert.deepEqual(
    locomotionWeights(3.2, false, { x: 0, z: -3.2, grounded: false }),
    { walk: 1 },
  );
  assert.deepEqual(
    locomotionWeights(6.8, true, { x: 1, z: -1, grounded: true }),
    { idle: 1 },
  );
});

for (const model of ["rain-city-protagonist", "rain-city-pedestrian"]) {
  test(`${model}: real clip channels and continuous blend weights retain a shared contact phase`, async () => {
    const { source, mixer, actions, controller } = await rig(model);
    const channels = source.animations
      .find((c) => c.name === "walk")!
      .tracks.map((t) => t.name)
      .sort();
    for (const name of MOVING_CLIPS) {
      const clip = source.animations.find((c) => c.name === name);
      assert.ok(clip, `${name} missing`);
      assert.deepEqual(
        clip.tracks.map((t) => t.name).sort(),
        channels,
        `${name} rig bindings differ`,
      );
    }
    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) {
      controller.update(dt, 3.2, false);
      mixer.update(dt);
    }
    const before = controller.snapshot();
    controller.update(0, 6.8, false);
    close(controller.snapshot().normalizedPhase, before.normalizedPhase);
    assert.deepEqual(
      controller.snapshot().clips.map((c) => [c.name, c.weight]),
      before.clips.map((c) => [c.name, c.weight]),
    );
    for (let i = 0; i < 90; i++) {
      const angle = (i * Math.PI) / 45,
        speed = i < 30 ? 6.8 : 2;
      controller.update(dt, speed, false, {
        x: Math.sin(angle) * speed,
        z: Math.cos(angle) * speed,
        grounded: true,
      });
      mixer.update(dt);
      const state = controller.snapshot();
      close(
        state.clips.reduce((n, c) => n + c.weight, 0),
        1,
        0.001,
      );
      for (const name of MOVING_CLIPS)
        close(
          actions.get(name)!.time / actions.get(name)!.getClip().duration,
          locomotionClipPhase(
            state.normalizedPhase,
            name,
            model === "rain-city-pedestrian" ? 3 : 0,
          ),
        );
    }
  });

  test(`${model}: source boot contact order validates phase offsets instead of assuming equal clip times`, async (t) => {
    const source = await asset(model),
      root = clone(source.scene),
      mixer = new T.AnimationMixer(root),
      point = new T.Vector3();
    root.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(root),
      scale = 1.84 / (bounds.max.y - bounds.min.y);
    const probes: { mesh: T.SkinnedMesh; index: number; side: number }[] = [];
    root.traverse((o) => {
      if (!(o instanceof T.SkinnedMesh) || !/^Cloth_boots/.test(o.name)) return;
      o.skeleton.update();
      const feet: { index: number; x: number; y: number; z: number }[][] = [
        [],
        [],
      ];
      for (let i = 0; i < o.geometry.attributes.position.count; i++) {
        o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld);
        feet[point.x < 0 ? 0 : 1].push({
          index: i,
          x: point.x,
          y: point.y,
          z: point.z,
        });
      }
      feet.forEach((vertices, side) => {
        const minX = Math.min(...vertices.map((v) => v.x)),
          maxX = Math.max(...vertices.map((v) => v.x));
        const minZ = Math.min(...vertices.map((v) => v.z)),
          maxZ = Math.max(...vertices.map((v) => v.z));
        const cells = new Map<number, (typeof vertices)[number]>();
        for (const v of vertices) {
          const key =
            Math.min(2, Math.floor((3 * (v.x - minX)) / (maxX - minX))) +
            3 * Math.min(4, Math.floor((5 * (v.z - minZ)) / (maxZ - minZ)));
          const old = cells.get(key);
          if (!old || v.y < old.y) cells.set(key, v);
        }
        for (const v of cells.values())
          probes.push({ mesh: o, index: v.index, side });
      });
    });
    assert.equal(probes.length, 30);
    const skeletons = [...new Set(probes.map((p) => p.mesh.skeleton))],
      count = 120;
    const records: Record<string, number[]> = {};
    for (const name of MOVING_CLIPS) {
      mixer.stopAllAction();
      const clip = source.animations.find((c) => c.name === name)!,
        action = mixer.clipAction(clip).reset().play(),
        values = [];
      for (let i = 0; i < count; i++) {
        action.time =
          locomotionClipPhase(
            i / count,
            name,
            model === "rain-city-pedestrian" ? 3 : 0,
          ) * clip.duration;
        mixer.update(0);
        root.updateMatrixWorld(true);
        skeletons.forEach((s) => s.update());
        const low = [Infinity, Infinity];
        for (const p of probes) {
          p.mesh
            .getVertexPosition(p.index, point)
            .applyMatrix4(p.mesh.matrixWorld);
          low[p.side] = Math.min(low[p.side], point.y * scale);
        }
        values.push(low[1] - low[0]);
      }
      records[name] = values;
    }
    for (const name of MOVING_CLIPS) {
      const a = records.walk,
        b = records[name];
      let agree = 0,
        compared = 0;
      for (let i = 0; i < count; i++)
        if (Math.abs(a[i]) > 0.005 && Math.abs(b[i]) > 0.005) {
          compared++;
          if (Math.sign(a[i]) === Math.sign(b[i])) agree++;
        }
      const correlation =
        a.reduce((n, v, i) => n + v * b[i], 0) /
        Math.sqrt(
          a.reduce((n, v) => n + v * v, 0) * b.reduce((n, v) => n + v * v, 0),
        );
      t.diagnostic(
        `${name}: supporting-foot agreement ${agree}/${compared}, correlation ${correlation.toFixed(3)}`,
      );
      assert.ok(
        compared > count / 2,
        "contact must be unambiguous for most of the cycle",
      );
      assert.ok(agree / compared > 0.95, `${name} switches supporting feet`);
      assert.ok(
        correlation > 0.85,
        `${name} source contact cycle is misaligned`,
      );
    }
  });
}

for (const [model, variant] of [
  ["rain-city-protagonist", 0],
  ["rain-city-pedestrian", 3],
] as const)
  test(`${model}: armed diagonal blends retain actual boot grounding and finite hand IK`, async () => {
    const actor = makeDetailedCharacterFromTemplate(
        await asset(model),
        variant,
      ),
      boots: T.SkinnedMesh[] = [];
    actor.group.traverse((o) => {
      if (o instanceof T.SkinnedMesh && /^Cloth_boots/.test(o.name))
        boots.push(o);
    });
    actor.group.position.set(470, 7.88, -590);
    actor.group.rotation.y = 0.8;
    const point = new T.Vector3(),
      inverse = new T.Matrix4();
    let low = Infinity,
      high = -Infinity;
    for (let i = 0; i < 64; i++) {
      const angle = (i * Math.PI) / 16,
        velocity = {
          x: 2 * Math.sin(angle),
          z: 2 * Math.cos(angle),
          grounded: true,
        };
      actor.update((i + 1) / 30, 2, true, false, 0, velocity);
      actor.group.updateMatrixWorld(true);
      inverse.copy(actor.group.matrixWorld).invert();
      let sole = Infinity;
      for (const boot of boots) {
        boot.skeleton.update();
        for (let j = 0; j < boot.geometry.attributes.position.count; j++) {
          boot
            .getVertexPosition(j, point)
            .applyMatrix4(boot.matrixWorld)
            .applyMatrix4(inverse);
          sole = Math.min(sole, point.y);
        }
      }
      low = Math.min(low, sole);
      high = Math.max(high, sole);
      assert.ok(actor.rightHand.position.toArray().every(Number.isFinite));
      assert.deepEqual(actor.group.position.toArray(), [470, 7.88, -590]);
    }
    assert.ok(low > -0.01, `blended boot sinks ${low}`);
    assert.ok(high < 0.008, `blended boot floats ${high}`);
  });
