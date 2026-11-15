import { ShadowCasterVolume } from "./shadow-caster-volume";
import * as T from "three";

export interface ReflectionProbeSpec {
  name: string;
  position: [number, number, number];
  materials: T.MeshStandardMaterial[];
  intensity?: { day: number; night: number };
}
export interface SceneReflectionProbe {
  spec: ReflectionProbeSpec;
  target: T.WebGLCubeRenderTarget;
  camera: T.CubeCamera;
  dirty: boolean;
  /** Only a completed capture of the current lighting generation is valid. */
  valid: boolean;
  capturedGeneration: number;
}

/** Small static scene captures, refreshed on weather changes when nearby. */
export class SceneReflections {
  private readonly casterVolume = new ShadowCasterVolume();
  probes: SceneReflectionProbe[];
  private generation = 0;
  private disposed = false;
  private listeners = new Set<() => void>();
  captures = 0;
  lastSubmissionMs = 0;
  lastError: string | null = null;
  constructor(
    private scene: T.Scene,
    private root: T.Object3D,
    private chunks: T.Mesh[],
    private sun: T.DirectionalLight,
    specs: ReflectionProbeSpec[],
  ) {
    this.probes = specs.map((spec) => {
      const target = new T.WebGLCubeRenderTarget(128, {
        type: T.HalfFloatType,
        generateMipmaps: true,
        minFilter: T.LinearMipmapLinearFilter,
      });
      target.texture.name = spec.name;
      const camera = new T.CubeCamera(0.1, 900, target);
      camera.position.set(...spec.position);
      return {
        spec,
        target,
        camera,
        dirty: true,
        valid: false,
        capturedGeneration: -1,
      };
    });
  }
  /** Borrowers never own capture targets or mutate architectural receivers. */
  currentTexture(name: string): T.CubeTexture | null {
    const probe = this.probes.find((p) => p.spec.name === name);
    return !this.disposed &&
      probe?.valid &&
      !probe.dirty &&
      probe.capturedGeneration === this.generation
      ? probe.target.texture
      : null;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private changed() {
    for (const listener of this.listeners) listener();
  }
  invalidate() {
    this.generation++;
    for (const probe of this.probes) {
      probe.dirty = true;
      probe.valid = false;
      probe.capturedGeneration = -1;
      for (const material of probe.spec.materials) {
        material.envMap = null;
        material.needsUpdate = true;
      }
    }
    this.changed();
  }
  setNight(night: boolean) {
    for (const { spec } of this.probes) {
      if (!spec.intensity) continue;
      for (const material of spec.materials)
        material.envMapIntensity = night
          ? spec.intensity.night
          : spec.intensity.day;
    }
  }
  update(renderer: T.WebGLRenderer, viewer: T.Vector3) {
    if (this.disposed) return;
    const probe = this.probes.find(
      (p) =>
        p.dirty &&
        Math.hypot(
          viewer.x - p.spec.position[0],
          viewer.z - p.spec.position[2],
        ) < 180,
    );
    if (!probe) return;
    const captureGeneration = this.generation;
    const started = performance.now();
    const visibility = new Map<T.Object3D, boolean>();
    const shadows = new Map<T.Mesh, boolean>();
    const show = (object: T.Object3D, visible: boolean) => {
      if (!visibility.has(object)) visibility.set(object, object.visible);
      object.visible = visible;
    };
    const oldSun = this.sun.position.clone();
    const oldTarget = this.sun.target.position.clone();
    const shadowAuto = renderer.shadowMap.autoUpdate;
    const renderTarget = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace();
    const mipLevel = renderer.getActiveMipmapLevel();
    const xr = renderer.xr.enabled;
    try {
      // Capture fixed city geometry. Moving actors and the reflecting surface
      // itself must not become frozen duplicates in the environment texture.
      for (const child of this.scene.children)
        if (
          child !== this.root &&
          child !== this.sun &&
          child !== this.sun.target &&
          !(child instanceof T.HemisphereLight)
        )
          show(child, false);
      this.casterVolume.update(this.sun, probe.camera.position);
      for (const chunk of this.chunks) {
        const p = chunk.userData.center;
        if (p) {
          const distance = Math.hypot(
            p[0] - probe.spec.position[0],
            p[1] - probe.spec.position[2],
          );
          shadows.set(chunk, chunk.castShadow);
          chunk.castShadow = this.casterVolume.includes(chunk);
          show(chunk, distance < (chunk.userData.detail ? 250 : 1000));
        }
      }
      const targetMaterials = new Set(probe.spec.materials);
      this.root.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        if (
          materials.some((m) =>
            targetMaterials.has(m as T.MeshStandardMaterial),
          )
        )
          show(object, false);
      });
      // Translate the light/target pair together. Reusing absolute sun.y at a
      // zero-height target changes direction when the viewer stands on a slope.
      const direction = oldSun.clone().sub(oldTarget);
      this.sun.target.position.set(...probe.spec.position);
      this.sun.position.copy(this.sun.target.position).add(direction);
      this.scene.updateMatrixWorld(true);
      // Render the probe's sun shadow once across its six faces.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      probe.camera.update(renderer, this.scene);
      // A capture invalidated by a render callback must not publish stale light.
      if (captureGeneration !== this.generation || this.disposed) return;
      for (const material of probe.spec.materials) {
        material.envMap = probe.target.texture;
        material.needsUpdate = true;
      }
      probe.dirty = false;
      probe.valid = true;
      probe.capturedGeneration = captureGeneration;
      this.captures++;
      this.lastError = null;
      this.changed();
    } catch (error) {
      // Optional local reflections must never interrupt the playable world.
      // Keep the current sky environment if a graphics driver rejects capture.
      probe.dirty = false;
      probe.valid = false;
      probe.capturedGeneration = -1;
      for (const material of probe.spec.materials) {
        material.envMap = null;
        material.needsUpdate = true;
      }
      this.changed();
      this.lastError = String(error);
      console.warn("Local reflection capture unavailable", error);
    } finally {
      for (const [object, visible] of visibility) object.visible = visible;
      for (const [object, shadow] of shadows) object.castShadow = shadow;
      this.sun.position.copy(oldSun);
      this.sun.target.position.copy(oldTarget);
      this.scene.updateMatrixWorld(true);
      renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.shadowMap.needsUpdate = true;
      renderer.xr.enabled = xr;
      renderer.setRenderTarget(renderTarget, cubeFace, mipLevel);
      this.lastSubmissionMs = performance.now() - started;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.invalidate();
    for (const probe of this.probes) probe.target.dispose();
    this.listeners.clear();
  }
}
