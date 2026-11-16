import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  WaterSceneReflections,
  WATER_SCENE,
  waterSceneViewerWeight,
  waterSceneFragment,
} from "../src/world/water-scene-reflections";
import { WaterWavesComparison } from "../src/world/water-waves";
import { WaterOpticsComparison } from "../src/world/water-optics";
import { createNorthShorePhotoHorizon } from "../src/world/north-shore-photo-horizon";
import { CANADA_PLACE_PIER } from "../src/world/canada-place-deck";
import { pointInPoly } from "../src/world/data";
const original = fs
  .readFileSync("src/world/world.ts", "utf8")
  .split("this.water = new T.ShaderMaterial")[1]
  .match(/fragmentShader: `([^`]+)`/)![1]
  .replaceAll("\\n", "\n");
const compile = (m: T.ShaderMaterial) => {
  const shader = {
    fragmentShader: m.fragmentShader,
    uniforms: { ...m.uniforms },
    vertexShader: "",
  } as unknown as Parameters<T.Material["onBeforeCompile"]>[0];
  m.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader;
};
function fixture(fail = false) {
  const scene = new T.Scene(),
    root = new T.Group(),
    sun = new T.DirectionalLight();
  sun.position.set(100, 300, 200);
  sun.target.position.set(20, 0, 20);
  const water = new T.ShaderMaterial({ fragmentShader: original }),
    waterMesh = new T.Mesh(new T.PlaneGeometry(), water);
  const hiddenWater = new T.Mesh(new T.PlaneGeometry(), water);
  hiddenWater.visible = false;
  const photo = createNorthShorePhotoHorizon(
    new T.DataTexture(new Uint8Array(16), 2, 2),
  );
  const actor = new T.Group();
  actor.name = "moving actor";
  const near = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  near.position.set(730, 10, -750);
  near.userData.center = [730, -750];
  near.castShadow = true;
  near.visible = false;
  root.add(waterMesh, hiddenWater, photo, near);
  scene.add(root, sun, sun.target, actor, new T.HemisphereLight());
  const sky = new T.DataTexture(
    new Float32Array(512 * 256 * 4).fill(1),
    512,
    256,
    T.RGBAFormat,
    T.FloatType,
  );
  sky.flipY = true;
  scene.background = sky;
  scene.environment = sky;
  const oldTarget = new T.WebGLRenderTarget(8, 8),
    state = {
      target: oldTarget as T.WebGLRenderTarget | null,
      face: 3,
      mip: 2,
      draws: 0,
    };
  const renderer = {
    coordinateSystem: T.WebGLCoordinateSystem,
    shadowMap: { autoUpdate: true, needsUpdate: false },
    xr: { enabled: true },
    autoClear: false,
    toneMapping: T.ACESFilmicToneMapping as T.ToneMapping,
    getRenderTarget: () => state.target,
    getActiveCubeFace: () => state.face,
    getActiveMipmapLevel: () => state.mip,
    setRenderTarget(target: T.WebGLRenderTarget | null, face = 0, mip = 0) {
      state.target = target;
      state.face = face;
      state.mip = mip;
    },
    render(_scene: T.Scene, camera: T.PerspectiveCamera) {
      state.draws++;
      assert.equal(waterMesh.visible, false);
      assert.equal(hiddenWater.visible, false);
      assert.equal(actor.visible, false);
      assert.equal(photo.visible, true);
      assert.equal(camera.far, 15000);
      assert.notEqual(scene.background, sky);
      assert.equal(scene.environment, sky);
      if (fail && state.draws === 3)
        throw new Error("simulated capture failure");
    },
  } as unknown as T.WebGLRenderer;
  const outputs: T.WebGLRenderTarget[] = [];
  const filter = () => {
    const t = new T.WebGLRenderTarget(384, 512, {
      type: T.HalfFloatType,
      depthBuffer: false,
    });
    t.texture.mapping = T.CubeUVReflectionMapping;
    outputs.push(t);
    return t;
  };
  const context = {
    scene,
    root,
    chunks: [near, waterMesh],
    sun,
    water,
    daySky: sky,
  };
  const viewer = new T.Vector3(684.64, 10.51, -693.56);
  return {
    context,
    renderer,
    state,
    outputs,
    filter,
    viewer,
    waterMesh,
    hiddenWater,
    photo,
    actor,
    near,
    oldTarget,
    sky,
  };
}

test("bounded north source placement, far plane and shader direction cover existing horizon rather than distant ship claims", () => {
  assert.equal(
    pointInPoly(
      WATER_SCENE.position[0],
      WATER_SCENE.position[2],
      CANADA_PLACE_PIER,
    ),
    false,
  );
  assert.equal(waterSceneViewerWeight(686.698, -697.34), 1);
  assert.equal(waterSceneViewerWeight(6800, -1500), 0);
  assert.equal(waterSceneViewerWeight(519.31, -498.58), 0);
  assert.ok(
    waterSceneViewerWeight(686.698 + 130, -697.34) > 0 &&
      waterSceneViewerWeight(686.698 + 130, -697.34) < 1,
  );
  const f = fixture(),
    camera = new T.PerspectiveCamera(90, 1, 0.1, 15000);
  camera.position.set(...WATER_SCENE.position);
  camera.lookAt(700, 0.365, -7000);
  camera.updateMatrixWorld();
  f.photo.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(
    frustum.intersectsBox(new T.Box3().setFromObject(f.photo)),
    true,
  );
  camera.far = 900;
  camera.updateProjectionMatrix();
  frustum.setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(
    frustum.intersectsBox(new T.Box3().setFromObject(f.photo)),
    false,
  );
  const shader = waterSceneFragment(original);
  assert.ok(
    shader.includes("waterScene_textureCubeUV(waterSceneMap,sceneRay,.1)"),
  );
  assert.ok(!shader.includes("waterHdrRotation"));
  assert.ok(shader.includes("smoothstep(0.25,0.55,-sceneRay.z)"));
  assert.ok(
    shader.includes("color=mix(color,mix(deep,sceneRadiance,fres*.85)"),
  );
  assert.equal((shader.match(/color\+=sunColor\*spec/g) ?? []).length, 1);
});

for (const fail of [false, true])
  test(`actual six-face capture ${fail ? "failure" : "success"} restores water, actors, background, shadows and renderer, then never retries per frame`, () => {
    const f = fixture(fail),
      c = new WaterSceneReflections(f.context, f.filter),
      sun = f.context.sun.position.clone(),
      target = f.context.sun.target.position.clone();
    const warnings = console.warn;
    console.warn = () => {};
    try {
      c.update(f.renderer, f.viewer);
      assert.equal(f.state.draws, 0, "one frame yields before preparation");
      c.update(f.renderer, f.viewer);
      assert.equal(f.state.draws, fail ? 3 : 6);
      assert.equal(c.diagnostics().status, fail ? "error" : "ready");
      assert.equal(
        c.diagnostics().retainedTextureBytes,
        WATER_SCENE.cubeBytes + (fail ? 0 : WATER_SCENE.pmremBytes),
      );
      assert.equal(f.waterMesh.visible, true);
      assert.equal(f.hiddenWater.visible, false);
      assert.equal(f.actor.visible, true);
      assert.equal(f.near.visible, false);
      assert.equal(f.near.castShadow, true);
      assert.equal(f.context.scene.background, f.sky);
      assert.deepEqual(f.context.sun.position, sun);
      assert.deepEqual(f.context.sun.target.position, target);
      assert.equal(f.state.target, f.oldTarget);
      assert.equal(f.state.face, 3);
      assert.equal(f.state.mip, 2);
      assert.equal(f.renderer.autoClear, false);
      assert.equal(f.renderer.toneMapping, T.ACESFilmicToneMapping);
      assert.equal(f.renderer.xr.enabled, true);
      assert.equal(f.renderer.shadowMap.autoUpdate, true);
      assert.equal(c.captures.probes[0].target.texture.generateMipmaps, true);
      for (let i = 0; i < 60; i++) c.update(f.renderer, f.viewer);
      assert.equal(f.state.draws, fail ? 3 : 6);
      c.update(f.renderer, new T.Vector3(6800, 30, -1500));
      assert.equal(c.diagnostics().active, false);
      c.invalidate("night");
      c.update(f.renderer, f.viewer);
      assert.equal(c.diagnostics().active, false);
      c.invalidate("day");
      c.update(f.renderer, f.viewer);
      assert.equal(f.state.draws, fail ? 9 : 12);
      c.withoutWater(() => assert.equal(f.waterMesh.visible, false));
      assert.equal(f.waterMesh.visible, true);
    } finally {
      console.warn = warnings;
      c.dispose();
    }
    assert.equal(c.diagnostics().retainedTextureBytes, 0);
  });

const permutations = <T>(xs: T[]): T[][] =>
  xs.length
    ? xs.flatMap((x, i) =>
        permutations(xs.filter((_, j) => j !== i)).map((ys) => [x, ...ys]),
      )
    : [[]];
test("all36 HDR/wave/scene toggle-order permutations restore exact callbacks/base shader and dispose only owned targets", () => {
  for (const enable of permutations(["hdr", "wave", "scene"]))
    for (const disable of permutations(["hdr", "wave", "scene"])) {
      const f = fixture(),
        m = f.context.water,
        baseHook = m.onBeforeCompile,
        baseKey = m.customProgramCacheKey;
      const owners: Record<string, { dispose(): void }> = {};
      let scene: WaterSceneReflections | undefined;
      for (const name of enable) {
        if (name === "hdr")
          owners.hdr = new WaterOpticsComparison(m, f.sky, f.renderer, () => ({
            fromEquirectangular: () => f.filter(),
            dispose() {},
          }));
        else if (name === "wave") {
          const w = new WaterWavesComparison(m);
          w.update("day");
          owners.wave = w;
        } else {
          scene = new WaterSceneReflections(f.context, f.filter);
          owners.scene = scene;
          scene.update(f.renderer, f.viewer);
          scene.update(f.renderer, f.viewer);
        }
      }
      let compiled = compile(m);
      assert.ok(compiled.fragmentShader.includes("harbourWaveNormal"));
      assert.ok(compiled.fragmentShader.includes("waterSceneMap"));
      assert.ok(compiled.fragmentShader.includes("waterHdrMap"));
      const remaining = new Set(enable);
      for (const name of disable) {
        owners[name].dispose();
        remaining.delete(name);
        compiled = compile(m);
        assert.equal(
          compiled.fragmentShader.includes("harbourWaveNormal"),
          remaining.has("wave"),
        );
        assert.equal(
          compiled.fragmentShader.includes("waterSceneMap"),
          remaining.has("scene"),
        );
        assert.equal(
          compiled.fragmentShader.includes("waterHdrMap"),
          remaining.has("hdr"),
        );
        if (remaining.has("scene"))
          assert.equal(scene!.diagnostics().status, "ready");
      }
      assert.equal(m.fragmentShader, original);
      assert.equal(m.onBeforeCompile, baseHook);
      assert.equal(m.customProgramCacheKey, baseKey);
      for (const owner of Object.values(owners)) owner.dispose();
      m.dispose();
      f.sky.dispose();
    }
});

test("pending photo does not publish a sky-only cube; material disposal frees cube, derivative and all compile layers", () => {
  const f = fixture(),
    m = f.context.water,
    originalCompile = m.onBeforeCompile,
    originalKey = m.customProgramCacheKey;
  const photoMap = f.photo.material.map!;
  const image = photoMap.image;
  photoMap.image = null;
  const waves = new WaterWavesComparison(m),
    scene = new WaterSceneReflections(f.context, f.filter);
  for (let i = 0; i < 4; i++) scene.update(f.renderer, f.viewer);
  assert.equal(f.state.draws, 0);
  assert.equal(scene.diagnostics().status, "waiting for photo");
  photoMap.image = image;
  scene.update(f.renderer, f.viewer);
  scene.update(f.renderer, f.viewer);
  assert.equal(f.state.draws, 6);
  let cubeDisposals = 0,
    filteredDisposals = 0;
  scene.captures.probes[0].target.addEventListener(
    "dispose",
    () => cubeDisposals++,
  );
  f.outputs[0].addEventListener("dispose", () => filteredDisposals++);
  m.dispose();
  scene.dispose();
  waves.dispose();
  assert.equal(cubeDisposals, 1);
  assert.equal(filteredDisposals, 1);
  assert.equal(m.onBeforeCompile, originalCompile);
  assert.equal(m.customProgramCacheKey, originalKey);
  assert.equal(scene.diagnostics().retainedTextureBytes, 0);
});

test("invalid filtered target is disposed and cannot bind a partial scene result or retry continuously", () => {
  const f = fixture();
  const bad = new T.WebGLRenderTarget(8, 8, { type: T.HalfFloatType });
  let releases = 0;
  bad.addEventListener("dispose", () => releases++);
  const c = new WaterSceneReflections(f.context, () => bad);
  c.update(f.renderer, f.viewer);
  c.update(f.renderer, f.viewer);
  assert.equal(c.diagnostics().status, "error");
  assert.equal(c.diagnostics().active, false);
  assert.equal(releases, 1);
  assert.equal(compile(f.context.water).uniforms.waterSceneMap.value, null);
  for (let i = 0; i < 20; i++) c.update(f.renderer, f.viewer);
  assert.equal(f.state.draws, 6);
  assert.equal(f.context.scene.background, f.sky);
  c.dispose();
  assert.equal(releases, 1);
});
