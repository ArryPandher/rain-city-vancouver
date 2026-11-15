import * as T from "three";

type Caster = T.Mesh | T.Line | T.Points;
type Context = {
  scene: T.Scene;
  camera: T.Camera;
  sun: T.DirectionalLight;
  root: T.Object3D;
  /** Includes detached canonical records used by static/terrain batches. */
  sources: readonly T.Mesh[];
};
const caster = (o: T.Object3D): o is Caster =>
  o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points;
const materials = (o: Caster) => [o.material].flat();
const staticProgram = (m: T.Material) =>
  m.onBeforeCompile === T.Material.prototype.onBeforeCompile ||
  /^(rain-city-tree-stem-v1|broadleaf-volume-v1-(true|false))$/.test(
    m.customProgramCacheKey(),
  );

/** Unknown/custom animated shaders and all actors fail into the dynamic pass.
 * The two allowed tree programs depend on stem attributes and shadow-camera
 * position, never time. No geometry or off-camera caster is removed. */
export function staticShadowCaster(
  o: Caster,
  root: T.Object3D,
  detached = false,
) {
  if (
    !(o instanceof T.Mesh) ||
    o instanceof T.SkinnedMesh ||
    o.morphTargetInfluences?.length ||
    o.userData.shadowDynamic
  )
    return false;
  let inStaticScope = detached;
  for (let p: T.Object3D | null = o; p; p = p.parent)
    if (p === root || p.name === "Street tree") {
      inStaticScope = true;
    }
  if (!inStaticScope || materials(o).some((m) => !staticProgram(m)))
    return false;
  if (o.customDepthMaterial && !staticProgram(o.customDepthMaterial))
    return false;
  // Batch hooks have hidden canonical visibility state; only the reviewed
  // static batches below are covered by the supplied source records.
  if (o instanceof T.BatchedMesh) return !!o.userData.staticBatchMemory;
  return true;
}

function visible(o: T.Object3D) {
  for (let p: T.Object3D | null = o; p; p = p.parent)
    if (!p.visible) return false;
  return true;
}
function materialState(m: T.Material): unknown[] {
  const physical = m as T.MeshStandardMaterial;
  const state: unknown[] = [
    m,
    m.version,
    m.visible,
    m.side,
    m.shadowSide,
    m.alphaTest,
    m.alphaToCoverage,
    physical.wireframe,
    m.onBeforeCompile,
    m.clippingPlanes,
    m.clipShadows,
    m.clipIntersection,
    physical.displacementScale,
    physical.displacementBias,
  ];
  for (const map of [
    m.alphaTest > 0 ? physical.map : null,
    physical.alphaMap,
    physical.displacementMap,
  ]) {
    state.push(map, map?.version);
    if (map)
      state.push(
        map.offset.x,
        map.offset.y,
        map.repeat.x,
        map.repeat.y,
        map.center.x,
        map.center.y,
        map.rotation,
        ...map.matrix.elements,
      );
  }
  return state;
}
function objectState(o: T.Mesh, detached = false): unknown[] {
  const g = o.geometry;
  const state: unknown[] = [
    o,
    o.visible,
    o.castShadow,
    o.layers.mask,
    g,
    g.drawRange.start,
    g.drawRange.count,
    ...(detached ? o.matrix : o.matrixWorld).elements,
  ];
  for (const a of [g.index, ...Object.values(g.attributes)])
    if (a) state.push(a, "data" in a ? a.data.version : a.version, a.count);
  if (o instanceof T.InstancedMesh)
    state.push(o.count, o.instanceMatrix, o.instanceMatrix.version);
  for (const m of [
    ...materials(o),
    ...(o.customDepthMaterial ? [o.customDepthMaterial] : []),
  ])
    state.push(...materialState(m));
  return state;
}

/** Exact-value comparison, not a hash. Caster membership, source policies,
 * geometry/instance/stem uploads and light matrices invalidate independently
 * of the simulation clock. No vertex arrays are scanned or copied here. */
