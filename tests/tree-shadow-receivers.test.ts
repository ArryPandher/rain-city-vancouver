import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  directionalShadowMargin,
  shadowSphereReachesView,
  TreeShadowReceivers,
} from "../src/rendering/tree-shadow-receivers";
function view() {
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld(true);
  return {
    camera,
    frustum: new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    ),
  };
}
test("keeps off-camera casters projecting into view, rejects only outgoing shadows", () => {
  const { frustum } = view();
  const sphere = new T.Sphere(new T.Vector3(20, 0, -10), 1);
  assert.equal(frustum.intersectsSphere(sphere), false);
  assert.equal(
    shadowSphereReachesView(sphere, new T.Vector3(-1, 0, 0), frustum),
    true,
  );
  assert.equal(
    shadowSphereReachesView(sphere, new T.Vector3(1, 0, 0), frustum),
    false,
  );
  assert.equal(shadowSphereReachesView(sphere, new T.Vector3(), frustum), true);
});
test("conservative test retains every sampled sphere point whose projected shadow enters view", () => {
  const { frustum } = view();
  let verified = 0;
  for (let x = -30; x <= 30; x += 3)
    for (let y = -20; y <= 20; y += 4) {
      const sphere = new T.Sphere(new T.Vector3(x, y, -15), 2);
      const direction = new T.Vector3(-0.8, -0.6, 0);
      let reaches = false;
      for (let t = 0; t <= 70; t += 1)
        for (const offset of [
          new T.Vector3(),
          new T.Vector3(2, 0, 0),
          new T.Vector3(-2, 0, 0),
          new T.Vector3(0, 2, 0),
          new T.Vector3(0, -2, 0),
        ]) {
          if (
            frustum.containsPoint(
              sphere.center.clone().add(offset).addScaledVector(direction, t),
            )
          )
            reaches = true;
        }
      if (reaches) {
        verified++;
        assert.equal(shadowSphereReachesView(sphere, direction, frustum), true);
      }
    }
  assert.ok(verified > 50);
});
test("world-transformed slots restore all casters for capture without touching visibility or buffers", () => {
  const { camera } = view(),
    sun = new T.DirectionalLight();
  sun.position.set(-10, 0, 0);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const mesh = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshStandardMaterial(),
    1,
  );
  mesh.position.set(20, 0, -10);
  mesh.setMatrixAt(0, new T.Matrix4());
  mesh.updateMatrixWorld(true);
  mesh.castShadow = true;
  const matrix = mesh.instanceMatrix.array,
    geometry = mesh.geometry,
    policy = new TreeShadowReceivers();
  assert.equal(policy.update([mesh], camera, sun), true);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.visible, true);
  assert.equal(policy.update([mesh], camera, sun), false);
  assert.equal(policy.update([mesh]), true);
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.geometry, geometry);
  assert.equal(mesh.instanceMatrix.array, matrix);
  mesh.position.set(0, 0, -10);
  mesh.updateMatrixWorld(true);
  assert.equal(policy.update([mesh], camera, sun), false);
  assert.equal(mesh.castShadow, true);
});

test("render scope restores authored flags on throw and reevaluates a paused camera", () => {
  const { camera } = view(),
    sun = new T.DirectionalLight();
  sun.position.set(-10, 0, 0);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const caster = new T.InstancedMesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
    1,
  );
  caster.setMatrixAt(0, new T.Matrix4());
  caster.position.set(20, 0, -10);
  caster.updateMatrixWorld(true);
  caster.castShadow = true;
  const noncaster = caster.clone();
  noncaster.castShadow = false;
  const policy = new TreeShadowReceivers();
  assert.throws(
    () =>
      policy.render([caster, noncaster], camera, sun, (changed) => {
        assert.equal(changed, true);
        assert.equal(caster.castShadow, false);
        assert.equal(noncaster.castShadow, false);
        throw Error("draw failed");
      }),
    /draw failed/,
  );
  assert.equal(caster.castShadow, true);
  assert.equal(noncaster.castShadow, false);
  // Failure did not commit a policy. Retry is dirty; identical successful
  // paused frames stay clean despite finally restoring castShadow=true.
  policy.render([caster, noncaster], camera, sun, (changed) =>
    assert.equal(changed, true),
  );
  policy.render([caster, noncaster], camera, sun, (changed) =>
    assert.equal(changed, false),
  );
  assert.throws(
    () =>
      policy.render([caster, noncaster], camera, sun, (changed) => {
        assert.equal(changed, false);
        throw Error("cached draw failed");
      }),
    /cached draw failed/,
  );
  policy.render([caster, noncaster], camera, sun, (changed) =>
    assert.equal(changed, true),
  );
  // No actor update: camera alone changes while gameplay is paused.
  camera.lookAt(caster.position);
  camera.updateMatrixWorld(true);
  policy.render([caster, noncaster], camera, sun, (changed) => {
    assert.equal(changed, true);
    assert.equal(caster.castShadow, true);
    assert.equal(noncaster.castShadow, false);
  });
  assert.equal(caster.castShadow, true);
  assert.equal(noncaster.castShadow, false);
});

