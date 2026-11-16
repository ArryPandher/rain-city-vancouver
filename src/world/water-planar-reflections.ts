import * as T from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { addWaterShaderLayer } from "./water-shader-layers";

export const WATER_PLANAR = {
  name: "Canada North water — current-camera planar reflection",
  level: 0.065,
  resolution: 512,
  far: 15000,
  viewerCentre: [686.698, -697.34] as const,
  viewerFull: 90,
  viewerEnd: 170,
  positionThreshold: 0.04,
  angleThreshold: 0.001,
  colorBytes: 512 * 512 * 8,
  depthBudgetBytes: 512 * 512 * 4,
} as const;
export function waterPlanarViewerWeight(position: T.Vector3) {
  if (position.y <= WATER_PLANAR.level + 0.01) return 0;
  return (
    1 -
    T.MathUtils.smoothstep(
      Math.hypot(
        position.x - WATER_PLANAR.viewerCentre[0],
        position.z - WATER_PLANAR.viewerCentre[1],
      ),
      WATER_PLANAR.viewerFull,
      WATER_PLANAR.viewerEnd,
    )
  );
}
const NOISE = "color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);";
export function waterPlanarFragment(original: string) {
  if (original.split(NOISE).length !== 2)
    throw Error("Water planar shader contract changed");
  return `uniform sampler2D waterPlanarMap;
uniform mat4 waterPlanarWorldProjection;
uniform float waterPlanarWeight;
${original.replace(
  NOISE,
  `
  // A reflected gameplay camera covers the whole visible mean ocean plane.
  // Other shared-water heights must never borrow this projection.
  if(waterPlanarWeight>0.0 && abs(vWorld.y-0.065)<0.001){
    vec4 planarProjected=waterPlanarWorldProjection*vec4(vWorld,1.0);
    vec2 planarUV=planarProjected.xy/max(planarProjected.w,0.000001);
    if(planarProjected.w>0.0 && all(greaterThanEqual(planarUV,vec2(0.0))) && all(lessThanEqual(planarUV,vec2(1.0)))){
      vec3 planarRadiance=texture2D(waterPlanarMap,planarUV).rgb;
      // Replace the complete previous sky/analytic-sun alternative exactly once.
      color=mix(color,mix(deep,planarRadiance,fres*.85),waterPlanarWeight);
    }
  }
  ${NOISE}`,
)}`;
}
type Context = {
  scene: T.Scene;
  root: T.Object3D;
  sun: T.DirectionalLight;
  water: T.ShaderMaterial;
};

/** Detached Reflector supplies Three's reflected camera, projective lookup and
 * oblique clip math. It is never inserted into the scene or drawn as a mesh.
 * No PMREM, extra photos, global visibility extension or per-idle-frame render. */
