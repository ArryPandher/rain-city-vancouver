import * as T from "three";

type TextureRefresh = (
  this: PmremInternals,
  texture: T.Texture,
  output?: T.WebGLRenderTarget | null,
) => T.WebGLRenderTarget;
type PmremInternals = {
  _renderer: T.WebGLRenderer;
  _cubeSize: number;
  _lodMax: number;
  _sizeLods: number[];
  _lodMeshes: T.Mesh[];
  _pingPongRenderTarget: T.WebGLRenderTarget | null;
  _ggxMaterial: T.ShaderMaterial | null;
  _setSize(size: number): void;
  _allocateTargets(): T.WebGLRenderTarget;
  _fromTexture: TextureRefresh;
};
const installed = Symbol.for("rain-city.pmrem-refresh-r182");

function inputSize(texture: T.Texture) {
  const image = texture.image;
  const cube =
    texture.mapping === T.CubeReflectionMapping ||
    texture.mapping === T.CubeRefractionMapping;
  // Match r182's public cube/equirectangular input normalization.
  let width: number | undefined;
  if (cube && Array.isArray(image)) {
    const face = image[0] as
      | { width?: number; image?: { width?: number } }
      | undefined;
    width = image.length === 0 ? 16 : face?.width || face?.image?.width;
  } else if (
    !cube &&
    image &&
    typeof image === "object" &&
    "width" in image &&
    typeof image.width === "number"
  )
    width = image.width / 4;
  if (typeof width !== "number" || !Number.isFinite(width) || width < 16)
    throw new Error("Unsupported PMREM input size for the r182 adapter");
  return 2 ** Math.floor(Math.log2(width));
}

function resourcesMatch(generator: PmremInternals, size: number) {
  const width = 3 * Math.max(size, 112),
    height = 4 * size,
    defines = generator._ggxMaterial?.defines;
  return (
    generator._pingPongRenderTarget?.width === width &&
    generator._pingPongRenderTarget.height === height &&
    generator._sizeLods[0] === size &&
    generator._lodMeshes.length === generator._sizeLods.length &&
    Number(defines?.CUBEUV_MAX_MIP) === Math.log2(size) &&
    defines?.CUBEUV_TEXEL_WIDTH === 1 / width &&
    defines?.CUBEUV_TEXEL_HEIGHT === 1 / height
  );
}

/** r182's reused-output path skips its scratch/LOD allocation check. The
 * renderer's shared PMREM generator therefore filters refreshed 128/256 cubes
 * with the last HDR sky's 512 atlas. Keep native filtering/output ownership;
 * synchronize internal dimensions before entering that path.
 *
 * This stateless prototype adapter lives for the Three module's lifetime. It
 * owns no renderer, generator, retained target or disposal listener. Optional
 * engine arguments permit guard tests without mutating the installed engine.
 */
export function installPmremRefreshCompatibility(
  engine: { revision: string; prototype: object } = {
    revision: T.REVISION,
    prototype: T.PMREMGenerator.prototype,
  },
): boolean {
  if (engine.revision !== "182") return false;
  const prototype = engine.prototype as PmremInternals;
  if (
    ![
      "_fromTexture",
      "_setSize",
      "_allocateTargets",
      "_textureToCubeUV",
      "_applyPMREM",
      "_cleanup",
    ].every((key) => typeof (prototype as any)[key] === "function")
  )
    return false;
  const original = prototype._fromTexture;
  if ((original as unknown as Record<symbol, boolean>)[installed]) return true;
  const refresh: TextureRefresh = function (texture, supplied) {
    const size = inputSize(texture),
      width = 3 * Math.max(size, 112),
      height = 4 * size;
    if (
      supplied &&
      (supplied.width !== width ||
        supplied.height !== height ||
        supplied.texture.mapping !== T.CubeUVReflectionMapping)
    )
      throw new Error("PMREM output does not match the input's CubeUV atlas");
    if (
      !Array.isArray(this._sizeLods) ||
      !Array.isArray(this._lodMeshes) ||
      !this._renderer
    )
      throw new Error("Unsupported PMREM instance shape for the r182 adapter");
    const renderer = this._renderer;
    const saved = {
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      xr: renderer.xr.enabled,
      autoClear: renderer.autoClear,
    };
    const outputState = supplied
      ? {
          viewport: supplied.viewport.clone(),
          scissor: supplied.scissor.clone(),
          scissorTest: supplied.scissorTest,
        }
      : undefined;
    let output = supplied ?? undefined;
    let succeeded = false;
    try {
      this._setSize(size);
      if (!output || !resourcesMatch(this, size)) {
        // The native allocator also creates an output. When reusing a caller's
        // target, this extra object is never rendered/GPU-initialized and must
        // be disposed. Native allocation owns replacement of old scratch.
        const allocated = this._allocateTargets();
        if (output) allocated.dispose();
        else output = allocated;
      }
      if (!resourcesMatch(this, size))
        throw new Error("PMREM scratch/LOD layout differs from audited r182");
      const result = original.call(this, texture, output);
      succeeded = true;
      return result;
    } finally {
      if (!succeeded) {
        if (supplied && outputState) {
          supplied.viewport.copy(outputState.viewport);
          supplied.scissor.copy(outputState.scissor);
          supplied.scissorTest = outputState.scissorTest;
        } else output?.dispose();
        // A supplied output may now contain partial pixels. Rethrow the failure
        // so the native cache cannot publish a successful pmremVersion for it.
      }
      renderer.autoClear = saved.autoClear;
      renderer.xr.enabled = saved.xr;
      renderer.setRenderTarget(saved.target, saved.face, saved.mip);
    }
  };
  Object.defineProperty(refresh, installed, { value: true });
  prototype._fromTexture = refresh;
  return true;
}
