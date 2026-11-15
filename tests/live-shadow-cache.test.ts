import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { WebGLShadowMap } from "three/src/renderers/webgl/WebGLShadowMap.js";
import {
  LiveShadowCache,
  staticShadowCaster,
  staticShadowState,
} from "../src/rendering/live-shadow-cache";

/** Real Three shadow traversal/clear/depth callbacks, with a four-texel CPU
 * framebuffer replacing rasterization. This proves ordering/union semantics;
 * native depth blits, driver behaviour and visible parity still need A/B. */
function fixture() {
  const scene = new T.Scene(),
    root = new T.Group(),
    camera = new T.PerspectiveCamera(),
    sun = new T.DirectionalLight(),
    cache = new LiveShadowCache();
  scene.add(root, sun, sun.target);
  sun.position.set(10, 20, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4, 1);
  sun.shadow.map = new T.WebGLRenderTarget(4, 1, {
    depthTexture: new T.DepthTexture(4, 1, T.UnsignedIntType),
  });
  const nativeTarget = sun.shadow.map;
  const depths = new Map<T.Texture, number[]>();
  depths.set(nativeTarget.depthTexture!, [1, 1, 1, 1]);
  const add = (parent: T.Object3D, values: number[]) => {
    const geometry = new T.PlaneGeometry();
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
    mesh.userData.depth = values;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  };
  const fixed = add(root, [0.2, 1, 0.7, 1]),
    dynamic = add(scene, [0.8, 0.3, 1, 0.6]);
  let current: T.WebGLRenderTarget | null = null,
    allocations = 0,
    disposals = 0,
    throwOnce = false,
    glError = 0;
  const calls: string[] = [];
  const renderer = {
    capabilities: { reversedDepthBuffer: false },
    localClippingEnabled: false,
    state: {
      setBlending() {},
      setScissorTest() {},
      viewport() {},
      buffers: {
        depth: { getReversed: () => false, setTest() {} },
        color: { setClear() {} },
      },
    },
    info: { render: { calls: 0, triangles: 0 } },
    getRenderTarget: () => current,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (target: T.WebGLRenderTarget | null) => {
      current = target;
    },
    clear() {
      calls.push("clear");
      depths.set(current!.depthTexture!, [1, 1, 1, 1]);
    },
    initRenderTarget(target: T.WebGLRenderTarget) {
      allocations++;
      depths.set(target.depthTexture!, [1, 1, 1, 1]);
      target.addEventListener("dispose", () => {
        disposals++;
        depths.delete(target.depthTexture!);
      });
    },
    getContext: () => ({ NO_ERROR: 0, getError: () => glError }),
    copyTextureToTexture(a: T.DepthTexture, b: T.DepthTexture) {
      calls.push(
        a === nativeTarget.depthTexture ? "save-static" : "restore-static",
      );
      depths.set(b, depths.get(a)!.slice());
    },
    renderBufferDirect(
      _camera: T.Camera,
      _scene: unknown,
      geometry: T.BufferGeometry,
      _material: T.Material,
      object: T.Mesh,
    ) {
      if (throwOnce && object === dynamic) {
        throwOnce = false;
        throw new Error("dynamic draw failed");
      }
      calls.push(object === fixed ? "static" : "dynamic");
      const data = depths.get(current!.depthTexture!)!;
      (object.userData.depth as number[]).forEach((d, i) => {
        data[i] = Math.min(data[i], d);
      });
      renderer.info.render.calls++;
      renderer.info.render.triangles += geometry.index!.count / 3;
    },
  } as unknown as T.WebGLRenderer;
  renderer.shadowMap = new WebGLShadowMap(
    renderer,
    { update: (object: T.Mesh) => object.geometry } as never,
    { maxTextureSize: 4096 } as never,
  );
  renderer.shadowMap.enabled = true;
  const native = renderer.shadowMap.render;
  const clear = renderer.clear;
  const context = { scene, root, sun, camera, sources: [] as T.Mesh[] };
  const frame = () => {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    cache.render(renderer, context, () =>
      renderer.shadowMap.render([sun], scene, camera),
    );
    assert.equal(renderer.shadowMap.render, native);
    assert.equal(renderer.clear, clear);
    assert.equal(current, null);
    assert.equal(fixed.castShadow, true);
    assert.equal(dynamic.castShadow, true);
    return depths.get(nativeTarget.depthTexture!)!.slice();
  };
  return {
    scene,
    root,
    sun,
    camera,
    cache,
    renderer,
    fixed,
    dynamic,
    context,
    frame,
    calls,
    native,
    allocations: () => allocations,
    disposals: () => disposals,
    failDraw: () => {
      throwOnce = true;
    },
    failCopy: () => {
      glError = 1282;
    },
  };
}