export class WaterPlanarReflections {
  readonly reflector = new Reflector(new T.PlaneGeometry(1, 1), {
    textureWidth: WATER_PLANAR.resolution,
    textureHeight: WATER_PLANAR.resolution,
    multisample: 0,
    clipBias: 0,
  });
  private readonly inputCamera = new T.PerspectiveCamera();
  private readonly waterMeshes: T.Mesh[] = [];
  private readonly photoMaps: T.Texture[] = [];
  private readonly removeLayer: () => void;
  private readonly lastPosition = new T.Vector3();
  private readonly lastRotation = new T.Quaternion();
  private readonly lastProjection = new T.Matrix4();
  private readonly uniforms = {
    waterPlanarMap: { value: null as T.Texture | null },
    waterPlanarWorldProjection: { value: new T.Matrix4() },
    waterPlanarWeight: { value: 0 },
  };
  private weather = "day";
  private dirty = true;
  private ready = false;
  private disposed = false;
  private failed = false;
  private attempted = false;
  private waitingForPhoto = false;
  private deferFrames = 1;
  private captureCount = 0;
  private preparationMs = 0;
  private totalCaptureMs = 0;
  private captureDrawCalls = 0;
  private captureTriangles = 0;
  private totalCaptureDrawCalls = 0;
  private totalCaptureTriangles = 0;
  private lastError: string | null = null;
  private readonly onDispose = () => this.dispose();
  constructor(private readonly context: Context) {
    waterPlanarFragment(context.water.fragmentShader);
    this.reflector.rotation.x = -Math.PI / 2;
    this.reflector.position.y = WATER_PLANAR.level;
    this.reflector.visible = false;
    this.reflector.updateMatrixWorld(true);
    const target = this.reflector.getRenderTarget();
    target.texture.name = "Canada North water — owned planar linear radiance";
    target.texture.colorSpace = T.LinearSRGBColorSpace;
    target.texture.generateMipmaps = false;
    context.root.traverse((o) => {
      if (o instanceof T.Mesh && [o.material].flat().includes(context.water))
        this.waterMeshes.push(o);
      if (
        o instanceof T.Mesh &&
        o.userData.photoRidgeRefinement &&
        o.material instanceof T.MeshBasicMaterial &&
        o.material.map
      )
        this.photoMaps.push(o.material.map);
    });
    this.removeLayer = addWaterShaderLayer(
      context.water,
      "north-water-planar-v1",
      (shader) => {
        shader.fragmentShader = waterPlanarFragment(shader.fragmentShader);
        Object.assign(shader.uniforms, this.uniforms);
      },
    );
    context.water.addEventListener("dispose", this.onDispose);
  }
  /** Hide every shared water surface during ordinary glass captures as well. */
  withoutWater<TValue>(action: () => TValue): TValue {
    const visibility = this.waterMeshes.map((o) => o.visible);
    this.waterMeshes.forEach((o) => (o.visible = false));
    try {
      return action();
    } finally {
      this.waterMeshes.forEach((o, i) => (o.visible = visibility[i]));
    }
  }
  invalidate(weather: string) {
    if (this.disposed) return;
    this.weather = weather;
    this.dirty = true;
    this.failed = false;
    this.lastError = null;
    this.uniforms.waterPlanarWeight.value = 0;
  }
  update(
    renderer: T.WebGLRenderer,
    camera: T.PerspectiveCamera,
    allowCapture = true,
  ) {
    if (this.disposed) return;
    camera.updateWorldMatrix(true, false);
    const position = new T.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rotation = new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().extractRotation(camera.matrixWorld),
    );
    const weight =
      this.weather === "day" ? waterPlanarViewerWeight(position) : 0;
    this.uniforms.waterPlanarWeight.value =
      this.ready && !this.failed ? weight : 0;
    if (!weight || this.failed || !allowCapture) return;
    const changed =
      this.dirty ||
      !this.ready ||
      position.distanceTo(this.lastPosition) > WATER_PLANAR.positionThreshold ||
      rotation.angleTo(this.lastRotation) > WATER_PLANAR.angleThreshold ||
      camera.projectionMatrix.elements.some(
        (v, i) => Math.abs(v - this.lastProjection.elements[i]) > 1e-8,
      );
    if (!changed) return;
    this.waitingForPhoto = this.photoMaps.some(
      (map) =>
        !map.image || (map.image as { complete?: boolean }).complete === false,
    );
    if (this.waitingForPhoto) return;
    if (this.deferFrames > 0) {
      this.deferFrames--;
      return;
    }
    const start = performance.now();
    const gl = renderer.getContext();
    const saved = {
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      viewport: renderer.getViewport(new T.Vector4()),
      currentViewport: renderer.getCurrentViewport(new T.Vector4()),
      scissor: renderer.getScissor(new T.Vector4()),
      scissorTest: renderer.getScissorTest(),
      actualScissor: new T.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX)),
      actualScissorTest: gl.getParameter(gl.SCISSOR_TEST) as boolean,
      depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,
      xr: renderer.xr.enabled,
      autoClear: renderer.autoClear,
      autoClearColor: renderer.autoClearColor,
      autoClearDepth: renderer.autoClearDepth,
      autoClearStencil: renderer.autoClearStencil,
      infoAutoReset: renderer.info.autoReset,
      infoFrame: renderer.info.render.frame,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      toneMapping: renderer.toneMapping,
      shadowAuto: renderer.shadowMap.autoUpdate,
      shadowNeeds: renderer.shadowMap.needsUpdate,
      reflectorVisible: this.reflector.visible,
      forceUpdate: this.reflector.forceUpdate,
    };
    // Match the existing static capture policy, while retaining every current
    // world chunk visibility decision rather than widening the city culler.
    const hidden = this.context.scene.children.filter(
      (o) =>
        o !== this.context.root &&
        o !== this.context.sun.target &&
        !(o instanceof T.Light),
    );
    const visibility = hidden.map((o) => o.visible);
    const lightShadows: Array<{
      shadow: T.LightShadow;
      auto: boolean;
      needs: boolean;
    }> = [];
    this.context.scene.traverse((o) => {
      const s = (o as T.DirectionalLight).shadow;
      if (
        o instanceof T.DirectionalLight ||
        o instanceof T.PointLight ||
        o instanceof T.SpotLight
      )
        lightShadows.push({
          shadow: s,
          auto: s.autoUpdate,
          needs: s.needsUpdate,
        });
    });
    try {
      hidden.forEach((o) => (o.visible = false));
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      renderer.autoClear = true;
      renderer.autoClearColor =
        renderer.autoClearDepth =
        renderer.autoClearStencil =
          true;
      renderer.toneMapping = T.NoToneMapping;
      this.inputCamera.copy(camera, false);
      this.inputCamera.position.copy(position);
      this.inputCamera.quaternion.copy(rotation);
      this.inputCamera.scale.set(1, 1, 1);
      this.inputCamera.far = Math.max(camera.far, WATER_PLANAR.far);
      if (this.inputCamera.far !== camera.far)
        this.inputCamera.updateProjectionMatrix();
      this.inputCamera.updateMatrixWorld(true);
      this.reflector.camera.layers.mask = camera.layers.mask;
      this.attempted = true;
      this.withoutWater(() =>
        this.reflector.onBeforeRender(
          renderer,
          this.context.scene,
          this.inputCamera,
          this.reflector.geometry,
          this.reflector.material as T.Material,
          null as unknown as T.Group,
        ),
      );
      const localProjection = (this.reflector.material as T.ShaderMaterial)
        .uniforms.textureMatrix.value as T.Matrix4;
      // Reflector includes its model matrix because its own shader samples local
      // vertices. Our water shader supplies world coordinates, so remove it.
      this.uniforms.waterPlanarWorldProjection.value
        .copy(localProjection)
        .multiply(this.reflector.matrixWorld.clone().invert());
      this.uniforms.waterPlanarMap.value =
        this.reflector.getRenderTarget().texture;
      this.uniforms.waterPlanarWeight.value = weight;
      this.lastPosition.copy(position);
      this.lastRotation.copy(rotation);
      this.lastProjection.copy(camera.projectionMatrix);
      this.ready = true;
      this.dirty = false;
      this.captureCount++;
    } catch (error) {
      this.failed = true;
      this.lastError = String(error);
      this.uniforms.waterPlanarMap.value = null;
      this.uniforms.waterPlanarWeight.value = 0;
    } finally {
      const dispatched = renderer.info.render.frame > saved.infoFrame;
      this.captureDrawCalls = dispatched
        ? Math.max(
            0,
            renderer.info.render.calls -
              (saved.infoAutoReset ? 0 : saved.calls),
          )
        : 0;
      this.captureTriangles = dispatched
        ? Math.max(
            0,
            renderer.info.render.triangles -
              (saved.infoAutoReset ? 0 : saved.triangles),
          )
        : 0;
      this.totalCaptureDrawCalls += this.captureDrawCalls;
      this.totalCaptureTriangles += this.captureTriangles;
      hidden.forEach((o, i) => (o.visible = visibility[i]));
      this.reflector.visible = saved.reflectorVisible;
      this.reflector.forceUpdate = saved.forceUpdate;
      renderer.xr.enabled = saved.xr;
      renderer.autoClear = saved.autoClear;
      renderer.autoClearColor = saved.autoClearColor;
      renderer.autoClearDepth = saved.autoClearDepth;
      renderer.autoClearStencil = saved.autoClearStencil;
      renderer.toneMapping = saved.toneMapping;
      renderer.shadowMap.autoUpdate = saved.shadowAuto;
      renderer.shadowMap.needsUpdate = saved.shadowNeeds;
      lightShadows.forEach(({ shadow, auto, needs }) => {
        shadow.autoUpdate = auto;
        shadow.needsUpdate = needs;
      });
      renderer.setViewport(saved.viewport);
      renderer.setScissor(saved.scissor);
      renderer.setScissorTest(saved.scissorTest);
      renderer.setRenderTarget(saved.target, saved.face, saved.mip);
      renderer.state.viewport(saved.currentViewport);
      renderer.state.scissor(saved.actualScissor);
      renderer.state.setScissorTest(saved.actualScissorTest);
      renderer.state.buffers.depth.setMask(saved.depthMask);
      this.preparationMs = performance.now() - start;
      this.totalCaptureMs += this.preparationMs;
    }
  }
  diagnostics() {
    return {
      requested: !this.disposed,
      active: !this.disposed && this.uniforms.waterPlanarWeight.value > 0,
      backend: "planar current-camera",
      status: this.disposed
        ? "disposed"
        : this.failed
          ? "error"
          : this.waitingForPhoto
            ? "waiting for photo"
            : this.ready
              ? "ready"
              : "queued",
      error: this.lastError,
      captures: this.captureCount,
      preparationMs: this.preparationMs,
      totalCaptureMs: this.totalCaptureMs,
      captureDrawCalls: this.captureDrawCalls,
      captureTriangles: this.captureTriangles,
      totalCaptureDrawCalls: this.totalCaptureDrawCalls,
      totalCaptureTriangles: this.totalCaptureTriangles,
      cameraWeight: this.uniforms.waterPlanarWeight.value,
      width: this.ready && !this.disposed ? WATER_PLANAR.resolution : 0,
      height: this.ready && !this.disposed ? WATER_PLANAR.resolution : 0,
      level: WATER_PLANAR.level,
      far: this.inputCamera.far,
      resolution: WATER_PLANAR.resolution,
      multisample: 0,
      retainedTextureBytes:
        this.attempted && !this.disposed ? WATER_PLANAR.colorBytes : 0,
      depthBudgetBytes:
        this.attempted && !this.disposed ? WATER_PLANAR.depthBudgetBytes : 0,
      scope:
        "whole visible ocean at y=.065; camera90m full/170m fade around Canada NorthPoint, day only",
      limitation:
        "mean-plane reflection, no wave ray displacement; retained normal chunk visibility, static actors excluded; movement may capture every frame, no claimed FPS benefit",
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.uniforms.waterPlanarMap.value = null;
    this.uniforms.waterPlanarWeight.value = 0;
    this.removeLayer();
    this.context.water.removeEventListener("dispose", this.onDispose);
    this.reflector.dispose();
    this.reflector.geometry.dispose();
  }
}
