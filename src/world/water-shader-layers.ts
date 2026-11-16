import * as T from "three";
type Compile = T.Material["onBeforeCompile"];
type Layers = {
  original: Compile;
  originalKey: T.Material["customProgramCacheKey"];
  compile: Compile;
  key: T.Material["customProgramCacheKey"];
  layers: Map<string, Compile>;
};
const installed = new WeakMap<T.ShaderMaterial, Layers>();

/** Water-only composition: independently removable diagnostics must not retain
 * each other's disposed onBeforeCompile wrappers. No global prototype edit. */
export function addWaterShaderLayer(
  material: T.ShaderMaterial,
  name: string,
  layer: Compile,
) {
  let state = installed.get(material);
  if (!state) {
    const original = material.onBeforeCompile,
      originalKey = material.customProgramCacheKey;
    const baseKey = material.customProgramCacheKey();
    const layers = new Map<string, Compile>();
    const compile: Compile = function (shader, renderer) {
      original.call(material, shader, renderer);
      for (const callback of layers.values())
        callback.call(material, shader, renderer);
    };
    const key = () => `${baseKey}|${[...layers.keys()].join("|")}`;
    state = { original, originalKey, compile, key, layers };
    installed.set(material, state);
    material.onBeforeCompile = compile;
    material.customProgramCacheKey = key;
  }
  if (state.layers.has(name))
    throw new Error(`Duplicate water shader layer: ${name}`);
  state.layers.set(name, layer);
  material.needsUpdate = true;
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    state!.layers.delete(name);
    if (!state!.layers.size) {
      if (material.onBeforeCompile === state!.compile)
        material.onBeforeCompile = state!.original;
      if (material.customProgramCacheKey === state!.key)
        material.customProgramCacheKey = state!.originalKey;
      installed.delete(material);
    }
    material.needsUpdate = true;
  };
}