test("visible slot membership changes invalidate a previously successful policy", () => {
  const { camera } = view(),
    sun = new T.DirectionalLight();
  sun.position.set(-10, 0, 0);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const mesh = new T.InstancedMesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
    1,
  );
  mesh.position.set(0, 0, -5);
  mesh.updateMatrixWorld(true);
  mesh.castShadow = true;
  const policy = new TreeShadowReceivers();
  policy.render([mesh], camera, sun, (changed) => assert.equal(changed, true));
  policy.render([mesh], camera, sun, (changed) => assert.equal(changed, false));
  policy.render([], camera, sun, (changed) => assert.equal(changed, true));
  policy.render([], camera, sun, (changed) => assert.equal(changed, false));
  policy.render([mesh], camera, sun, (changed) => assert.equal(changed, true));
});

test("diagnostic counts describe only the last successful scope", () => {
  const { camera } = view(),
    sun = new T.DirectionalLight();
  sun.position.set(-10, 0, 0);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const caster = new T.InstancedMesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
    1,
  );
  caster.position.set(20, 0, -10);
  caster.updateMatrixWorld(true);
  caster.castShadow = true;
  const noncaster = caster.clone();
  noncaster.castShadow = false;
  const policy = new TreeShadowReceivers();
  assert.equal(policy.state, undefined);
  policy.render([caster, noncaster], camera, sun, () => {});
  assert.deepEqual(policy.state, {
    tested: 1,
    retained: 0,
    rejected: 1,
    intentionalNoncasters: 1,
  });
  assert.ok(Object.isFrozen(policy.state));
  const previous = policy.state;
  camera.lookAt(caster.position);
  camera.updateMatrixWorld(true);
  assert.throws(() =>
    policy.render([caster, noncaster], camera, sun, () => {
      throw Error("failed");
    }),
  );
  assert.equal(policy.state, previous);
  policy.render([caster, noncaster], camera, sun, () => {});
  assert.deepEqual(policy.state, {
    tested: 1,
    retained: 1,
    rejected: 0,
    intentionalNoncasters: 1,
  });
  assert.equal(caster.castShadow, true);
  assert.equal(noncaster.castShadow, false);
});

test("PCF and bias padding retains an edge caster whose exact shadow misses view", () => {
  const sun = new T.DirectionalLight();
  Object.assign(sun.shadow.camera, {
    left: -80,
    right: 80,
    top: 80,
    bottom: -80,
    near: 0.1,
    far: 400,
  });
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 3.5;
  sun.shadow.bias = -0.00004;
  sun.shadow.normalBias = 0.025;
  const margin = directionalShadowMargin(sun);
  assert.ok(margin > 0.3 && margin < 0.5);
  const frustum = new T.Frustum(
    new T.Plane(new T.Vector3(1, 0, 0), 0),
    ...Array.from(
      { length: 5 },
      () => new T.Plane(new T.Vector3(0, 0, 1), 100),
    ),
  );
  const sphere = new T.Sphere(new T.Vector3(-1.1, 0, 0), 1),
    direction = new T.Vector3(0, -1, 0);
  assert.equal(shadowSphereReachesView(sphere, direction, frustum), false);
  sphere.radius += margin;
  assert.equal(shadowSphereReachesView(sphere, direction, frustum), true);
  sun.shadow.mapSize.x = 0;
  assert.equal(directionalShadowMargin(sun), Infinity);
  sphere.radius = directionalShadowMargin(sun);
  assert.equal(shadowSphereReachesView(sphere, direction, frustum), true);
});
