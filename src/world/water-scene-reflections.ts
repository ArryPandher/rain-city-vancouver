import * as T from "three";
import { SceneReflections } from "../rendering/reflection-probes";
import { addWaterShaderLayer } from "./water-shader-layers";
import { waterOpticsInput } from "./water-optics";

export const WATER_SCENE = {
  name: "Canada North water — bounded static scene",
  position: [700, 0.365, -780] as const,
  viewerCentre: [686.698, -697.34] as const,
  viewerFull: 90,
  viewerEnd: 170,
  surfaceFull: 120,
  surfaceEnd: 260,
  far: 15000,
  resolution: 128,
  cubeBytes: 1048560,
  pmremBytes: 1572864,
} as const;
export function waterSceneViewerWeight(x: number, z: number) {
  return (
    1 -
    T.MathUtils.smoothstep(
      Math.hypot(
        x - WATER_SCENE.viewerCentre[0],
        z - WATER_SCENE.viewerCentre[1],
      ),
      WATER_SCENE.viewerFull,
      WATER_SCENE.viewerEnd,
    )
  );
}
const NOISE = "color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);";
export function waterSceneFragment(original: string) {
  if (original.split(NOISE).length !== 2)
    throw new Error("Water scene comparison contract changed");
  let lookup = T.ShaderChunk.cube_uv_reflection_fragment;
  for (const name of [
    "getFace",
    "getUV",
    "bilinearCubeUV",
    "roughnessToMip",
    "textureCubeUV",
  ])
    lookup = lookup.replace(
      new RegExp(`\\b${name}\\b`, "g"),
      `waterScene_${name}`,
    );
  lookup = lookup
    .replace(/cubeUV_/g, "waterSceneCubeUV_")
    .replace(/CUBEUV_MAX_MIP/g, "7.0")
    .replace(/CUBEUV_TEXEL_WIDTH/g, "(1.0/384.0)")
    .replace(/CUBEUV_TEXEL_HEIGHT/g, "(1.0/512.0)");
  return `#define ENVMAP_TYPE_CUBE_UV\n${lookup}
  uniform sampler2D waterSceneMap;
  uniform float waterSceneWeight;
  ${original.replace(
    NOISE,
    `
  if(waterSceneWeight>0.0){
    vec3 sceneRay=reflect(-v,n);
    float sceneRegion=1.0-smoothstep(120.0,260.0,length(vWorld.xz-vec2(700.0,-780.0)));
    // The distant northern horizon is credible here; close southern berth
    // geometry is too far from this fixed viewpoint for accurate parallax.
    float sceneNorth=smoothstep(0.25,0.55,-sceneRay.z);
    vec3 sceneRadiance=waterScene_textureCubeUV(waterSceneMap,sceneRay,.1).rgb;
    color=mix(color,mix(deep,sceneRadiance,fres*.85),waterSceneWeight*sceneRegion*sceneNorth);
  }
  ${NOISE}`,
  )}`;
}

