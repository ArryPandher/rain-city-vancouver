import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { BroadleafShadowGeometry } from "../src/world/broadleaf-shadow-geometry";
import { installBroadleafVolumes } from "../src/world/broadleaf-volume";
import { profileRender } from "../src/rendering/render-profile";

function fixture() {
  const crown = new T.InstancedMesh<T.BufferGeometry>(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
    2,
  );
  const trunk = new T.InstancedMesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
    2,
  );
  const material = new T.MeshStandardMaterial({
    name: "Vancouver broadleaf — layered source canopy",
    map: new T.Texture(),
    alphaTest: 0.18,
    alphaToCoverage: true,
    side: T.DoubleSide,
  });
  const depth = new T.MeshDepthMaterial({
    map: material.map,
    alphaTest: 0.18,
    side: T.DoubleSide,
  });
  const wood = new T.BoxGeometry(0.1, 1, 0.1);
  wood.translate(0, 0.5, 0);
  wood.computeBoundingSphere();
  installBroadleafVolumes(
    [0, 1].map((i) => ({
      x: i * 12,
      y: 2,
      z: 0,
      height: 12,
      width: 7,
      diameter: 0.3,
      rotation: 0.2,
      crown,
      crownIndex: i,
      crownMatrix: new T.Matrix4(),
      trunk,
      trunkIndex: i,
      trunkMatrix: new T.Matrix4(),
    })),
    {
      material,
      depth,
      branches: {
        geometry: wood,
        distantGeometry: wood,
        materials: [new T.MeshStandardMaterial()],
        depth,
      },
    },
  );
  crown.castShadow = trunk.castShadow = true;
  const scene = new T.Scene();
  scene.add(crown, trunk);
  const camera = new T.PerspectiveCamera(),
    probe = new T.PerspectiveCamera();
  const renderer = {
    shadowMap: { render: (() => {}) as T.WebGLRenderer["shadowMap"]["render"] },
    info: { render: { calls: 0, triangles: 0, lines: 0, points: 0 } },
    extensions: { has: () => false },
  } as unknown as T.WebGLRenderer;
  return {
    crown,
    trunk,
    scene,
    camera,
    probe,
    renderer,
    policy: new BroadleafShadowGeometry(),
    near: crown.geometry,
    far: crown.userData.branchFarGeometry as T.BufferGeometry,
  };
}
const preserved = (m: T.InstancedMesh) => [
  m.material,
  m.customDepthMaterial,
  m.customDistanceMaterial,
  m.onBeforeShadow,
  m.onAfterShadow,
  m.onBeforeRender,
  m.onAfterRender,
  m.instanceMatrix,
  m.instanceColor,
  m.boundingBox,
  m.boundingSphere,
  m.visible,
  m.castShadow,
  ...m.matrixWorld.elements,
  ...m.instanceMatrix.array,
];

test("installed crowns select complete 44-triangle source geometry for shadows only, preserving all material/stem/instance semantics", () => {
  const f = fixture(),
    before = preserved(f.crown),
    wood = f.trunk.geometry;
  assert.equal(f.near.index!.count / 3, 806);
  assert.equal(f.far.index!.count / 3, 44);
  for (const edge of ["min", "max"] as const)
    assert.ok(
      f.near.boundingBox![edge].distanceTo(f.far.boundingBox![edge]) < 2e-7,
    );
  f.renderer.shadowMap.render = () => {
    assert.equal(f.crown.geometry, f.far);
    assert.equal(f.trunk.geometry, wood);
    assert.equal(
      f.crown.geometry.getAttribute("treeStemScale"),
      f.near.getAttribute("treeStemScale"),
    );
    assert.deepEqual(preserved(f.crown), before);
  };
  const native = f.renderer.shadowMap.render;
  f.policy.render(f.renderer, f.camera, f.scene, true, () => {
    assert.equal(f.crown.geometry, f.near);
    f.renderer.shadowMap.render([new T.DirectionalLight()], f.scene, f.camera);
    assert.equal(f.crown.geometry, f.near);
  });
  assert.equal(f.renderer.shadowMap.render, native);
  assert.deepEqual(preserved(f.crown), before);
  assert.deepEqual(f.policy.state, {
    enabled: true,
    eligibleMeshes: 1,
    changedMeshes: 1,
    submittedInstanceCapacity: 2,
    sourceTriangleCapacity: 1612,
    compactTriangleCapacity: 88,
    shadowMapInvocations: 1,
  });
});