export function staticShadowState(context: Context, fixed: readonly T.Mesh[]) {
  const { sun, camera } = context;
  sun.shadow.updateMatrices(sun);
  const state: unknown[] = [
    camera.layers.mask,
    sun.shadow.mapSize.x,
    sun.shadow.mapSize.y,
    ...sun.shadow.matrix.elements,
    ...sun.shadow.camera.projectionMatrix.elements,
  ];
  for (const o of fixed) state.push(...objectState(o));
  for (const o of context.sources) {
    if (
      !o.visible ||
      !o.castShadow ||
      !staticShadowCaster(o, context.root, true)
    )
      continue;
    state.push(...objectState(o, o.parent === null));
  }
  return state;
}
const equal = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Experimental r182 adapter: native static depth is cached, then blitted into
 * the native map before native dynamic shadow draws. Hardware depth testing
 * combines nearest depths BEFORE the unchanged PCF comparison/filtering.
 * No custom receiver shader, alternate geometry or reduced shadow resolution.
 */
export class LiveShadowCache {
  enabled = false;
  private target?: T.WebGLRenderTarget;
  private state?: unknown[];
  private sourceDepth?: T.DepthTexture;
  private verifiedCopy = false;
  readonly stats = {
    enabled: false,
    staticRefreshes: 0,
    reusedFrames: 0,
    depthCopies: 0,
    staticCalls: 0,
    staticTriangles: 0,
    dynamicCalls: 0,
    dynamicTriangles: 0,
    staticCasters: 0,
    dynamicCasters: 0,
    cacheBytesEstimate: 0,
    submissionMs: 0,
    lastError: null as string | null,
  };
  setEnabled(enabled: boolean) {
    this.enabled = this.stats.enabled = enabled;
    this.disposeResources();
    if (enabled) this.stats.lastError = null;
  }
  private disposeResources() {
    this.target?.dispose();
    this.target = undefined;
    this.sourceDepth = undefined;
    this.state = undefined;
    this.verifiedCopy = false;
    this.stats.cacheBytesEstimate = 0;
  }
  dispose() {
    this.setEnabled(false);
  }

  render<R>(renderer: T.WebGLRenderer, context: Context, draw: () => R): R {
    if (!this.enabled) return draw();
    if (!renderer.shadowMap.enabled) {
      this.disposeResources();
      return draw();
    }
    const cache = this,
      original = renderer.shadowMap.render;
    // Enter inside WebGLRenderer.render, after matrix/skeleton/instance setup.
    // This also avoids doing shadow work outside Three's render-frame lifecycle.
    renderer.shadowMap.render = function (lights, scene, camera) {
      if (
        scene !== context.scene ||
        camera !== context.camera ||
        (!this.autoUpdate && !this.needsUpdate)
      )
        return original.call(this, lights, scene, camera);
      if (
        lights.length !== 1 ||
        lights[0] !== context.sun ||
        this.type !== T.PCFShadowMap ||
        renderer.capabilities.reversedDepthBuffer ||
        renderer.localClippingEnabled ||
        renderer.clippingPlanes?.length
      ) {
        cache.disposeResources();
        return original.call(this, lights, scene, camera);
      }
      const started = performance.now();
      try {
        cache.update(renderer, context, () =>
          original.call(this, lights, scene, camera),
        );
      } catch (error) {
        cache.stats.lastError = String(error);
        cache.setEnabled(false);
        // A failed candidate must be replaced by a complete native map now.
        this.needsUpdate = true;
        context.sun.shadow.needsUpdate = true;
        original.call(this, lights, scene, camera);
      } finally {
        cache.stats.submissionMs =
          Math.round((performance.now() - started) * 100) / 100;
      }
    };
    try {
      return draw();
    } finally {
      renderer.shadowMap.render = original;
    }
  }