test("opt-in native depth union updates dynamic shadows without stale trails or extra static draws", () => {
  const f = fixture();
  assert.deepEqual(f.frame(), [0.2, 0.3, 0.7, 0.6]);
  assert.equal(f.allocations(), 0);
  f.cache.setEnabled(true);
  f.calls.length = 0;
  assert.deepEqual(f.frame(), [0.2, 0.3, 0.7, 0.6]);
  assert.deepEqual(f.calls, ["clear", "static", "save-static", "dynamic"]);
  assert.equal(f.cache.stats.staticRefreshes, 1);
  f.dynamic.userData.depth = [0.9, 1, 0.1, 0.4];
  f.dynamic.position.x = 5;
  f.calls.length = 0;
  assert.deepEqual(f.frame(), [0.2, 1, 0.1, 0.4]);
  assert.deepEqual(f.calls, ["restore-static", "dynamic"]);
  assert.equal(f.cache.stats.reusedFrames, 1);
  assert.equal(f.cache.stats.staticTriangles, 2);
  assert.equal(f.cache.stats.dynamicTriangles, 2);
  assert.equal(f.cache.stats.cacheBytesEstimate, 20);
  // Filtering individual visibility then taking min would give .5 here;
  // nearest raw depth must be combined first and gives fully occluded coverage.
  const staticDepth = [0.2, 0.8],
    dynamicDepth = [0.8, 0.2],
    reference = 0.5;
  const visibility = (ds: number[]) =>
    ds.filter((d) => reference <= d).length / ds.length;
  assert.equal(
    visibility(staticDepth.map((d, i) => Math.min(d, dynamicDepth[i]))),
    0,
  );
  assert.equal(
    Math.min(visibility(staticDepth), visibility(dynamicDepth)),
    0.5,
  );
  f.cache.setEnabled(false);
  assert.equal(f.disposals(), 1);
  assert.equal(f.cache.stats.cacheBytesEstimate, 0);
  assert.deepEqual(f.frame(), [0.2, 1, 0.1, 0.4]);
});

test("actual light elevation, static geometry/material/source policy changes invalidate while view movement alone does not", () => {
  const f = fixture();
  f.cache.setEnabled(true);
  f.frame();
  f.camera.position.x = 1;
  f.frame();
  assert.equal(f.cache.stats.staticRefreshes, 1);
  const change = (fn: () => void) => {
    const before = f.cache.stats.staticRefreshes;
    fn();
    f.frame();
    assert.equal(f.cache.stats.staticRefreshes, before + 1);
  };
  change(() => {
    f.sun.position.y += 0.07;
    f.sun.target.position.y += 0.07;
  });
  change(() => {
    f.fixed.position.z += 0.1;
  });
  change(() => {
    f.fixed.geometry.attributes.position.needsUpdate = true;
  });
  change(() => {
    f.fixed.geometry = new T.BoxGeometry();
  });
  change(() => {
    f.fixed.material.alphaTest = 0.4;
  });
  change(() => {
    f.renderer.shadowMap.needsUpdate = true;
  });
  const source = new T.Mesh(
    new T.PlaneGeometry(),
    new T.MeshStandardMaterial(),
  );
  source.castShadow = true;
  change(() => f.context.sources.push(source));
  change(() => {
    source.visible = false;
  });
  change(() => {
    source.visible = true;
  });
  change(() => {
    source.castShadow = false;
  });
  f.cache.dispose();
});