test("disabled path and far beauty levels remain exact; unknown, noncasting, hidden and detached representations are untouched", () => {
  const f = fixture();
  f.renderer.shadowMap.render = () => assert.equal(f.crown.geometry, f.near);
  const native = f.renderer.shadowMap.render;
  f.policy.render(f.renderer, f.camera, f.scene, false, () => {
    assert.equal(f.renderer.shadowMap.render, native);
    f.renderer.shadowMap.render([], f.scene, f.camera);
  });
  assert.equal(f.policy.state.enabled, false);
  for (const mutate of [
    () => {
      f.crown.castShadow = false;
    },
    () => {
      f.crown.visible = false;
    },
    () => {
      f.scene.remove(f.crown);
    },
    () => {
      f.crown.geometry = new T.BoxGeometry();
    },
    () => {
      f.far.setAttribute(
        "treeStemScale",
        new T.InstancedBufferAttribute(new Float32Array(2), 1),
      );
    },
  ]) {
    // Exercise exclusions separately on the fixture closed over by mutate.
    mutate();
    const current = f.crown.geometry;
    f.renderer.shadowMap.render = () => assert.equal(f.crown.geometry, current);
    f.policy.render(f.renderer, f.camera, f.scene, true, () =>
      f.renderer.shadowMap.render([], f.scene, f.camera),
    );
    assert.equal(f.policy.state.eligibleMeshes, 0);
    f.crown.castShadow = true;
    f.crown.visible = true;
    f.scene.add(f.crown);
    f.crown.geometry = f.near;
    f.far.setAttribute("treeStemScale", f.near.getAttribute("treeStemScale"));
  }
  f.crown.geometry = f.far;
  f.renderer.shadowMap.render = () => assert.equal(f.crown.geometry, f.far);
  f.policy.render(f.renderer, f.camera, f.scene, true, () =>
    f.renderer.shadowMap.render([], f.scene, f.camera),
  );
  assert.equal(f.policy.state.changedMeshes, 0);
  assert.equal(f.policy.state.sourceTriangleCapacity, 88);
  assert.equal(f.crown.geometry, f.far);
});

test("nested camera and disabled probe scopes restore beauty even when entered from a compact shadow; only outer successful state commits", () => {
  const f = fixture();
  let nested = false;
  f.renderer.shadowMap.render = (_lights, _scene, view) => {
    if (view === f.probe) {
      assert.equal(f.crown.geometry, f.near);
      return;
    }
    assert.equal(f.crown.geometry, f.far);
    if (nested) return;
    nested = true;
    f.renderer.shadowMap.render([], f.scene, f.probe);
    assert.equal(f.crown.geometry, f.far);
    f.policy.render(f.renderer, f.probe, f.scene, false, () => {
      assert.equal(f.crown.geometry, f.near, "probe beauty before shadow");
      f.renderer.shadowMap.render([], f.scene, f.probe);
      assert.equal(f.crown.geometry, f.near, "probe beauty after shadow");
    });
    assert.equal(f.crown.geometry, f.far);
    new BroadleafShadowGeometry().render(
      f.renderer,
      f.camera,
      f.scene,
      true,
      () => {
        assert.equal(f.crown.geometry, f.near);
        f.renderer.shadowMap.render([], f.scene, f.camera);
      },
    );
    assert.equal(f.crown.geometry, f.far);
  };
  f.policy.render(f.renderer, f.camera, f.scene, true, () =>
    f.renderer.shadowMap.render([], f.scene, f.camera),
  );
  assert.equal(f.crown.geometry, f.near);
  assert.equal(f.policy.state.shadowMapInvocations, 1);
});

