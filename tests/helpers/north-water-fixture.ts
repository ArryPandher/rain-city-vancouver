import fs from "node:fs";
import assert from "node:assert/strict";
import * as T from "three";
import { WaterPlanarReflections } from "../../src/world/water-planar-reflections";
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

export { original, compile, fixture, capture };