  private update(
    renderer: T.WebGLRenderer,
    context: Context,
    native: () => void,
  ) {
    const { sun, scene, root } = context;
    const records: { object: Caster; cast: boolean; fixed: boolean }[] = [];
    scene.traverse((o) => {
      if (caster(o) && o.castShadow)
        records.push({
          object: o,
          cast: true,
          fixed: visible(o) && staticShadowCaster(o, root),
        });
    });
    // Nonstandard depth-test/write rules are order-dependent and cannot safely
    // be separated. The authored tree/wind depth materials use normal depth.
    if (
      records.some(
        ({ object }) =>
          object instanceof T.Mesh &&
          object.customDepthMaterial &&
          (!object.customDepthMaterial.depthTest ||
            !object.customDepthMaterial.depthWrite ||
            object.customDepthMaterial.depthFunc !== T.LessEqualDepth),
      )
    ) {
      this.disposeResources();
      native();
      return;
    }
    const fixed = records.filter((r) => r.fixed).map((r) => r.object as T.Mesh);
    const state = staticShadowState(context, fixed);
    const map = sun.shadow.map;
    const depth = map?.depthTexture;
    if (
      !map ||
      !(depth instanceof T.DepthTexture) ||
      depth.type !== T.UnsignedIntType ||
      map.width !== sun.shadow.mapSize.x ||
      map.height !== sun.shadow.mapSize.y ||
      map.samples !== 0 ||
      !fixed.length
    ) {
      this.disposeResources();
      native();
      return;
    }
    const oldTarget = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel(),
      clear = renderer.clear,
      auto = renderer.shadowMap.autoUpdate,
      lightAuto = sun.shadow.autoUpdate;
    const refresh =
      renderer.shadowMap.needsUpdate ||
      sun.shadow.needsUpdate ||
      this.sourceDepth !== depth ||
      !equal(this.state, state);
    const counters = () => ({ ...renderer.info.render });
    const phase = (fixedPass: boolean) => {
      for (const r of records)
        r.object.castShadow = r.cast && r.fixed === fixedPass;
      renderer.shadowMap.autoUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      sun.shadow.autoUpdate = true;
      sun.shadow.needsUpdate = true;
      const before = counters();
      native();
      return {
        calls: renderer.info.render.calls - before.calls,
        triangles: renderer.info.render.triangles - before.triangles,
      };
    };
    try {
      if (!this.target || this.sourceDepth !== depth) {
        this.disposeResources();
        this.target = new T.WebGLRenderTarget(map.width, map.height, {
          format: T.RedFormat,
          type: T.UnsignedByteType,
          minFilter: T.NearestFilter,
          magFilter: T.NearestFilter,
          depthTexture: new T.DepthTexture(map.width, map.height, depth.type),
          stencilBuffer: false,
          generateMipmaps: false,
        });
        this.target.texture.name =
          "Experimental static shadow cache (unused R8 colour)";
        this.target.depthTexture!.name = "Experimental static shadow depth";
        renderer.initRenderTarget(this.target);
        this.sourceDepth = depth;
        // R8 colour attachment + matching native depth, not driver-allocation telemetry.
        this.stats.cacheBytesEstimate = map.width * map.height * 5;
      }
      const copy = (from: T.DepthTexture, to: T.DepthTexture) => {
        renderer.copyTextureToTexture(from, to);
        this.stats.depthCopies++;
        renderer.setRenderTarget(oldTarget, face, mip);
        if (!this.verifiedCopy) {
          const gl = renderer.getContext();
          if (gl.getError() !== gl.NO_ERROR)
            throw new Error("Static shadow depth blit failed");
          this.verifiedCopy = true;
        }
      };
      if (refresh || !this.state) {
        const result = phase(true);
        this.stats.staticCalls = result.calls;
        this.stats.staticTriangles = result.triangles;
        copy(depth, this.target.depthTexture!);
        this.stats.staticRefreshes++;
      } else {
        copy(this.target.depthTexture!, depth);
        this.stats.reusedFrames++;
      }
      let skipped = 0;
      // r182 clears every directional map once unconditionally. Suppress only
      // that exact clear while drawing native dynamic casters onto static depth.
      renderer.clear = function (...args) {
        if (this.getRenderTarget() === map) {
          if (++skipped !== 1)
            throw new Error("Unexpected repeated shadow-map clear");
          return;
        }
        clear.apply(this, args);
      };
      const result = phase(false);
      if (skipped !== 1)
        throw new Error("Native shadow clear contract changed");
      this.stats.dynamicCalls = result.calls;
      this.stats.dynamicTriangles = result.triangles;
      this.stats.staticCasters = fixed.length;
      this.stats.dynamicCasters = records.filter(
        (r) => !r.fixed && visible(r.object),
      ).length;
      this.state = state;
    } finally {
      renderer.clear = clear;
      for (const r of records) r.object.castShadow = r.cast;
      renderer.shadowMap.autoUpdate = auto;
      sun.shadow.autoUpdate = lightAuto;
      renderer.setRenderTarget(oldTarget, face, mip);
    }
  }
}
