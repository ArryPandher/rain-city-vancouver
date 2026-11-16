import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { StreetTreeShadowLOD } from "../src/world/street-tree-shadow-lod";
import { DetailedTrees, type TreeInstance } from "../src/world/detailed-trees";
import { TreeShadowReceivers } from "../src/rendering/tree-shadow-receivers";

const fixture = () => {
  const mesh = (segments: number, alpha: number) => {
    const geometry = new T.PlaneGeometry(2, 3, segments, segments);
    geometry.setAttribute(
      "treeStemScale",
      new T.InstancedBufferAttribute(new Float32Array([0.7]), 1),
    );
    const material = new T.MeshStandardMaterial({
      map: new T.Texture(),
      alphaTest: alpha,
    });
    const m = new T.InstancedMesh(geometry, material, 1);
    m.setMatrixAt(0, new T.Matrix4());
    m.customDepthMaterial = new T.MeshDepthMaterial({
      map: material.map,
      alphaTest: alpha,
    });
    m.customDistanceMaterial = new T.MeshDistanceMaterial({
      map: material.map,
      alphaTest: alpha,
    });
    m.computeBoundingBox();
    m.computeBoundingSphere();
    m.castShadow = true;
    m.onBeforeShadow = (_r, _s, _c, _sc, _g, depth) => {
      depth.alphaTest = material.alphaTest;
    };
    return m;
  };
  const target = mesh(8, 0.45),
    medium = mesh(1, 0.18);
  const camera = new T.PerspectiveCamera(),
    other = new T.PerspectiveCamera(),
    scene = new T.Scene();
  const shadowMap = {
    render: (() => {}) as T.WebGLRenderer["shadowMap"]["render"],
  };
  const renderer = { shadowMap } as T.WebGLRenderer;
  return {
    target,
    medium,
    camera,
    other,
    scene,
    shadowMap,
    renderer,
    policy: new StreetTreeShadowLOD(),
  };
};
const snapshot = (m: T.InstancedMesh) => [
  m.geometry,
  m.material,
  m.customDepthMaterial,
  m.customDistanceMaterial,
  m.onBeforeShadow,
  m.onAfterShadow,
  m.boundingBox,
  m.boundingSphere,
  m.instanceMatrix,
  m.instanceColor,
  m.visible,
  m.castShadow,
  ...m.matrixWorld.elements,
];

test("native shadow passes use existing medium geometry/mask/depth while beauty and instance state remain exact", () => {
  const f = fixture(),
    original = snapshot(f.target),
    matrix = Array.from(f.target.instanceMatrix.array);
  const sourceIndices = Array.from(f.target.geometry.index!.array);
  const wind = { value: 1 };
  f.medium.customDepthMaterial!.userData.windTime = wind;
  let calls = 0;
  f.shadowMap.render = function (lights, scene, camera) {
    assert.equal(this, f.shadowMap);
    assert.equal(scene, f.scene);
    assert.equal(camera, f.camera);
    for (const _light of lights) {
      assert.equal(f.target.geometry, f.medium.geometry);
      assert.equal(f.target.material, f.medium.material);
      assert.equal(f.target.customDepthMaterial, f.medium.customDepthMaterial);
      assert.equal(
        f.target.customDistanceMaterial,
        f.medium.customDistanceMaterial,
      );
      assert.equal(f.target.boundingSphere, f.medium.boundingSphere);
      assert.equal(f.target.onBeforeShadow, f.medium.onBeforeShadow);
      assert.equal(
        (f.target.material as T.MeshStandardMaterial).map,
        (f.medium.material as T.MeshStandardMaterial).map,
      );
      assert.equal(
        f.target.customDepthMaterial!.userData.windTime,
        wind,
        "live shader state remains shared, never frozen/cloned",
      );
      assert.equal(
        f.target.castShadow,
        false,
        "outer pass's noncaster policy must survive",
      );
      f.target.customDepthMaterial!.alphaTest = 0.5;
      f.target.onBeforeShadow(
        f.renderer,
        f.scene,
        f.camera,
        f.camera,
        f.target.geometry,
        f.target.customDepthMaterial!,
        new T.Group(),
      );
      assert.equal(f.target.customDepthMaterial!.alphaTest, 0.18);
      calls++;
    }
  };
  const native = f.shadowMap.render;
  f.policy.render(f.renderer, f.camera, [f], () => {
    assert.deepEqual(
      snapshot(f.target),
      original,
      "beauty bindings before shadow",
    );
    f.target.castShadow = false;
    f.shadowMap.render(
      [new T.DirectionalLight(), new T.SpotLight(), new T.PointLight()],
      f.scene,
      f.camera,
    );
    f.target.castShadow = true;
    assert.deepEqual(
      snapshot(f.target),
      original,
      "beauty bindings immediately after shadow",
    );
    wind.value = 2;
    f.target.castShadow = false;
    f.shadowMap.render([new T.DirectionalLight()], f.scene, f.camera);
    f.target.castShadow = true;
  });
  assert.equal(calls, 4);
  assert.equal(f.shadowMap.render, native);
  assert.deepEqual(snapshot(f.target), original);
  assert.deepEqual(Array.from(f.target.instanceMatrix.array), matrix);
  assert.deepEqual(Array.from(f.target.geometry.index!.array), sourceIndices);
});

