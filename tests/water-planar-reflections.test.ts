import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  WaterPlanarReflections,
  WATER_PLANAR,
  waterPlanarFragment,
} from "../src/world/water-planar-reflections";
import { WaterWavesComparison } from "../src/world/water-waves";
import { WaterOpticsComparison } from "../src/world/water-optics";
const original = fs
  .readFileSync("src/world/world.ts", "utf8")
  .split("this.water = new T.ShaderMaterial")[1]
  .match(/fragmentShader: `([^`]+)`/)![1]
  .replaceAll("\\n", "\n");
function compile(m: T.ShaderMaterial) {
  const s = {
    fragmentShader: m.fragmentShader,
    vertexShader: "",
    uniforms: { ...m.uniforms },
  } as unknown as Parameters<T.Material["onBeforeCompile"]>[0];
  m.onBeforeCompile(s, {} as T.WebGLRenderer);
  return s;
}
function fixture(fail = false) {
  const scene = new T.Scene(),
    root = new T.Group(),
    sun = new T.DirectionalLight();
  const water = new T.ShaderMaterial({ fragmentShader: original });
  const wet = new T.Mesh(new T.PlaneGeometry(), water),
    hiddenWet = wet.clone();
  hiddenWet.visible = false;
  const actor = new T.Group(),
    hiddenActor = new T.Group();
  hiddenActor.visible = false;
  const near = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()),
    culled = near.clone();
  culled.visible = false;
  const map = new T.DataTexture(new Uint8Array(16), 2, 2);
  const photo = new T.Mesh(
    new T.PlaneGeometry(),
    new T.MeshBasicMaterial({ map }),
  );
  photo.userData.photoRidgeRefinement = true;
  root.add(wet, hiddenWet, near, culled, photo);
  scene.add(root, sun, sun.target, actor, hiddenActor, new T.HemisphereLight());
  scene.background = map;
  scene.environment = map;
  const camera = new T.PerspectiveCamera(62, 1.7, 0.1, 24000);
  camera.position.set(686.698, 10.51, -697.34);
  camera.lookAt(700, 0.065, -1000);
  camera.updateMatrixWorld(true);
  const oldTarget = new T.WebGLRenderTarget(16, 16);
  oldTarget.viewport.set(8, 9, 16, 16);
  const state = {
    target: oldTarget as T.WebGLRenderTarget | null,
    face: 3,
    mip: 2,
    viewport: new T.Vector4(2, 3, 800, 600),
    currentViewport: oldTarget.viewport.clone(),
    scissor: new T.Vector4(1, 2, 600, 400),
    actualScissor: new T.Vector4(2, 4, 12, 11),
    scissorTest: true,
    actualScissorTest: false,
    depthMask: false,
    draws: 0,
  };
  let virtual: T.PerspectiveCamera | undefined;
  const renderer = {
    xr: { enabled: true },
    shadowMap: { autoUpdate: true, needsUpdate: true },
    autoClear: false,
    autoClearColor: false,
    autoClearDepth: false,
    autoClearStencil: false,
    info: {
      autoReset: true,
      render: { calls: 300, triangles: 10000, frame: 8 },
    },
    toneMapping: T.ACESFilmicToneMapping,
    getContext: () => ({
      SCISSOR_BOX: 1,
      SCISSOR_TEST: 2,
      DEPTH_WRITEMASK: 3,
      getParameter: (key: number) =>
        key === 1
          ? state.actualScissor.toArray()
          : key === 2
            ? state.actualScissorTest
            : state.depthMask,
    }),
    getRenderTarget: () => state.target,
    getActiveCubeFace: () => state.face,
    getActiveMipmapLevel: () => state.mip,
    getViewport: (v: T.Vector4) => v.copy(state.viewport),
    getCurrentViewport: (v: T.Vector4) => v.copy(state.currentViewport),
    getScissor: (v: T.Vector4) => v.copy(state.scissor),
    getScissorTest: () => state.scissorTest,
    setViewport: (v: T.Vector4) => {
      state.viewport.copy(v);
      state.currentViewport.copy(v);
    },
    setScissor: (v: T.Vector4) => {
      state.scissor.copy(v);
      state.actualScissor.copy(v);
    },
    setScissorTest: (v: boolean) => {
      state.scissorTest = v;
      state.actualScissorTest = v;
    },
    setRenderTarget: (
      target: T.WebGLRenderTarget | null,
      face = 0,
      mip = 0,
    ) => {
      state.target = target;
      state.face = face;
      state.mip = mip;
      if (target) state.currentViewport.copy(target.viewport);
    },
    state: {
      viewport: (v: T.Vector4) => state.currentViewport.copy(v),
      scissor: (v: T.Vector4) => state.actualScissor.copy(v),
      setScissorTest: (v: boolean) => (state.actualScissorTest = v),
      buffers: { depth: { setMask: (v: boolean) => (state.depthMask = v) } },
    },
    clear: () => {},
    render: (_s: T.Scene, c: T.PerspectiveCamera) => {
      state.draws++;
      renderer.info.render.frame++;
      if (renderer.info.autoReset) {
        renderer.info.render.calls = 0;
        renderer.info.render.triangles = 0;
      }
      renderer.info.render.calls += 12;
      renderer.info.render.triangles += 360;
      virtual = c;
      assert.equal(wet.visible, false);
      assert.equal(hiddenWet.visible, false);
      assert.equal(actor.visible, false);
      assert.equal(hiddenActor.visible, false);
      assert.equal(near.visible, true);
      assert.equal(culled.visible, false);
      assert.equal(photo.visible, true);
      assert.equal(renderer.toneMapping, T.NoToneMapping);
      assert.equal(renderer.shadowMap.needsUpdate, false);
      assert.equal(renderer.shadowMap.autoUpdate, false);
      assert.equal(scene.background, map);
      assert.equal(scene.environment, map);
      if (fail) {
        renderer.shadowMap.needsUpdate = true;
        sun.shadow.needsUpdate = true;
        throw Error("driver failure after Reflector changed state");
      }
    },
  } as unknown as T.WebGLRenderer;
  const context = { scene, root, sun, water };
  return {
    context,
    camera,
    renderer,
    state,
    oldTarget,
    wet,
    hiddenWet,
    actor,
    hiddenActor,
    near,
    culled,
    photo,
    virtual: () => virtual!,
  };
}
function capture(f: ReturnType<typeof fixture>, p: WaterPlanarReflections) {
  p.update(f.renderer, f.camera);
  p.update(f.renderer, f.camera);
}

test("installed Reflector reflects actual gameplay camera at ocean level and oblique plane rejects submerged scene", () => {
  const f = fixture(),
    p = new WaterPlanarReflections(f.context);
  capture(f, p);
  const c = f.virtual();
  assert.ok(
    Math.abs(c.position.y - (2 * WATER_PLANAR.level - f.camera.position.y)) <
      1e-10,
  );
  assert.ok(Math.abs(c.position.x - f.camera.position.x) < 1e-10);
  assert.ok(Math.abs(c.position.z - f.camera.position.z) < 1e-10);
  const view = f.camera.getWorldDirection(new T.Vector3()),
    reflected = c.getWorldDirection(new T.Vector3());
  assert.ok(
    view
      .clone()
      .reflect(new T.Vector3(0, 1, 0))
      .distanceTo(reflected) < 1e-12,
  );
  for (const x of [660, 686, 720])
    for (const z of [-800, -1300, -7000]) {
      for (const [y, sign] of [
        [1, 1],
        [-1, -1],
      ]) {
        const clip = new T.Vector4(x, y, z, 1)
          .applyMatrix4(c.matrixWorldInverse)
          .applyMatrix4(c.projectionMatrix);
        assert.ok(
          (clip.z + clip.w) * sign > 0,
          `clip half-space ${x},${y},${z}`,
        );
      }
    }
  assert.equal(c.far, 24000);
  assert.equal(f.camera.position.y, 10.51);
  assert.equal(p.reflector.parent, null);
  assert.equal(f.context.root.children.length, 5);
  p.dispose();
});

test("world projective coordinates match current-camera ocean pixels without applying plane model transform twice", () => {
  const f = fixture(),
    p = new WaterPlanarReflections(f.context);
  capture(f, p);
  const shader = compile(f.context.water),
    matrix = shader.uniforms.waterPlanarWorldProjection.value as T.Matrix4;
  for (const x of [650, 686, 730])
    for (const z of [-800, -1100, -7000]) {
      const world = new T.Vector4(x, WATER_PLANAR.level, z, 1);
      const projected = world.clone().applyMatrix4(matrix);
      const game = world
        .clone()
        .applyMatrix4(f.camera.matrixWorldInverse)
        .applyMatrix4(f.camera.projectionMatrix);
      // The reflected camera reverses handedness horizontally; its texture
      // projection already includes that reversal. No extra UV flip belongs here.
      assert.ok(
        Math.abs(projected.x / projected.w - (0.5 - (game.x / game.w) * 0.5)) <
          1e-10,
      );
      assert.ok(
        Math.abs(projected.y / projected.w - ((game.y / game.w) * 0.5 + 0.5)) <
          1e-10,
      );
    }
  assert.ok(!waterPlanarFragment(original).includes("260.0"));
  assert.match(shader.fragmentShader, /abs\(vWorld.y-0.065\)<0.001/);
  assert.equal(
    p.reflector.getRenderTarget().texture.colorSpace,
    T.LinearSRGBColorSpace,
  );
  p.dispose();
});

test("success and renderer failure restore target face/mip, viewport/scissor, depth, shadows, XR and all visibility", () => {
  for (const fail of [false, true]) {
    const f = fixture(fail),
      p = new WaterPlanarReflections(f.context);
    const initial = JSON.stringify({ ...f.state, target: null, draws: 0 });
    capture(f, p);
    assert.equal(f.state.target, f.oldTarget);
    assert.equal(
      JSON.stringify({ ...f.state, target: null, draws: 0 }),
      initial,
    );
    assert.equal(f.renderer.xr.enabled, true);
    assert.equal(f.renderer.autoClear, false);
    assert.equal(f.renderer.autoClearColor, false);
    assert.equal(f.renderer.autoClearDepth, false);
    assert.equal(f.renderer.autoClearStencil, false);
    assert.equal(f.renderer.toneMapping, T.ACESFilmicToneMapping);
    assert.equal(f.renderer.shadowMap.autoUpdate, true);
    assert.equal(f.renderer.shadowMap.needsUpdate, true);
    assert.equal(f.context.sun.shadow.needsUpdate, false);
    assert.equal(f.wet.visible, true);
    assert.equal(f.hiddenWet.visible, false);
    assert.equal(f.actor.visible, true);
    assert.equal(f.hiddenActor.visible, false);
    assert.equal(f.culled.visible, false);
    assert.equal(p.reflector.visible, false);
    assert.equal(p.diagnostics().status, fail ? "error" : "ready");
    if (fail) {
      assert.equal(
        compile(f.context.water).uniforms.waterPlanarMap.value,
        null,
      );
      p.update(f.renderer, f.camera);
      assert.equal(f.state.draws, 1);
    }
    p.dispose();
  }
});

test("idle reuses capture; meaningful translation, rotation, projection or invalidation refresh; day and local viewer gate remain", () => {
  const f = fixture(),
    p = new WaterPlanarReflections(f.context);
  capture(f, p);
  for (let i = 0; i < 100; i++) p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 1);
  f.camera.position.x += 0.1;
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 2);
  f.camera.rotateY(0.01);
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 3);
  f.camera.aspect = 2;
  f.camera.updateProjectionMatrix();
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 4);
  p.invalidate("day");
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 5);
  p.invalidate("night");
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 5);
  assert.equal(p.diagnostics().active, false);
  p.invalidate("day");
  f.camera.position.x += 300;
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 5);
  assert.equal(p.diagnostics().active, false);
  f.camera.position.x -= 300;
  f.camera.position.y = 0;
  p.update(f.renderer, f.camera);
  assert.equal(f.state.draws, 5);
  p.dispose();
});

test("pending photo and scheduling defer work, nested feedback hides restore, owned target/geometry dispose exactly once", () => {
  const f = fixture();
  (f.photo.material as T.MeshBasicMaterial).map!.image = null;
  const p = new WaterPlanarReflections(f.context);
  capture(f, p);
  assert.equal(f.state.draws, 0);
  assert.equal(p.diagnostics().status, "waiting for photo");
  (f.photo.material as T.MeshBasicMaterial).map!.image = {
    width: 2,
    height: 2,
  };
  p.update(f.renderer, f.camera, false);
  assert.equal(f.state.draws, 0);
  capture(f, p);
  assert.equal(f.state.draws, 1);
  p.withoutWater(() => {
    assert.equal(f.wet.visible, false);
    p.withoutWater(() => assert.equal(f.wet.visible, false));
    assert.equal(f.wet.visible, false);
  });
  assert.equal(f.wet.visible, true);
  const target = p.reflector.getRenderTarget();
  assert.equal(target.width, 512);
  assert.equal(target.height, 512);
  assert.equal(target.samples, 0);
  assert.equal(target.texture.type, T.HalfFloatType);
  assert.equal(target.texture.generateMipmaps, false);
  let targets = 0,
    geometry = 0;
  target.addEventListener("dispose", () => targets++);
  p.reflector.geometry.addEventListener("dispose", () => geometry++);
  f.context.water.dispose();
  p.dispose();
  assert.equal(targets, 1);
  assert.equal(geometry, 1);
  assert.equal(p.diagnostics().retainedTextureBytes, 0);
  assert.equal(p.diagnostics().depthBudgetBytes, 0);
});

const permutations = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
test("all HDR/wave/planar enable-disable orders restore original hooks and never retain disposed planar uniforms", () => {
  for (const enable of permutations)
    for (const disable of permutations) {
      const f = fixture(),
        m = f.context.water,
        hook = m.onBeforeCompile,
        key = m.customProgramCacheKey;
      const entries: Array<{ dispose: () => void }> = [];
      for (const i of enable) {
        if (i === 0) {
          const texture = new T.DataTexture(
            new Float32Array(512 * 256 * 4).fill(1),
            512,
            256,
            T.RGBAFormat,
            T.FloatType,
          );
          entries[i] = new WaterOpticsComparison(
            m,
            texture,
            f.renderer,
            () => ({
              fromEquirectangular: () => {
                const target = new T.WebGLRenderTarget(384, 512, {
                  type: T.HalfFloatType,
                });
                target.texture.mapping = T.CubeUVReflectionMapping;
                return target;
              },
              dispose: () => {},
            }),
          );
        }
        if (i === 1) entries[i] = new WaterWavesComparison(m);
        if (i === 2) entries[i] = new WaterPlanarReflections(f.context);
      }
      assert.match(compile(m).fragmentShader, /waterPlanarMap/);
      for (const i of disable) {
        entries[i].dispose();
        if (i === 2)
          assert.ok(!compile(m).fragmentShader.includes("waterPlanarMap"));
      }
      assert.equal(m.onBeforeCompile, hook);
      assert.equal(m.customProgramCacheKey, key);
      assert.equal(m.fragmentShader, original);
    }
});

test("capture counters survive the following main render reset and respect renderer info accumulation", () => {
  for (const autoReset of [true, false]) {
    const f = fixture(),
      p = new WaterPlanarReflections(f.context);
    f.renderer.info.autoReset = autoReset;
    capture(f, p);
    assert.equal(p.diagnostics().captureDrawCalls, 12);
    assert.equal(p.diagnostics().captureTriangles, 360);
    f.renderer.info.render.calls = 999;
    f.renderer.info.render.triangles = 12345;
    assert.equal(p.diagnostics().captureDrawCalls, 12);
    f.camera.position.x += 0.2;
    p.update(f.renderer, f.camera);
    assert.equal(p.diagnostics().totalCaptureDrawCalls, 24);
    assert.equal(p.diagnostics().totalCaptureTriangles, 720);
    p.dispose();
  }
});

test("failed target bind reports no inherited main-frame draw cost and camera far is extended without mutating gameplay projection", () => {
  const f = fixture(),
    p = new WaterPlanarReflections(f.context);
  f.camera.far = 900;
  f.camera.updateProjectionMatrix();
  const projection = f.camera.projectionMatrix.clone();
  capture(f, p);
  assert.equal(f.virtual().far, 15000);
  assert.equal(f.camera.far, 900);
  assert.deepEqual(f.camera.projectionMatrix, projection);
  p.invalidate("day");
  const originalSet = f.renderer.setRenderTarget;
  f.renderer.setRenderTarget = (...args) => {
    if (args[0] === p.reflector.getRenderTarget())
      throw Error("target allocation failed");
    originalSet(...args);
  };
  p.update(f.renderer, f.camera);
  assert.equal(p.diagnostics().status, "error");
  assert.equal(p.diagnostics().captureDrawCalls, 0);
  assert.equal(p.diagnostics().captureTriangles, 0);
  assert.equal(f.state.target, f.oldTarget);
  p.dispose();
});

test("lighting invalidation never re-exposes a stale reflection while capture is deferred", () => {
  const f = fixture(),
    p = new WaterPlanarReflections(f.context);
  capture(f, p);
  const shader = compile(f.context.water);
  assert.equal(shader.uniforms.waterPlanarWeight.value, 1);
  assert.equal(f.state.draws, 1);
  f.context.sun.intensity *= 0.5;
  p.invalidate("day");
  for (let frame = 0; frame < 4; frame++) {
    p.update(f.renderer, f.camera, false);
    assert.equal(shader.uniforms.waterPlanarWeight.value, 0);
    assert.equal(p.diagnostics().active, false);
    assert.equal(f.state.draws, 1);
  }
  p.update(f.renderer, f.camera, true);
  assert.equal(f.state.draws, 2);
  assert.equal(shader.uniforms.waterPlanarWeight.value, 1);
  // Ordinary sub-threshold motion has not invalidated the lighting capture.
  f.camera.position.x += WATER_PLANAR.positionThreshold / 2;
  p.update(f.renderer, f.camera, false);
  assert.equal(shader.uniforms.waterPlanarWeight.value, 1);
  p.update(f.renderer, f.camera, true);
  assert.equal(f.state.draws, 2);
  p.dispose();
});
