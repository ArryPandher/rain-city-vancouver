import { sunOffset } from "../src/world/daylight";
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import fairmont from "../src/world/fairmont-map.json";
import { ShadowCasterVolume } from "../src/rendering/shadow-caster-volume";
function lightAt(x = 454.6, z = -575.2) {
  const l = new T.DirectionalLight();
  l.target.position.set(x, 7.88, z);
  l.position.copy(l.target.position).add(sunOffset("day"));
  Object.assign(l.shadow.camera, {
    left: -80,
    right: 80,
    top: 80,
    bottom: -80,
    near: 1,
    far: 650,
  });
  return l;
}
function boundsMesh(box: T.Box3) {
  const g = new T.BufferGeometry();
  g.boundingBox = box;
  g.boundingSphere = box.getBoundingSphere(new T.Sphere());
  return new T.Mesh(g, new T.MeshBasicMaterial());
}
test("actual Fairmont tower bounds enter the shadow camera despite remote batch centre", () => {
  const l = lightAt(),
    query = new ShadowCasterVolume().update(l);
  for (const p of fairmont.parts.filter((p) => p.height > 100)) {
    const box = new T.Box3();
    for (const [x, z] of p.pts) {
      box.expandByPoint(new T.Vector3(x, p.minHeight, z));
      box.expandByPoint(new T.Vector3(x, p.height, z));
    }
    const mesh = boundsMesh(box);
    mesh.userData.center = [135, -675];
    assert.ok(
      Math.hypot(135 - l.target.position.x, -675 - l.target.position.z) > 330,
    );
    assert.equal(query.includes(mesh), true, `eligible actual tower ${p.id}`);
    assert.equal(
      mesh.geometry.getAttribute("position"),
      undefined,
      "released source buffers are not restored",
    );
  }
  const irrelevant = boundsMesh(
    new T.Box3(new T.Vector3(1400, 0, 1400), new T.Vector3(1500, 200, 1500)),
  );
  irrelevant.userData.center = [454, -575];
  assert.equal(
    query.includes(irrelevant),
    false,
    "near centre cannot admit geometry outside finite map",
  );
  const ground = boundsMesh(
    new T.Box3(new T.Vector3(450, 7, -580), new T.Vector3(460, 8, -570)),
  );
  ground.userData.allowShadow = false;
  assert.equal(query.includes(ground), false);
});
test("aggregate instance bounds and object transforms control eligibility", () => {
  const query = new ShadowCasterVolume().update(lightAt()),
    g = new T.BoxGeometry(1, 2, 1),
    mesh = new T.InstancedMesh(g, new T.MeshBasicMaterial(), 1);
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(454, 8, -575));
  mesh.computeBoundingSphere();
  assert.equal(query.includes(mesh), true);
  mesh.position.z = 1000;
  assert.equal(query.includes(mesh), false);
  const object = new T.Mesh(g, new T.MeshBasicMaterial());
  object.position.set(454, 8, -575);
  assert.equal(query.includes(object), true);
  object.position.x = 2000;
  assert.equal(query.includes(object), false);
});
test("probe target translation preserves sun vector without changing scene state", () => {
  const light = lightAt(),
    before = light.position.clone(),
    target = light.target.position.clone(),
    probe = new T.Vector3(0, 30, 0);
  const query = new ShadowCasterVolume().update(light, probe);
  assert.ok(
    light.position.equals(before) && light.target.position.equals(target),
  );
  const receiver = boundsMesh(
    new T.Box3(new T.Vector3(-1, 29, -1), new T.Vector3(1, 31, 1)),
  );
  assert.equal(query.includes(receiver), true);
  const old = boundsMesh(
    new T.Box3(target.clone().subScalar(1), target.clone().addScalar(1)),
  );
  assert.equal(query.includes(old), false);
  const upstream = boundsMesh(
    new T.Box3(new T.Vector3(-600, 400, -1), new T.Vector3(-590, 410, 1)),
  );
  assert.equal(
    query.includes(upstream),
    false,
    "finite near plane excludes casters behind light",
  );
});