test("thrown native shadows and nested beauty draws restore bindings/hooks; failed scopes do not publish statistics", () => {
  const f = fixture();
  const prior = f.policy.state;
  f.renderer.shadowMap.render = () => {
    assert.equal(f.crown.geometry, f.far);
    assert.throws(
      () =>
        f.policy.render(f.renderer, f.probe, f.scene, false, () => {
          throw Error("probe");
        }),
      /probe/,
    );
    assert.equal(f.crown.geometry, f.far);
    throw Error("shadow");
  };
  const native = f.renderer.shadowMap.render;
  assert.throws(
    () =>
      f.policy.render(f.renderer, f.camera, f.scene, true, () =>
        f.renderer.shadowMap.render([], f.scene, f.camera),
      ),
    /shadow/,
  );
  assert.equal(f.crown.geometry, f.near);
  assert.equal(f.renderer.shadowMap.render, native);
  assert.deepEqual(f.policy.state, prior);
  f.renderer.shadowMap.render = () => {};
  assert.throws(
    () =>
      f.policy.render(f.renderer, f.camera, f.scene, true, () => {
        throw Error("beauty");
      }),
    /beauty/,
  );
  assert.equal(f.crown.geometry, f.near);
  assert.deepEqual(f.policy.state, prior);
});

test("render-profile hooks observe compact shadow and unchanged beauty submissions, not candidate capacities", () => {
  const f = fixture();
  const m = f.crown.material as T.Material;
  const simulateDraw = (shadow: boolean) => {
    const g = f.crown.geometry;
    if (shadow)
      f.crown.onBeforeShadow(
        f.renderer,
        f.scene,
        f.camera,
        f.camera,
        g,
        f.crown.customDepthMaterial!,
        null as never,
      );
    else
      f.crown.onBeforeRender(
        f.renderer,
        f.scene,
        f.camera,
        g,
        m,
        null as never,
      );
    f.renderer.info.render.calls++;
    f.renderer.info.render.triangles += (g.index!.count / 3) * f.crown.count;
    if (shadow)
      f.crown.onAfterShadow(
        f.renderer,
        f.scene,
        f.camera,
        f.camera,
        g,
        f.crown.customDepthMaterial!,
        null as never,
      );
    else
      f.crown.onAfterRender(f.renderer, f.scene, f.camera, g, m, null as never);
  };
  f.renderer.shadowMap.render = () => simulateDraw(true);
  const p = profileRender(f.renderer, f.scene, f.camera, () =>
    f.policy.render(f.renderer, f.camera, f.scene, true, () => {
      f.renderer.shadowMap.render(
        [new T.DirectionalLight()],
        f.scene,
        f.camera,
      );
      simulateDraw(false);
    }),
  );
  assert.equal(p.totals.shadow.triangles, 88);
  assert.equal(p.totals.beauty.triangles, 1612);
  assert.equal(p.totals.shadow.calls, 1);
  assert.equal(p.totals.beauty.calls, 1);
  assert.equal(f.crown.geometry, f.near);
});

test("target discovery is reused, explicitly refreshable and checks live attachment/visibility each frame", () => {
  const f = fixture();
  let scans = 0;
  const traverse = f.scene.traverse;
  f.scene.traverse = function (callback) {
    scans++;
    return traverse.call(this, callback);
  };
  const draw = () => f.renderer.shadowMap.render([], f.scene, f.camera);
  f.policy.render(f.renderer, f.camera, f.scene, true, draw);
  f.policy.render(f.renderer, f.camera, f.scene, true, draw);
  assert.equal(scans, 1);
  f.scene.visible = false;
  f.policy.render(f.renderer, f.camera, f.scene, true, draw);
  assert.equal(f.policy.state.eligibleMeshes, 0);
  f.scene.visible = true;
  const added = fixture().crown;
  f.scene.add(added);
  f.policy.invalidateTargets(f.scene);
  f.policy.render(f.renderer, f.camera, f.scene, true, draw);
  assert.equal(scans, 2);
  assert.equal(f.policy.state.eligibleMeshes, 2);
  f.scene.remove(added);
  f.policy.render(f.renderer, f.camera, f.scene, true, draw);
  assert.equal(f.policy.state.eligibleMeshes, 1);
  f.policy.render(f.renderer, f.camera, f.scene, true, () => {});
  assert.equal(
    f.policy.state.shadowMapInvocations,
    0,
    "cache hit is not an actual shadow render",
  );
  const state = f.policy.state as { eligibleMeshes: number };
  state.eligibleMeshes = 999;
  assert.equal(
    f.policy.state.eligibleMeshes,
    1,
    "external profile consumers cannot mutate policy counters",
  );
});
