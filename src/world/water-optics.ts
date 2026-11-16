import * as T from "three";

export const WATER_OPTICS = {
  faceSize: 128,
  inputWidth: 512,
  inputHeight: 256,
  atlasWidth: 384,
  atlasHeight: 512,
  roughness: 0.1,
  horizonBlend: 0.05,
  retainedBytes: 384 * 512 * 8,
  temporaryInputBytes: 512 * 256 * 8,
} as const;

/** A bounded derivative of the already loaded/clamped HDR; never mutate it.
 * Area-weighted box filtering retains radiance without point-sampling the sun. */
export function waterOpticsInput(source: T.Texture): T.DataTexture {
  const image = source.image as {
    width: number;
    height: number;
    data: Uint16Array | Float32Array;
  };
  const { inputWidth: width, inputHeight: height } = WATER_OPTICS;
  if (
    !image ||
    image.width < width ||
    image.height < height ||
    image.width % width ||
    image.height % height ||
    image.data?.length !== image.width * image.height * 4 ||
    !(
      (source.type === T.HalfFloatType && image.data instanceof Uint16Array) ||
      (source.type === T.FloatType && image.data instanceof Float32Array)
    )
  )
    throw new Error("Unsupported loaded HDR for bounded water filtering");
  const pixels = new Uint16Array(width * height * 4);
  const sx = image.width / width,
    sy = image.height / height;
  const decode = (v: number) =>
    source.type === T.HalfFloatType ? T.DataUtils.fromHalfFloat(v) : v;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const rgb = [0, 0, 0];
      let weight = 0;
      for (let iy = y * sy; iy < (y + 1) * sy; iy++) {
        const w = Math.sin((Math.PI * (iy + 0.5)) / image.height);
        for (let ix = x * sx; ix < (x + 1) * sx; ix++) {
          const i = (iy * image.width + ix) * 4;
          for (let c = 0; c < 3; c++) rgb[c] += decode(image.data[i + c]) * w;
          weight += w;
        }
      }
      const j = (y * width + x) * 4;
      for (let c = 0; c < 3; c++)
        pixels[j + c] = T.DataUtils.toHalfFloat(rgb[c] / weight);
      pixels[j + 3] = T.DataUtils.toHalfFloat(1);
    }
  const texture = new T.DataTexture(
    pixels,
    width,
    height,
    T.RGBAFormat,
    T.HalfFloatType,
  );
  texture.name = "Water HDR comparison — temporary 512x256 input";
  texture.colorSpace = source.colorSpace;
  texture.flipY = source.flipY;
  texture.mapping = T.EquirectangularReflectionMapping;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Match WebGLBackground's inverse Euler for the PMREM frame. */
export function waterOpticsRotation(
  rotation: T.Euler,
  target = new T.Matrix3(),
) {
  return target.setFromMatrix4(
    new T.Matrix4().makeRotationFromEuler(
      new T.Euler(-rotation.x, -rotation.y, -rotation.z, rotation.order),
    ),
  );
}

const NOISE = "color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);";
export function waterOpticsFragment(original: string) {
  if (
    original.split(NOISE).length !== 2 ||
    !original.includes("color+=sunColor*spec*2.3*(1.-night*.8);")
  )
    throw new Error("Water shader comparison contract changed");
  const lookup = T.ShaderChunk.cube_uv_reflection_fragment
    .replace(/CUBEUV_MAX_MIP/g, "7.0")
    .replace(/CUBEUV_TEXEL_WIDTH/g, "(1.0 / 384.0)")
    .replace(/CUBEUV_TEXEL_HEIGHT/g, "(1.0 / 512.0)");
  return `#define ENVMAP_TYPE_CUBE_UV\n${lookup}
  uniform sampler2D waterHdrMap;
  uniform mat3 waterHdrRotation;
  uniform float waterHdrEnabled,waterHdrIntensity;
  ${original.replace(
    NOISE,
    `
  vec3 waterReflection = reflect(-v,n);
  float waterHdrWeight = waterHdrEnabled * smoothstep(0.0, ${WATER_OPTICS.horizonBlend}, waterReflection.y);
  if (waterHdrWeight > 0.0) {
    vec3 waterRadiance = textureCubeUV(waterHdrMap,waterHdrRotation*waterReflection,${WATER_OPTICS.roughness}).rgb * waterHdrIntensity;
    // Crossfade complete alternatives: the HDR already contains its solar disc.
    color = mix(color,mix(deep,waterRadiance,fres*.85),waterHdrWeight);
  }
  ${NOISE}`,
  )}`;
}

