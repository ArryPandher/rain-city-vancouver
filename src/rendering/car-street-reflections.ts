import * as T from "three";
import type { VehicleModel } from "../world/vehicles";
import type { SceneReflections } from "./reflection-probes";

export const CAR_STREET_PROBES = [
  "Fairmont Waterfront street lobby",
  "PwC Place street lobby",
] as const;
export const CAR_STREET_REFLECTION_REGION = {
  minX: 442,
  maxX: 510,
  minZ: -502,
  maxZ: -397,
  fullRadius: 14,
  enterRadius: 30,
  exitRadius: 34,
  fullHeight: 4,
  maxHeight: 8,
  transitionSeconds: 0.55,
  boundaryFade: 8,
  exitHalo: 12,
  discoverySeconds: 0.5,
  // Matched native full-local view over-darkened the roof and side. Keep at
  // least 60% native sky specular; the lobby capture is an offset approximation.
  maxLocalWeight: 0.4,
} as const;
const smooth = (x: number) => {
  const t = T.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const eligible = (material: T.Material): material is T.MeshStandardMaterial =>
  material instanceof T.MeshStandardMaterial &&
  (/^(Paint\s+[12]\b|Glass\b)/i.test(material.name) ||
    material.userData.vehicleRole === "paint" ||
    material.userData.vehicleRole === "glass");

/** Reuse Three's own PMREM roughness lookup with independent 128px-cube
 * atlas constants, so a differently sized sky PMREM cannot distort this lookup. */
export function carStreetReflectionChunk() {
  const source = T.ShaderChunk.envmap_physical_pars_fragment;
  const result = source.replace(
    "return envMapColor.rgb * envMapIntensity;",
    "return carStreetRadiance( envMapColor.rgb * envMapIntensity, reflectVec, roughness );",
  );
  if (result === source)
    throw new Error("Three environment radiance contract changed");
  let lookup = T.ShaderChunk.cube_uv_reflection_fragment;
  for (const name of [
    "getFace",
    "getUV",
    "bilinearCubeUV",
    "roughnessToMip",
    "textureCubeUV",
  ])
    lookup = lookup.replace(
      new RegExp("\\b" + name + "\\b", "g"),
      "carStreet_" + name,
    );
  lookup = lookup
    .replace(/cubeUV_/g, "carStreetCubeUV_")
    .replace(/CUBEUV_MAX_MIP/g, "7.0")
    .replace(/CUBEUV_TEXEL_WIDTH/g, "(1.0 / 384.0)")
    .replace(/CUBEUV_TEXEL_HEIGHT/g, "(1.0 / 512.0)");
  return `${lookup}
#ifdef ENVMAP_TYPE_CUBE_UV
uniform sampler2D carStreetMapA;
uniform sampler2D carStreetMapB;
uniform vec2 carStreetWeights;
vec3 carStreetRadiance( vec3 sky, vec3 worldDirection, float roughness ) {
  // Captures already use world axes: no sky or vehicle rotation here.
  // A convex radiance blend preserves the native intensity and sky fallback.
  vec3 result = sky * ( 1.0 - carStreetWeights.x - carStreetWeights.y );
  if ( carStreetWeights.x > 0.0 )
    result += carStreetWeights.x * carStreet_textureCubeUV( carStreetMapA, worldDirection, roughness ).rgb * envMapIntensity;
  if ( carStreetWeights.y > 0.0 )
    result += carStreetWeights.y * carStreet_textureCubeUV( carStreetMapB, worldDirection, roughness ).rgb * envMapIntensity;
  return result;
}
#endif
${result}`;
}

type Assignment = {
  original: T.Material | T.Material[];
  assigned: T.Material | T.Material[];
};
type Binding = {
  model: VehicleModel;
  meshes: Map<T.Mesh, Assignment>;
  clones: Map<T.Material, T.MeshStandardMaterial>;
  active: [boolean, boolean];
  weights: T.Vector2;
  nextDiscovery: number;
  uniforms: {
    carStreetMapA: { value: T.Texture | null };
    carStreetMapB: { value: T.Texture | null };
    carStreetWeights: { value: T.Vector2 };
  };
};

/** Optional car-only borrowers of two existing successful street captures.
 * Owns only PMREM derivatives; never captures the scene or changes its receivers. */
export class CarStreetReflections {
  private enabled = false;
  private disposed = false;
  private bindings = new Map<VehicleModel, Binding>();
  private unsubscribe: () => void;
  private position = new T.Vector3();
  private generator?: T.PMREMGenerator;
  private filtered = new Map<
    number,
    { source: T.CubeTexture; generation: number; target: T.WebGLRenderTarget }
  >();
  private failed = new Map<
    number,
    { source: T.CubeTexture; generation: number }
  >();
  filterCount = 0;
  lastFilterError: string | null = null;
  lastFilterSubmissionMs = 0;
  constructor(
    private reflections: SceneReflections,
    private renderer: T.WebGLRenderer,
    private options: {
      enabled?: boolean;
      filter?: (source: T.CubeTexture) => T.WebGLRenderTarget;
    } = {},
  ) {
    this.enabled = options.enabled ?? false;
    this.unsubscribe = reflections.subscribe(() => this.refreshValidity());
  }
  setEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.enabled = enabled;
    this.refreshValidity();
    if (!enabled) for (const model of this.bindings.keys()) this.remove(model);
  }
  private refreshValidity() {
    for (const [i, cache] of this.filtered) {
      const probe = this.reflections.probes.find(
        (p) => p.spec.name === CAR_STREET_PROBES[i],
      );
      if (
        !this.enabled ||
        this.reflections.currentTexture(CAR_STREET_PROBES[i]) !==
          cache.source ||
        probe?.capturedGeneration !== cache.generation
      ) {
        for (const binding of this.bindings.values()) {
          binding.weights.setComponent(i, 0);
          binding.active[i] = false;
          (i === 0
            ? binding.uniforms.carStreetMapA
            : binding.uniforms.carStreetMapB
          ).value = null;
        }
        cache.target.dispose();
        this.filtered.delete(i);
      }
    }
    for (const [i, cache] of this.failed) {
      const probe = this.reflections.probes.find(
        (p) => p.spec.name === CAR_STREET_PROBES[i],
      );
      if (
        !this.enabled ||
        this.reflections.currentTexture(CAR_STREET_PROBES[i]) !==
          cache.source ||
        probe?.capturedGeneration !== cache.generation
      )
        this.failed.delete(i);
    }
    if (!this.filtered.size) {
      this.generator?.dispose();
      this.generator = undefined;
    }
    for (const binding of this.bindings.values()) {
      for (const [i, name] of CAR_STREET_PROBES.entries()) {
        const texture =
          this.enabled && this.reflections.currentTexture(name)
            ? (this.filtered.get(i)?.target.texture ?? null)
            : null;
        if (!texture) {
          binding.weights.setComponent(i, 0);
          binding.active[i] = false;
        }
        const uniform =
          i === 0
            ? binding.uniforms.carStreetMapA
            : binding.uniforms.carStreetMapB;
        uniform.value =
          texture && binding.weights.getComponent(i) > 0 ? texture : null;
      }
    }
  }
  private texture(i: number, prepare = false): T.Texture | null {
    const name = CAR_STREET_PROBES[i],
      source = this.reflections.currentTexture(name);
    const probe = this.reflections.probes.find((p) => p.spec.name === name);
    if (!this.enabled || !source || !probe) return null;
    const existing = this.filtered.get(i);
    if (existing) return existing.target.texture;
    if (!prepare || this.failed.has(i)) return null;
    const start = performance.now();
    const renderer = this.renderer;
    const saved = {
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      xr: renderer.xr.enabled,
      autoClear: renderer.autoClear,
    };
    const setTarget = renderer.setRenderTarget;
    const touched = new Set<T.WebGLRenderTarget<T.Texture | T.Texture[]>>();
    // PMREM restores state on success. Retain its temporary output references
    // too, so a driver failure before fromCubemap returns cannot strand them.
    renderer.setRenderTarget = function (target, face, mip) {
      if (target && target !== saved.target) touched.add(target);
      return setTarget.call(this, target, face, mip);
    };
    let target: T.WebGLRenderTarget | undefined;
    try {
      if (this.options.filter) target = this.options.filter(source);
      else {
        this.generator ??= new T.PMREMGenerator(this.renderer);
        target = this.generator.fromCubemap(source);
      }
      if (
        target.width !== 384 ||
        target.height !== 512 ||
        target.texture.mapping !== T.CubeUVReflectionMapping
      )
        throw new Error(
          "Street PMREM must match the existing 128px cube atlas",
        );
      target.texture.name = `Car street PMREM: ${name}`;
      this.filtered.set(i, {
        source,
        generation: probe.capturedGeneration,
        target,
      });
      this.filterCount++;
      this.lastFilterError = null;
      return target.texture;
    } catch (error) {
      target?.dispose();
      const retained = new Set<T.WebGLRenderTarget<T.Texture | T.Texture[]>>(
        [...this.filtered.values()].map((c) => c.target),
      );
      for (const temporary of touched)
        if (temporary !== target && !retained.has(temporary))
          temporary.dispose();
      this.generator?.dispose();
      this.generator = undefined;
      this.failed.set(i, { source, generation: probe.capturedGeneration });
      this.lastFilterError = String(error);
      return null;
    } finally {
      renderer.setRenderTarget = setTarget;
      renderer.xr.enabled = saved.xr;
      renderer.autoClear = saved.autoClear;
      renderer.setRenderTarget(saved.target, saved.face, saved.mip);
      this.lastFilterSubmissionMs = performance.now() - start;
    }
  }
  private bind(model: VehicleModel) {
    const weights = new T.Vector2();
    const binding: Binding = {
      model,
      meshes: new Map(),
      clones: new Map(),
      active: [false, false],
      weights,
      nextDiscovery: 0,
      uniforms: {
        carStreetMapA: { value: null },
        carStreetMapB: { value: null },
        carStreetWeights: { value: weights },
      },
    };
    this.bindings.set(model, binding);
    return binding;
  }
  private syncMaterials(binding: Binding) {
    binding.model.group.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      let body = false;
      for (
        let p: T.Object3D | null = object;
        p && p !== binding.model.group;
        p = p.parent
      )
        if (p.name === "car-body") {
          body = true;
          break;
        }
      if (!body) return;
      const previous = binding.meshes.get(object);
      if (previous?.assigned === object.material) return;
      const original = object.material;
      const list = Array.isArray(original) ? original : [original];
      if (!list.some(eligible)) return;
      const assigned = list.map((material) => {
        if (!eligible(material)) return material;
        let clone = binding.clones.get(material);
        if (!clone) {
          clone = material.clone();
          // Null keeps the native current sky. Borrowed cubes are separate
          // world-space shader inputs, including when the car turns or rolls.
          clone.envMap = null;
          clone.envMapRotation.set(0, 0, 0);
          const inherited = material.onBeforeCompile;
          clone.onBeforeCompile = function (shader, renderer) {
            inherited.call(this, shader, renderer);
            Object.assign(shader.uniforms, binding.uniforms);
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <envmap_physical_pars_fragment>",
              carStreetReflectionChunk(),
            );
          };
          const key = material.customProgramCacheKey();
          clone.customProgramCacheKey = () =>
            `${key}|car-street-pmrem-blend-v1`;
          binding.clones.set(material, clone);
        }
        return clone;
      });
      object.material = Array.isArray(original) ? assigned : assigned[0];
      binding.meshes.set(object, { original, assigned: object.material });
    });
  }
  /** Call after actor/LOD poses update. Includes attached hidden far bodies;
   * late LOD attachment is discovered without modifying car ownership. */
  update(models: Iterable<VehicleModel>, dt: number) {
    if (this.disposed || !this.enabled) return;
    const seen = new Set<VehicleModel>(),
      region = CAR_STREET_REFLECTION_REGION;
    for (const model of models) {
      if (model.kind !== "car") continue;
      seen.add(model);
      model.group.getWorldPosition(this.position);
      const p = this.position;
      const edgeDistance = Math.min(
        p.x - region.minX,
        region.maxX - p.x,
        p.z - region.minZ,
        region.maxZ - p.z,
      );
      const inBounds = edgeDistance >= -region.exitHalo;
      const boundaryWeight = smooth(edgeDistance / region.boundaryFade);
      let binding = this.bindings.get(model);
      if (!this.enabled || !inBounds) {
        if (binding) this.remove(model);
        continue;
      }
      const target = [0, 0];
      for (const [i, name] of CAR_STREET_PROBES.entries()) {
        const probe = this.reflections.probes.find((p) => p.spec.name === name);
        if (!probe || !this.reflections.currentTexture(name)) {
          if (binding) binding.active[i] = false;
          continue;
        }
        const distance = Math.hypot(
          p.x - probe.spec.position[0],
          p.z - probe.spec.position[2],
        );
        const height = Math.abs(p.y - probe.spec.position[1]);
        const active =
          distance <
            (binding?.active[i] ? region.exitRadius : region.enterRadius) &&
          height < region.maxHeight;
        if (binding) binding.active[i] = active;
        if (active)
          target[i] =
            boundaryWeight *
            (1 -
              smooth(
                (distance - region.fullRadius) /
                  (region.exitRadius - region.fullRadius),
              )) *
            (1 -
              smooth(
                (height - region.fullHeight) /
                  (region.maxHeight - region.fullHeight),
              ));
      }
      if (!binding && target.every((w) => w === 0)) continue;
      if (!binding) {
        binding = this.bind(model);
        binding.active = [target[0] > 0, target[1] > 0];
      }
      binding.nextDiscovery -= Math.max(0, Math.min(dt, 0.25));
      if (binding.nextDiscovery <= 0) {
        this.syncMaterials(binding);
        binding.nextDiscovery = region.discoverySeconds;
      }
      // Targets and filtered values are convex; transitions never add light.
      const sum = target[0] + target[1];
      if (sum > 1) {
        target[0] /= sum;
        target[1] /= sum;
      }
      target[0] *= region.maxLocalWeight;
      target[1] *= region.maxLocalWeight;
      const alpha =
        1 -
        Math.exp(-Math.max(0, Math.min(dt, 0.25)) / region.transitionSeconds);
      for (let i = 0; i < 2; i++) {
        const texture = this.texture(i, target[i] > 0);
        const weight = texture
          ? T.MathUtils.lerp(binding.weights.getComponent(i), target[i], alpha)
          : 0;
        binding.weights.setComponent(i, weight < 1e-5 ? 0 : weight);
        const uniform =
          i === 0
            ? binding.uniforms.carStreetMapA
            : binding.uniforms.carStreetMapB;
        uniform.value = weight >= 1e-5 ? texture : null;
      }
      if (target.every((w) => w === 0) && binding.weights.lengthSq() === 0)
        this.remove(model);
    }
    for (const model of this.bindings.keys())
      if (!seen.has(model)) this.remove(model);
  }
  snapshot(model: VehicleModel) {
    const b = this.bindings.get(model);
    return b
      ? {
          weights: b.weights.toArray(),
          materialCount: b.clones.size,
          meshCount: b.meshes.size,
        }
      : null;
  }
  remove(model: VehicleModel) {
    const b = this.bindings.get(model);
    if (!b) return;
    b.weights.set(0, 0);
    b.uniforms.carStreetMapA.value = null;
    b.uniforms.carStreetMapB.value = null;
    for (const [mesh, assignment] of b.meshes)
      if (mesh.material === assignment.assigned)
        mesh.material = assignment.original;
    for (const material of b.clones.values()) material.dispose();
    this.bindings.delete(model);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    for (const model of this.bindings.keys()) this.remove(model);
    for (const cache of this.filtered.values()) cache.target.dispose();
    this.filtered.clear();
    this.failed.clear();
    this.generator?.dispose();
    this.generator = undefined;
  }
}