test("wind/unknown shaders, actors, skinning and explicit dynamic geometry never enter static depth", () => {
  const f = fixture();
  assert.equal(staticShadowCaster(f.fixed, f.root), true);
  assert.equal(staticShadowCaster(f.dynamic, f.root), false);
  const wind = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial());
  wind.material.onBeforeCompile = () => {};
  wind.material.customProgramCacheKey = () => "prospect-coastal-wind-v1";
  f.root.add(wind);
  assert.equal(staticShadowCaster(wind, f.root), false);
  const skin = new T.SkinnedMesh(
    new T.PlaneGeometry(),
    new T.MeshStandardMaterial(),
  );
  f.root.add(skin);
  assert.equal(staticShadowCaster(skin, f.root), false);
  f.fixed.userData.shadowDynamic = true;
  assert.equal(staticShadowCaster(f.fixed, f.root), false);
  delete f.fixed.userData.shadowDynamic;
  const instance = new T.InstancedMesh(
    new T.PlaneGeometry(),
    new T.MeshStandardMaterial(),
    1,
  );
  instance.castShadow = true;
  f.root.add(instance);
  f.scene.updateMatrixWorld(true);
  const old = staticShadowState(f.context, [instance]);
  instance.instanceMatrix.needsUpdate = true;
  assert.notDeepEqual(staticShadowState(f.context, [instance]), old);
});

test("candidate failure restores original hooks, flags and a complete native map in the same frame", () => {
  for (const fail of ["draw", "copy"] as const) {
    const f = fixture();
    f.cache.setEnabled(true);
    if (fail === "draw") f.failDraw();
    else f.failCopy();
    assert.deepEqual(f.frame(), [0.2, 0.3, 0.7, 0.6]);
    assert.equal(f.cache.enabled, false);
    assert.match(
      f.cache.stats.lastError!,
      fail === "draw" ? /dynamic draw failed/ : /blit failed/,
    );
    assert.equal(f.disposals(), 1);
    assert.equal(f.cache.stats.cacheBytesEstimate, 0);
    assert.equal(f.renderer.shadowMap.autoUpdate, true);
  }
});

test("unsupported shadow modes and disabled shadows retain native behaviour and release the cache", () => {
  const f = fixture();
  f.cache.setEnabled(true);
  f.frame();
  f.renderer.shadowMap.enabled = false;
  f.frame();
  assert.equal(f.disposals(), 1);
  assert.equal(f.cache.stats.cacheBytesEstimate, 0);
  f.renderer.shadowMap.enabled = true;
  f.renderer.localClippingEnabled = true;
  f.frame();
  assert.equal(f.allocations(), 1);
  f.cache.dispose();
});

test("unexpected native clear contract disables the candidate and renders the complete fallback", () => {
  const f = fixture();
  const native = f.renderer.shadowMap.render;
  const changed = function (
    this: typeof f.renderer.shadowMap,
    ...args: Parameters<typeof native>
  ) {
    const target = f.renderer.getRenderTarget();
    f.renderer.setRenderTarget(f.sun.shadow.map);
    f.renderer.clear();
    f.renderer.setRenderTarget(target);
    native.apply(this, args);
  };
  f.renderer.shadowMap.render = changed;
  f.cache.setEnabled(true);
  f.scene.updateMatrixWorld(true);
  f.cache.render(f.renderer, f.context, () =>
    f.renderer.shadowMap.render([f.sun], f.scene, f.camera),
  );
  assert.equal(f.cache.enabled, false);
  assert.match(f.cache.stats.lastError!, /repeated shadow-map clear/);
  assert.equal(f.renderer.shadowMap.render, changed);
  assert.equal(f.fixed.castShadow, true);
  assert.equal(f.dynamic.castShadow, true);
  assert.equal(f.disposals(), 1);
  f.renderer.shadowMap.render = native;
  assert.deepEqual(f.frame(), [0.2, 0.3, 0.7, 0.6]);
});

test("shadow-only offscreen casters and caller hooks survive caching; intentional noncasters stay absent", () => {
  const f = fixture();
  const extra = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial());
  extra.castShadow = false;
  extra.userData.depth = [0, 0, 0, 0];
  extra.frustumCulled = false;
  f.root.add(extra);
  let hooks = 0;
  f.fixed.onBeforeShadow = () => {
    hooks++;
  };
  const callback = f.fixed.onBeforeShadow;
  f.camera.position.set(500, 0, 0);
  f.cache.setEnabled(true);
  assert.deepEqual(f.frame(), [0.2, 0.3, 0.7, 0.6]);
  assert.equal(hooks, 1);
  assert.deepEqual(f.frame(), [0.2, 0.3, 0.7, 0.6]);
  assert.equal(hooks, 1);
  assert.equal(f.fixed.onBeforeShadow, callback);
  assert.equal(extra.castShadow, false);
  f.cache.dispose();
});