test("nested reflection cameras see original levels; nested scopes and thrown shadow/beauty draws restore their caller", () => {
  const f = fixture(),
    original = snapshot(f.target);
  let throwShadow = false,
    nested = false;
  f.shadowMap.render = (_lights, _scene, camera) => {
    if (camera === f.other) {
      assert.deepEqual(snapshot(f.target), original);
      return;
    }
    assert.equal(f.target.geometry, f.medium.geometry);
    if (!nested) {
      nested = true;
      f.shadowMap.render([], f.scene, f.other);
      assert.equal(
        f.target.geometry,
        f.medium.geometry,
        "outer shadow restored after reflection",
      );
    }
    if (throwShadow) throw Error("shadow failed");
  };
  const native = f.shadowMap.render;
  f.policy.render(f.renderer, f.camera, [f], () => {
    const outer = f.shadowMap.render;
    f.policy.render(f.renderer, f.camera, [f], () =>
      f.shadowMap.render([], f.scene, f.camera),
    );
    assert.equal(f.shadowMap.render, outer);
    assert.deepEqual(snapshot(f.target), original);
  });
  throwShadow = true;
  assert.throws(
    () =>
      f.policy.render(f.renderer, f.camera, [f], () =>
        f.shadowMap.render([], f.scene, f.camera),
      ),
    /shadow failed/,
  );
  assert.equal(f.shadowMap.render, native);
  assert.deepEqual(snapshot(f.target), original);
  assert.throws(
    () =>
      f.policy.render(f.renderer, f.camera, [f], () => {
        throw Error("beauty failed");
      }),
    /beauty failed/,
  );
  assert.equal(f.shadowMap.render, native);
  assert.deepEqual(snapshot(f.target), original);
  // Reflections before/after the scope invoke the untouched native binding.
  f.shadowMap.render([], f.scene, f.other);
});

test("receiver rejection uses the medium shadow bounds without changing beauty bounds", () => {
  const f = fixture(),
    policy = new TreeShadowReceivers(),
    sun = new T.DirectionalLight();
  f.camera.updateMatrixWorld(true);
  sun.position.set(-10, 0, 0);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  f.target.position.set(20, 0, -10);
  f.target.updateMatrixWorld(true);
  const original = f.target.boundingSphere;
  const mediumBounds = new T.Sphere(new T.Vector3(-20, 0, 0), 2);
  policy.render(
    [f.target],
    f.camera,
    sun,
    () => assert.equal(f.target.castShadow, true),
    new Map([[f.target, mediumBounds]]),
  );
  assert.equal(f.target.boundingSphere, original);
  policy.render([f.target], f.camera, sun, () =>
    assert.equal(f.target.castShadow, false),
  );
  assert.equal(f.target.castShadow, true);
});

test("DetailedTrees hook keeps source normalization, stem/instance transforms and beauty LOD while enabling medium shadows", () => {
  const model = (segments: number, alpha: number) => {
    const g = new T.Group();
    const geometry = new T.BoxGeometry(1, 4, 1, segments, segments, segments);
    geometry.translate(0, 2, 0);
    const m = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({ name: "source leaves", alphaTest: alpha }),
    );
    m.rotation.y = 0.3;
    g.add(m);
    return g;
  };
  const scene = new T.Scene(),
    detail = DetailedTrees.fromModels(scene, [model(3, 0.45), model(1, 0.18)]);
  const fallback = new T.InstancedMesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
    1,
  );
  fallback.setMatrixAt(0, new T.Matrix4());
  const tree: TreeInstance = {
    x: 0,
    y: 1.2,
    z: 0,
    height: 10,
    width: 7,
    diameter: 0.6,
    rotation: 0.7,
    crown: fallback,
    crownIndex: 0,
    crownMatrix: new T.Matrix4(),
    trunk: fallback,
    trunkIndex: 0,
    trunkMatrix: new T.Matrix4(),
  };
  detail.samples = [tree];
  detail.budget = 1;
  const camera = new T.PerspectiveCamera(62);
  camera.position.set(0, 5, 2);
  camera.lookAt(0, 5, 0);
  camera.updateMatrixWorld(true);
  detail.update(0, 0, 0, camera);
  assert.deepEqual(detail.lodState, { near: 1, medium: 0 });
  const slot = (
    detail as unknown as {
      slots: { group: T.Group; levels: T.InstancedMesh[][] }[];
    }
  ).slots[0];
  const target = slot.levels[0][0],
    medium = slot.levels[1][0];
  slot.group.updateMatrixWorld(true);
  assert.deepEqual(target.matrixWorld.elements, medium.matrixWorld.elements);
  assert.deepEqual(target.instanceMatrix.array, medium.instanceMatrix.array);
  assert.deepEqual(
    target.geometry.getAttribute("treeStemScale").array,
    medium.geometry.getAttribute("treeStemScale").array,
  );
  const original = snapshot(target),
    treeMatrix = Array.from(slot.group.matrix.elements),
    sun = new T.DirectionalLight();
  sun.position.set(0, 20, 10);
  const renderer = {
    shadowMap: { render: () => assert.equal(target.geometry, medium.geometry) },
  } as unknown as T.WebGLRenderer;
  detail.withShadowReceivers(
    camera,
    sun,
    () => {
      assert.equal(target.geometry, original[0]);
      renderer.shadowMap.render([sun], scene, camera);
      assert.equal(target.geometry, original[0]);
    },
    renderer,
  );
  assert.deepEqual(snapshot(target), original);
  assert.deepEqual(detail.lodState, { near: 1, medium: 0 });
  assert.deepEqual(Array.from(slot.group.matrix.elements), treeMatrix);
  assert.equal(target.visible, true);
  assert.equal(medium.visible, false);
});