type Generator = Pick<T.PMREMGenerator, "fromEquirectangular" | "dispose">;
export type WaterOpticsGeneratorFactory = (
  renderer: T.WebGLRenderer,
) => Generator;

/** Owns one PMREM, never the shared HDR or the existing water material. */
export class WaterOpticsComparison {
  private target?: T.WebGLRenderTarget;
  private original: string;
  private disposed = false;
  private readonly onMaterialDispose = () => this.dispose();
  private readonly sourceName: string;
  private readonly preparationStarted = performance.now();
  private preparationMs = 0;
  readonly uniforms = {
    waterHdrMap: { value: null as T.Texture | null },
    waterHdrRotation: { value: new T.Matrix3() },
    waterHdrEnabled: { value: 0 },
    waterHdrIntensity: { value: 1 },
  };
  constructor(
    private readonly material: T.ShaderMaterial,
    source: T.Texture,
    renderer: T.WebGLRenderer,
    factory: WaterOpticsGeneratorFactory = (r) => new T.PMREMGenerator(r),
  ) {
    this.original = material.fragmentShader;
    this.sourceName = source.name || "loaded afternoon-sky.hdr";
    const shader = waterOpticsFragment(this.original);
    const input = waterOpticsInput(source);
    const renderState = {
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      autoClear: renderer.autoClear,
      toneMapping: renderer.toneMapping,
      xr: renderer.xr.enabled,
    };
    let generator: Generator | undefined;
    try {
      generator = factory(renderer);
      const target = generator.fromEquirectangular(input);
      this.target = target;
      if (
        target.width !== WATER_OPTICS.atlasWidth ||
        target.height !== WATER_OPTICS.atlasHeight ||
        target.texture.type !== T.HalfFloatType ||
        target.texture.mapping !== T.CubeUVReflectionMapping
      )
        throw new Error("Unexpected water PMREM dimensions or format");
      target.texture.name = "Water HDR comparison — owned 128-face PMREM";
      this.uniforms.waterHdrMap.value = target.texture;
      Object.assign(material.uniforms, this.uniforms);
      material.fragmentShader = shader;
      material.needsUpdate = true;
      material.addEventListener("dispose", this.onMaterialDispose);
    } catch (error) {
      this.target?.dispose();
      this.target = undefined;
      throw error;
    } finally {
      generator?.dispose();
      input.dispose();
      renderer.setRenderTarget(
        renderState.target,
        renderState.face,
        renderState.mip,
      );
      renderer.autoClear = renderState.autoClear;
      renderer.toneMapping = renderState.toneMapping;
      renderer.xr.enabled = renderState.xr;
      this.preparationMs = performance.now() - this.preparationStarted;
    }
  }
  update(weather: string, rotation: T.Euler, intensity: number) {
    if (this.disposed) return;
    waterOpticsRotation(rotation, this.uniforms.waterHdrRotation.value);
    this.uniforms.waterHdrIntensity.value = intensity;
    this.uniforms.waterHdrEnabled.value = weather === "day" ? 1 : 0;
  }
  diagnostics() {
    return {
      requested: !this.disposed,
      active: !this.disposed && this.uniforms.waterHdrEnabled.value === 1,
      source: this.sourceName,
      preparationMs: this.preparationMs,
      timingNote:
        "CPU wall time including synchronous filtering calls; not GPU duration",
      status: this.disposed ? "disposed" : "ready",
      faceSize: WATER_OPTICS.faceSize,
      width: this.target?.width ?? 0,
      height: this.target?.height ?? 0,
      retainedGpuBytes: this.target ? WATER_OPTICS.retainedBytes : 0,
      // Temporary input and generator ping-pong are released after construction.
      transientTextureBytes:
        WATER_OPTICS.temporaryInputBytes + WATER_OPTICS.retainedBytes,
      roughness: WATER_OPTICS.roughness,
      rotation: this.uniforms.waterHdrRotation.value.toArray(),
      intensity: this.uniforms.waterHdrIntensity.value,
      belowHorizon:
        "original water fallback; blend over upper 0.05 direction.y",
      sceneCapture: false,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.material.removeEventListener("dispose", this.onMaterialDispose);
    this.material.fragmentShader = this.original;
    for (const key of Object.keys(this.uniforms))
      delete this.material.uniforms[key];
    this.material.needsUpdate = true;
    this.target?.dispose();
    this.target = undefined;
    this.uniforms.waterHdrMap.value = null;
    this.uniforms.waterHdrEnabled.value = 0;
  }
}