type Context = {
  scene: T.Scene;
  root: T.Object3D;
  chunks: T.Mesh[];
  sun: T.DirectionalLight;
  water: T.ShaderMaterial;
  daySky: T.Texture;
};
type Filter = (
  cube: T.CubeTexture,
  renderer: T.WebGLRenderer,
) => T.WebGLRenderTarget;
/** Owns a dedicated cube/derivative. Never borrows or disposes glass probes. */
export class WaterSceneReflections {
  readonly captures: SceneReflections;
  private target?: T.WebGLRenderTarget;
  private readonly waterMeshes: T.Mesh[] = [];
  private readonly photoMaps: T.Texture[] = [];
  private waitingForPhoto = false;
  private readonly removeLayer: () => void;
  private disposed = false;
  private failed = false;
  private cubeAttempted = false;
  private weather = "day";
  private deferFrames = 1;
  private lastError: string | null = null;
  private preparationMs = 0;
  private readonly uniforms = {
    waterSceneMap: { value: null as T.Texture | null },
    waterSceneWeight: { value: 0 },
  };
  private readonly onDispose = () => this.dispose();
  constructor(
    private readonly context: Context,
    private readonly filter?: Filter,
  ) {
    waterSceneFragment(context.water.fragmentShader);
    context.root.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        o.userData.photoRidgeRefinement &&
        o.material instanceof T.MeshBasicMaterial &&
        o.material.map
      )
        this.photoMaps.push(o.material.map);
      if (
        o instanceof T.Mesh &&
        (Array.isArray(o.material) ? o.material : [o.material]).includes(
          context.water,
        )
      )
        this.waterMeshes.push(o);
    });
    this.captures = new SceneReflections(
      context.scene,
      context.root,
      context.chunks.filter((c) => !this.waterMeshes.includes(c)),
      context.sun,
      [
        {
          name: WATER_SCENE.name,
          position: [...WATER_SCENE.position],
          materials: [],
          resolution: 128,
        },
      ],
    );
    const probe = this.captures.probes[0];
    probe.camera = new T.CubeCamera(0.1, WATER_SCENE.far, probe.target);
    probe.camera.position.set(...WATER_SCENE.position);
    this.removeLayer = addWaterShaderLayer(
      context.water,
      "north-water-static-scene-v1",
      (shader) => {
        shader.fragmentShader = waterSceneFragment(shader.fragmentShader);
        Object.assign(shader.uniforms, this.uniforms);
      },
    );
    context.water.addEventListener("dispose", this.onDispose);
  }
  /** Also wrap ordinary local-probe capture while enabled: never bake this
   * water target back into glass cubes that a later water capture may see. */
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
    this.uniforms.waterSceneWeight.value = 0;
    this.uniforms.waterSceneMap.value = null;
    this.target?.dispose();
    this.target = undefined;
    this.failed = false;
    this.lastError = null;
    this.captures.invalidate();
  }
  update(renderer: T.WebGLRenderer, viewer: T.Vector3, allowCapture = true) {
    if (this.disposed) return;
    const weight =
      this.weather === "day" ? waterSceneViewerWeight(viewer.x, viewer.z) : 0;
    this.uniforms.waterSceneWeight.value = this.target ? weight : 0;
    if (!weight || this.target || this.failed || !allowCapture) return;
    this.waitingForPhoto = this.photoMaps.some(
      (map) =>
        !map.image || (map.image as { complete?: boolean }).complete === false,
    );
    if (this.waitingForPhoto) return;
    if (this.deferFrames > 0) {
      this.deferFrames--;
      return;
    }
    if (
      Math.hypot(
        viewer.x - WATER_SCENE.position[0],
        viewer.z - WATER_SCENE.position[2],
      ) >= 180
    )
      return;
    const start = performance.now(),
      scene = this.context.scene;
    const saved = {
      background: scene.background,
      autoClear: renderer.autoClear,
      toneMapping: renderer.toneMapping,
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      xr: renderer.xr.enabled,
    };
    let sky: T.DataTexture | undefined, generator: T.PMREMGenerator | undefined;
    try {
      // Prevent the source HDR's mirrored lower sun even when water is hidden.
      // Three owns the temporary background conversion and frees it when this
      // input is disposed. Scene environment/material illumination stays intact.
      sky = waterOpticsInput(this.context.daySky);
      scene.background = sky;
      this.cubeAttempted = true;
      this.withoutWater(() => this.captures.update(renderer, viewer));
      const cube = this.captures.currentTexture(WATER_SCENE.name);
      if (!cube)
        throw new Error(
          this.captures.lastError ?? "Water scene capture did not complete",
        );
      if (this.filter) this.target = this.filter(cube, renderer);
      else {
        generator = new T.PMREMGenerator(renderer);
        this.target = generator.fromCubemap(cube);
      }
      if (
        this.target.width !== 384 ||
        this.target.height !== 512 ||
        this.target.texture.type !== T.HalfFloatType ||
        this.target.texture.mapping !== T.CubeUVReflectionMapping
      )
        throw new Error("Unexpected water scene PMREM dimensions/format");
      this.target.texture.name =
        "Canada North water — owned static-scene PMREM";
      this.uniforms.waterSceneMap.value = this.target.texture;
      this.uniforms.waterSceneWeight.value = weight;
    } catch (error) {
      this.failed = true;
      this.lastError = String(error);
      this.uniforms.waterSceneMap.value = null;
      this.uniforms.waterSceneWeight.value = 0;
      this.target?.dispose();
      this.target = undefined;
    } finally {
      scene.background = saved.background;
      generator?.dispose();
      sky?.dispose();
      renderer.autoClear = saved.autoClear;
      renderer.toneMapping = saved.toneMapping;
      renderer.xr.enabled = saved.xr;
      renderer.setRenderTarget(saved.target, saved.face, saved.mip);
      // CubeCamera may abort before restoring this during a driver exception.
      this.captures.probes[0].target.texture.generateMipmaps = true;
      this.preparationMs = performance.now() - start;
    }
  }
  diagnostics() {
    return {
      requested: !this.disposed,
      active: !this.disposed && this.uniforms.waterSceneWeight.value > 0,
      status: this.disposed
        ? "disposed"
        : this.failed
          ? "error"
          : this.target
            ? "ready"
            : this.waitingForPhoto
              ? "waiting for photo"
              : "queued",
      error: this.lastError,
      captures: this.captures.captures,
      preparationMs: this.preparationMs,
      cameraWeight: this.uniforms.waterSceneWeight.value,
      position: WATER_SCENE.position,
      far: WATER_SCENE.far,
      resolution: 128,
      width: this.target?.width ?? 0,
      height: this.target?.height ?? 0,
      retainedTextureBytes: this.disposed
        ? 0
        : (this.cubeAttempted ? WATER_SCENE.cubeBytes : 0) +
          (this.target ? WATER_SCENE.pmremBytes : 0),
      budgetTextureBytes: WATER_SCENE.cubeBytes + WATER_SCENE.pmremBytes,
      scope:
        "north-facing water120m full/260m fade; camera90m full/170m fade around Canada NorthPoint",
      limitation:
        "single-view radiance, no exact nearby ship/shore parallax; display-photo horizon is not measured HDR",
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.uniforms.waterSceneWeight.value = 0;
    this.uniforms.waterSceneMap.value = null;
    this.removeLayer();
    this.target?.dispose();
    this.target = undefined;
    this.context.water.removeEventListener("dispose", this.onDispose);
    this.captures.dispose();
  }
}
